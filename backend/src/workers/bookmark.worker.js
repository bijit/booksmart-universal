/**
 * Bookmark Processing Worker
 *
 * Background worker that processes pending bookmarks through the AI pipeline:
 * 1. Extract content (Crawl4AI)
 * 2. Summarize & embed (Gemini)
 * 3. Store in Qdrant
 * 4. Update Supabase status
 */

import { extractContent } from '../services/readability.service.js';
import { extractDocumentContent, isSupportedDocument } from '../services/document.service.js';
import { processContent, processContentWithChunking, summarizeFromMetadata, generateEmbedding, generateDeepSummary } from '../services/gemini.service.js';
import { createBookmark, createBookmarkChunks, deleteBookmark, deleteBookmarkChunks } from '../services/qdrant.service.js';
import {
  getUserBookmarkRecords,
  updateBookmarkRecord,
  deleteBookmarkRecord
} from '../services/supabase.service.js';
import { isQuotaError } from '../utils/errors.js';
import { detectContentType } from '../utils/contentType.js';

// Worker configuration
const POLL_INTERVAL_MS = 1000; // Check for new bookmarks every 1 second (faster batch processing)
const MAX_RETRIES = 3;
const BATCH_SIZE = 50; // Fetch up to 50 bookmarks per poll
const QUOTA_BACKOFF_MS = 5 * 60 * 1000; // Back off for 5 minutes when quota is hit

// Parallel processing configuration (set ENABLE_PARALLEL_PROCESSING = false to use sequential)
const ENABLE_PARALLEL_PROCESSING = true; // Toggle between parallel and sequential processing
const CONCURRENCY = 2; // Process 2 bookmarks at a time to stay safely within Gemini free-tier RPM limits

// Chunking configuration (set to true to use improved chunked embedding)
const ENABLE_CHUNKING = true; // Enable chunked embedding for better search quality

let isProcessing = false;
let workerRunning = false;
let quotaExhausted = false;
let quotaBackoffUntil = null;
let currentQuotaBackoffMs = 10000; // Start backoff at 10s on first 429, double exponentially up to 5m

/**
 * Process bookmark using metadata-only (fallback when content extraction fails)
 */
async function processMetadataOnly(id, url, title, user_id, created_at) {
  try {
    console.log(`[Worker] Processing ${id} with metadata-only mode...`);

    // Step 1: Generate summary/tags from URL + title only
    console.log(`[Worker] Step 1/3: Generating metadata-based summary...`);
    const summary = await summarizeFromMetadata(url, title);

    const contentType = detectContentType(url, 'metadata-only');
    console.log(`[Worker] Metadata-only Content Type: ${contentType}`);

    // Step 2: Generate embedding from metadata (URL + title + description)
    console.log(`[Worker] Step 2/3: Generating embedding from metadata...`);
    const metadataText = `${url}\n${summary.title}\n${summary.description}\n${summary.tags.join(' ')}`;
    const embedding = await generateEmbedding(metadataText);

    // Step 3: Store in Qdrant
    console.log(`[Worker] Step 3/3: Storing in vector database...`);
    const qdrantPointId = await createBookmark(user_id, {
      url: url,
      title: summary.title,
      description: summary.description,
      content: `Metadata-only bookmark. URL: ${url}`, // Minimal content
      embedding: embedding,
      tags: summary.tags || [],
      favicon_url: getFaviconUrl(url),
      created_at: created_at,
      content_type: contentType
    });

    // Step 4: Update Supabase with completion
    await updateBookmarkRecord(id, {
      title: summary.title,
      description: summary.description,
      tags: summary.tags || [],
      qdrant_point_id: qdrantPointId,
      processing_status: 'completed',
      extraction_method: 'metadata-only', // Mark as fallback method
      content_type: contentType,
      error_message: 'Content extraction blocked by website, summarized via metadata'
    });

    console.log(`[Worker] ✅ Successfully processed ${id} using metadata-only fallback`);
    return true;

  } catch (error) {
    console.error(`[Worker] ❌ Metadata-only processing failed for ${id}:`, error.message);
    throw error;
  }
}

/**
 * Fast-path bookmark processing (Phase 1 of Two-Phase Bulk Ingestion)
 * Generates metadata-only embeddings and stores in Qdrant and Supabase.
 * Makes the bookmark immediately searchable and completed in the UI.
 *
 * @param {Object} bookmark - The bookmark record from Supabase
 * @returns {Promise<boolean>} True if successful, false if failed
 */
async function processBookmarkFast(bookmark) {
  const { id, url, title, user_id, folder_path, folder_id, created_at } = bookmark;
  console.log(`[Worker] [Phase 1] Fast processing bookmark ${id}: ${url}`);

  try {
    // Step 1: Update status to "processing" first to lock it
    await updateBookmarkRecord(id, {
      processing_status: 'processing'
    });

    // Step 2: Use provided title or extract domain name if empty
    const cleanTitle = title || new URL(url).hostname || 'Untitled Bookmark';
    const inferredDescription = `Saved bookmark: ${cleanTitle}`;
    
    // Split folder path to extract tags automatically if folder exists
    let tags = [];
    if (folder_path) {
      tags = folder_path.split(' > ').map(t => t.toLowerCase().trim()).slice(0, 5);
    }
    if (tags.length === 0) {
      tags = ['imported'];
    }

    const contentType = detectContentType(url, 'metadata');
    console.log(`[Worker] [Phase 1] Content Type: ${contentType}`);

    // Step 3: Generate embedding from metadata (URL + title + folder path)
    // We only call generateEmbedding (high rate limit), NO Gemini summary generation!
    console.log(`[Worker] [Phase 1] Generating embedding from metadata...`);
    const metadataText = `${url}\n${cleanTitle}\n${folder_path || ''}`;
    const embedding = await generateEmbedding(metadataText);

    // Step 4: Store point in Qdrant
    console.log(`[Worker] [Phase 1] Storing in vector database...`);
    const qdrantPointId = await createBookmark(user_id, {
      url: url,
      title: cleanTitle,
      description: inferredDescription,
      content: `Metadata-only bookmark. URL: ${url}`,
      embedding: embedding,
      tags: tags,
      favicon_url: getFaviconUrl(url),
      folder_id: folder_id || null,
      folder_path: folder_path || null,
      created_at: created_at,
      content_type: contentType
    });

    // Step 5: Update Supabase with completion
    await updateBookmarkRecord(id, {
      title: cleanTitle,
      description: inferredDescription,
      tags: tags,
      qdrant_point_id: qdrantPointId,
      processing_status: 'completed',
      extraction_method: 'metadata', // Mark as metadata phase
      favicon_url: getFaviconUrl(url),
      content_type: contentType,
      error_message: null
    });

    console.log(`[Worker] ✅ [Phase 1] Fast processed bookmark ${id}`);
    return true;
  } catch (error) {
    console.error(`[Worker] ❌ [Phase 1] Fast processing failed for ${id}:`, error.message);
    
    // Check if it's a quota error
    if (isQuotaError(error)) {
      quotaExhausted = true;
      currentQuotaBackoffMs = Math.min(currentQuotaBackoffMs * 2, 5 * 60 * 1000); // Double backoff, max 5 minutes
      quotaBackoffUntil = Date.now() + currentQuotaBackoffMs;
      console.log(`[Worker] [Phase 1] Quota exceeded. Backing off for ${currentQuotaBackoffMs / 1000}s (Until ${new Date(quotaBackoffUntil).toLocaleTimeString()})`);

      await updateBookmarkRecord(id, {
        processing_status: 'pending',
        error_message: 'Quota exceeded in Phase 1 - will retry'
      });
      throw new Error('QUOTA_EXHAUSTED');
    }

    // Revert to pending on other errors to let sequential retry handle it
    await updateBookmarkRecord(id, {
      processing_status: 'pending',
      error_message: `Phase 1 failed: ${error.message}`
    });
    return false;
  }
}

/**
 * Generate favicon URL from page URL using Google's favicon service
 * Same API that the Chrome extension uses for displaying favicons
 *
 * @param {string} url - The page URL
 * @returns {string} Favicon URL
 */
function getFaviconUrl(url) {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch (error) {
    console.warn(`[Worker] Failed to generate favicon URL for ${url}:`, error.message);
    return null;
  }
}

/**
 * Process a single bookmark through the AI pipeline
 *
 * @param {Object} bookmark - The bookmark record from Supabase
 * @returns {Promise<boolean>} True if successful, false if failed
 */
async function processBookmark(bookmark) {
  const { id, url, title, user_id, retry_count, extracted_content, extraction_method, created_at, folder_path, folder_id } = bookmark;

  console.log(`\n[Worker] Processing bookmark ${id}: ${url}`);

  try {
    // Step 1: Update status to "processing"
    await updateBookmarkRecord(id, {
      processing_status: 'processing'
    });

    // Step 2: Get content - use extracted content from extension if available, otherwise use Jina
    let extracted;
    const hasValidExtractedContent = extracted_content && extracted_content.length > 500;

    if (hasValidExtractedContent) {
      console.log(`[Worker] Step 1/4: Using locally extracted content (${extracted_content.length} chars via ${extraction_method})`);
      extracted = {
        content: extracted_content,
        favicon: getFaviconUrl(url), // Generate favicon URL using Google's service
        cover_image: bookmark.cover_image || null,
        extracted_images: bookmark.extracted_images || []
      };
    } else {
      // Step 2b: Automatic document vs webpage detection
      if (isSupportedDocument(url)) {
        console.log(`[Worker] Step 1/4: Detected supported document, extracting with DocumentService...`);
        extracted = await extractDocumentContent(url);
      } else {
        console.log(`[Worker] Step 1/4: No local content, extracting with Readability...`);
        extracted = await extractContent(url);
        // If Readability didn't provide favicon, generate one
        if (!extracted.favicon) {
          extracted.favicon = getFaviconUrl(url);
        }
      }
    }

    // Detect content type
    const extractionMethodUsed = hasValidExtractedContent 
      ? extraction_method 
      : (extracted.method === 'pdf-parse' || extracted.method === 'mammoth' ? 'document-service' : 'readability');
    const contentType = detectContentType(url, extractionMethodUsed);
    console.log(`[Worker] Detected content type for ${id}: ${contentType}`);

    // Step 3: Process with Gemini (summarize + embed)
    console.log(`[Worker] Step 2/4: Generating AI summary and embeddings...`);
    let aiResult;
    let qdrantPointIds;

    if (ENABLE_CHUNKING) {
      // Use new chunked processing for better search quality
      console.log(`[Worker] Using CHUNKED processing mode`);
      aiResult = await processContentWithChunking(extracted.content, url, title);

      // Step 4: Store chunks in Qdrant
      console.log(`[Worker] Step 3/4: Storing ${aiResult.chunks.length} chunks in vector database...`);
      qdrantPointIds = await createBookmarkChunks(user_id, {
        bookmark_id: id, // Use Supabase bookmark ID as parent reference
        url: url,
        title: aiResult.title,
        description: aiResult.description,
        content: extracted.content,
        tags: aiResult.tags || [],
        chunks: aiResult.chunks,
        favicon_url: extracted.favicon || null,
        folder_path: folder_path || null,
        folder_id: folder_id || null,
        cover_image: extracted.cover_image || null,
        extracted_images: extracted.extracted_images || [],
        created_at: created_at,
        content_type: contentType
      });

      console.log(`[Worker] Created ${qdrantPointIds.length} chunk points in Qdrant`);
    } else {
      // Use legacy single-embedding approach
      console.log(`[Worker] Using LEGACY processing mode`);
      aiResult = await processContent(extracted.content, url);

      // Step 4: Store in Qdrant (legacy single point)
      console.log(`[Worker] Step 3/4: Storing in vector database...`);
      const qdrantPointId = await createBookmark(user_id, {
        url: url,
        title: aiResult.title,
        description: aiResult.description,
        content: extracted.content,
        embedding: aiResult.embedding,
        tags: aiResult.tags || [],
        favicon_url: extracted.favicon || null,
        folder_path: folder_path || null,
        folder_id: folder_id || null,
        cover_image: extracted.cover_image || null,
        extracted_images: extracted.extracted_images || [],
        created_at: created_at,
        content_type: contentType
      });

      qdrantPointIds = [qdrantPointId];
    }

    // Step 5: Update Supabase with completion
    console.log(`[Worker] Step 4/4: Updating database...`);
    await updateBookmarkRecord(id, {
      title: aiResult.title,
      description: aiResult.description,
      tags: aiResult.tags || [],
      qdrant_point_id: qdrantPointIds[0], // Store first chunk ID for legacy compatibility
      processing_status: 'completed',
      extraction_method: extractionMethodUsed,
      cover_image: extracted.cover_image || null,
      extracted_images: extracted.extracted_images || [],
      author: extracted.author || null,
      site_name: extracted.site_name || null,
      favicon_url: extracted.favicon || null,
      published_date: extracted.published_date || null,
      reading_time: extracted.reading_time || null,
      language: extracted.language || null,
      content_type: contentType,
      error_message: null
    });

    console.log(`[Worker] ✅ Successfully processed bookmark ${id}`);

    // Step 5 (non-blocking): Auto-generate deep summary for full-content bookmarks.
    // Skipped for metadata-only extractions (no real content to summarize).
    // Failures do NOT affect the bookmark's 'completed' status.
    extractionMethodUsed = hasValidExtractedContent ? extraction_method : (extracted.method || '');
    const isMetadataOnly = extractionMethodUsed === 'metadata-only';

    if (!isMetadataOnly && extracted.content && extracted.content.length >= 200) {
      (async () => {
        try {
          console.log(`[Worker] Step 5/5: Auto-generating deep summary for bookmark ${id}...`);
          const deepSummary = await generateDeepSummary(extracted.content, aiResult.title || title);

          // Serialize the structured JSON to plain prose for embedding — always a safe string
          const summaryText = [
            deepSummary.tldr,
            deepSummary.analysis,
            deepSummary.category ? `Category: ${deepSummary.category}` : null,
            Array.isArray(deepSummary.key_takeaways)
              ? 'Key takeaways: ' + deepSummary.key_takeaways.join('. ')
              : deepSummary.key_takeaways
          ].filter(Boolean).join('\n\n');

          const summaryEmbedding = await generateEmbedding(summaryText);

          const { v4: uuidv4 } = await import('uuid');
          const { QdrantClient } = await import('@qdrant/js-client-rest');
          const qdrantClient = new QdrantClient({
            url: process.env.QDRANT_URL,
            apiKey: process.env.QDRANT_API_KEY
          });

          await qdrantClient.upsert('bookmarks', {
            wait: true,
            points: [{
              id: uuidv4(),
              vector: summaryEmbedding,
              payload: {
                user_id,
                bookmark_id: id,
                url,
                title: aiResult.title || title,
                description: aiResult.description || null,
                tags: aiResult.tags || [],
                favicon_url: extracted.favicon || null,
                folder_id: folder_id || null,
                folder_path: folder_path || null,
                cover_image: extracted.cover_image || null,
                extracted_images: extracted.extracted_images || [],
                chunk_index: -1,
                chunk_text: summaryText,     // plain string — always safe for .substring()
                chunk_type: 'deep_summary',
                is_chunk: true,
                created_at: created_at || new Date().toISOString(),
                updated_at: new Date().toISOString()
              }
            }]
          });

          // Persist structured JSON to Supabase for the UI cards
          await updateBookmarkRecord(id, { detailed_summary: deepSummary });

          console.log(`[Worker] ✅ Deep summary auto-generated and indexed for bookmark ${id}`);
        } catch (deepErr) {
          console.warn(`[Worker] ⚠️  Deep summary step failed for bookmark ${id} (non-fatal): ${deepErr.message}`);
        }
      })();
    }

    return true;

  } catch (error) {
    console.error(`[Worker] ❌ Error processing bookmark ${id}:`, error.message);

    // Check if this is a permanent HTTP error (404, 403, 410, 400)
    const isGeminiError = error.message && (error.message.includes('Gemini') || error.message.includes('Embedding') || error.message.includes('GoogleGenerativeAI'));
    const is404 = error.message && error.message.includes('404');
    const is403 = error.message && error.message.includes('403');
    const is410 = error.message && error.message.includes('410');
    const is400 = error.message && error.message.includes('400'); // Bad Request

    // Only log the error, don't delete bookmarks automatically
    if (!isGeminiError && (is404 || is403 || is410 || is400)) {
      let errorMsg = 'Page not accessible';
      if (is404) errorMsg = 'Page not found (404)';
      if (is403) errorMsg = 'Access forbidden (403)';
      if (is410) errorMsg = 'Page gone (410)';
      if (is400) errorMsg = 'Bad request (400)';

      console.log(`[Worker] ⚠️  ${errorMsg} for ${id}. Will use metadata fallback.`);
      // Proceed to metadata fallback instead of deleting
    }

    // Check if this is a quota error
    if (isQuotaError(error)) {
      // Set quota backoff flag
      quotaExhausted = true;
      currentQuotaBackoffMs = Math.min(currentQuotaBackoffMs * 2, 5 * 60 * 1000); // Double backoff, max 5 minutes
      quotaBackoffUntil = Date.now() + currentQuotaBackoffMs;
      console.log(`[Worker] Quota exceeded. Backing off for ${currentQuotaBackoffMs / 1000}s (Until ${new Date(quotaBackoffUntil).toLocaleTimeString()})`);

      // Keep in pending state, DON'T increment retry count
      await updateBookmarkRecord(id, {
        processing_status: 'pending',
        error_message: 'Quota exceeded - will retry when quota resets'
      });

      // Throw error to stop batch processing
      throw new Error('QUOTA_EXHAUSTED');
    }

    // Determine if we should retry (for non-quota, non-404 errors)
    const shouldRetry = retry_count < MAX_RETRIES;
    const newRetryCount = retry_count + 1;

    if (shouldRetry) {
      // Update with retry status
      await updateBookmarkRecord(id, {
        processing_status: 'pending', // Back to pending for retry
        retry_count: newRetryCount,
        error_message: `Retry ${newRetryCount}/${MAX_RETRIES}: ${error.message}`
      });
      console.log(`[Worker] Will retry bookmark ${id} (attempt ${newRetryCount}/${MAX_RETRIES})`);
    } else {
      // Max retries exceeded, try metadata-only fallback
      console.log(`[Worker] ⚠️  Max retries exceeded for ${id}, trying metadata-only fallback...`);
      try {
        const fallbackSuccess = await processMetadataOnly(id, url, title, user_id, created_at);
        return fallbackSuccess;
      } catch (fallbackError) {
        // Check if fallback also hit quota
        if (isQuotaError(fallbackError)) {
          console.log(`[Worker] 🚫 Quota exceeded during fallback! Keeping ${id} pending`);
          quotaExhausted = true;
          quotaBackoffUntil = Date.now() + QUOTA_BACKOFF_MS;
          await updateBookmarkRecord(id, {
            processing_status: 'pending',
            error_message: 'Quota exceeded - will retry when quota resets'
          });
          throw new Error('QUOTA_EXHAUSTED');
        }

        // Even fallback failed (non-quota error), mark as truly failed
        await updateBookmarkRecord(id, {
          processing_status: 'failed',
          retry_count: newRetryCount,
          error_message: `Failed after ${MAX_RETRIES} retries and fallback: ${error.message}`
        });
        console.log(`[Worker] ❌ Bookmark ${id} failed permanently (even fallback failed)`);
      }
    }

    return false;
  }
}

/**
 * Process bookmarks in parallel with concurrency control
 *
 * @param {Array} bookmarks - Array of bookmark objects to process
 * @returns {Object} Results with success and failure counts
 */
async function processBookmarksInParallel(bookmarks) {
  let successful = 0;
  let failed = 0;
  let quotaHit = false;

  // Process bookmarks in batches of CONCURRENCY
  for (let i = 0; i < bookmarks.length; i += CONCURRENCY) {
    if (quotaHit) break; // Stop if quota was hit in previous batch

    const batch = bookmarks.slice(i, i + CONCURRENCY);
    const batchNumber = Math.floor(i / CONCURRENCY) + 1;
    const totalBatches = Math.ceil(bookmarks.length / CONCURRENCY);

    console.log(`[Worker] 🚀 Processing batch ${batchNumber}/${totalBatches} (${batch.length} bookmarks in parallel)`);

    // Process all bookmarks in this batch concurrently
    const results = await Promise.allSettled(
      batch.map(bookmark => {
        const hasExtracted = bookmark.extracted_content && bookmark.extracted_content.length > 500;
        return hasExtracted ? processBookmark(bookmark) : processBookmarkFast(bookmark);
      })
    );

    // Analyze results
    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      const bookmark = batch[j];

      if (result.status === 'fulfilled') {
        if (result.value === true) {
          successful++;
        } else {
          failed++;
        }
      } else if (result.status === 'rejected') {
        // Check if it was a quota error
        if (result.reason?.message === 'QUOTA_EXHAUSTED') {
          console.log(`[Worker] 🚫 Quota exhausted in batch ${batchNumber}, stopping processing`);
          quotaHit = true;
          failed++;
          break; // Stop processing this batch
        } else {
          console.error(`[Worker] ❌ Unexpected error for ${bookmark.id}:`, result.reason);
          failed++;
        }
      }
    }
  }

  return { successful, failed, quotaHit };
}

/**
 * Process bookmarks sequentially (original method)
 *
 * @param {Array} bookmarks - Array of bookmark objects to process
 * @returns {Object} Results with success and failure counts
 */
async function processBookmarksSequentially(bookmarks) {
  let successful = 0;
  let failed = 0;
  let quotaHit = false;

  for (const bookmark of bookmarks) {
    try {
      const hasExtracted = bookmark.extracted_content && bookmark.extracted_content.length > 500;
      const result = await (hasExtracted ? processBookmark(bookmark) : processBookmarkFast(bookmark));
      if (result) {
        successful++;
      } else {
        failed++;
      }
    } catch (error) {
      if (error.message === 'QUOTA_EXHAUSTED') {
        console.log(`[Worker] 🚫 Stopping sequential processing due to quota exhaustion`);
        quotaHit = true;
        break; // Stop processing more bookmarks
      }
      failed++;
    }
  }

  return { successful, failed, quotaHit };
}

/**
 * Poll for pending bookmarks and process them
 */
export async function pollAndProcess() {
  if (isProcessing) {
    return; // Already processing, skip this cycle
  }

  // Check if quota is exhausted and we're still in backoff period
  if (quotaExhausted && quotaBackoffUntil && Date.now() < quotaBackoffUntil) {
    const minutesRemaining = Math.ceil((quotaBackoffUntil - Date.now()) / 60000);
    console.log(`[Worker] ⏸️  Quota exhausted. Resuming in ~${minutesRemaining} minutes`);
    return;
  }

  // Reset quota flag if backoff period has passed
  if (quotaExhausted && quotaBackoffUntil && Date.now() >= quotaBackoffUntil) {
    console.log('[Worker] ✅ Quota backoff period ended. Resuming processing...');
    quotaExhausted = false;
    quotaBackoffUntil = null;
  }

  isProcessing = true;

  try {
    // Get pending bookmarks - NEWEST FIRST so fresh saves from the extension
    // get processed immediately instead of waiting behind bulk imports
    const { data: pendingBookmarks, error } = await supabaseAdmin
      .from('bookmarks')
      .select('*')
      .eq('processing_status', 'pending')
      .order('created_at', { ascending: false })
      .limit(BATCH_SIZE);

    if (error) {
      console.error('[Worker] Error fetching pending bookmarks:', error);
      return;
    }

    if (pendingBookmarks && pendingBookmarks.length > 0) {
      const mode = ENABLE_PARALLEL_PROCESSING ? 'parallel' : 'sequential';
      console.log(`\n[Worker] Found ${pendingBookmarks.length} pending bookmark(s) - Processing in ${mode} mode`);

      let results;

      // Choose processing mode based on configuration
      if (ENABLE_PARALLEL_PROCESSING) {
        results = await processBookmarksInParallel(pendingBookmarks);
      } else {
        results = await processBookmarksSequentially(pendingBookmarks);
      }

      const { successful, failed, quotaHit } = results;
      console.log(`[Worker] Batch complete: ${successful} successful, ${failed} failed/pending`);
      
      if (successful > 0 && !quotaHit) {
        currentQuotaBackoffMs = 10000; // Reset backoff on success
      }
    }

  } catch (error) {
    console.error('[Worker] Error in poll cycle:', error);
  } finally {
    isProcessing = false;
  }
}

let isLazyScraping = false;
const LAZY_SCRAPE_INTERVAL_MS = 15000; // Check every 15 seconds

/**
 * Poll for completed metadata-only bookmarks and lazy-scrape their full content
 */
export async function pollAndLazyScrape() {
  if (isLazyScraping) {
    return;
  }

  // Check if quota is exhausted and we're still in backoff period
  if (quotaExhausted && quotaBackoffUntil && Date.now() < quotaBackoffUntil) {
    return;
  }

  isLazyScraping = true;

  try {
    // Find one bookmark at a time that has been fast-processed (metadata method)
    const { data: bookmarks, error } = await supabaseAdmin
      .from('bookmarks')
      .select('*')
      .eq('processing_status', 'completed')
      .eq('extraction_method', 'metadata')
      .order('created_at', { ascending: true }) // Process oldest first
      .limit(1);

    if (error) {
      console.error('[Worker] Error fetching bookmarks for lazy scraping:', error);
      return;
    }

    if (bookmarks && bookmarks.length > 0) {
      const bookmark = bookmarks[0];
      console.log(`\n[Worker] [Phase 2] Lazy scraping bookmark ${bookmark.id}: ${bookmark.url}`);
      
      // Update method to 'scraping' to lock it
      await updateBookmarkRecord(bookmark.id, {
        extraction_method: 'scraping'
      });

      try {
        // Step 1: Extract page content
        let extracted;
        if (isSupportedDocument(bookmark.url)) {
          console.log(`[Worker] [Phase 2] Extracting document: ${bookmark.url}`);
          extracted = await extractDocumentContent(bookmark.url);
        } else {
          console.log(`[Worker] [Phase 2] Extracting webpage content: ${bookmark.url}`);
          extracted = await extractContent(bookmark.url);
          if (!extracted.favicon) {
            extracted.favicon = getFaviconUrl(bookmark.url);
          }
        }

        // Step 2: Summarize and embed with Gemini
        console.log(`[Worker] [Phase 2] Summarizing and embedding with Gemini...`);
        let aiResult;
        let qdrantPointIds;

        if (ENABLE_CHUNKING) {
          aiResult = await processContentWithChunking(extracted.content, bookmark.url, bookmark.title);
          
          // Delete old metadata-only point in Qdrant (prevent duplicates)
          if (bookmark.qdrant_point_id) {
            await deleteBookmark(bookmark.qdrant_point_id);
          }
          await deleteBookmarkChunks(bookmark.id);

          // Store new chunks in Qdrant
          qdrantPointIds = await createBookmarkChunks(bookmark.user_id, {
            bookmark_id: bookmark.id,
            url: bookmark.url,
            title: aiResult.title,
            description: aiResult.description,
            content: extracted.content,
            tags: aiResult.tags || [],
            chunks: aiResult.chunks,
            favicon_url: extracted.favicon || null,
            folder_path: bookmark.folder_path || null,
            folder_id: bookmark.folder_id || null,
            cover_image: extracted.cover_image || null,
            extracted_images: extracted.extracted_images || [],
            created_at: bookmark.created_at
          });
        } else {
          aiResult = await processContent(extracted.content, bookmark.url);

          if (bookmark.qdrant_point_id) {
            await deleteBookmark(bookmark.qdrant_point_id);
          }

          const qdrantPointId = await createBookmark(bookmark.user_id, {
            url: bookmark.url,
            title: aiResult.title,
            description: aiResult.description,
            content: extracted.content,
            embedding: aiResult.embedding,
            tags: aiResult.tags || [],
            favicon_url: extracted.favicon || null,
            folder_path: bookmark.folder_path || null,
            folder_id: bookmark.folder_id || null,
            cover_image: extracted.cover_image || null,
            extracted_images: extracted.extracted_images || [],
            created_at: bookmark.created_at
          });

          qdrantPointIds = [qdrantPointId];
        }

        // Step 3: Update Supabase with completion
        await updateBookmarkRecord(bookmark.id, {
          title: aiResult.title,
          description: aiResult.description,
          tags: aiResult.tags || [],
          qdrant_point_id: qdrantPointIds[0],
          extraction_method: extracted.method === 'pdf-parse' || extracted.method === 'mammoth' ? 'document-service' : 'readability',
          cover_image: extracted.cover_image || null,
          extracted_images: extracted.extracted_images || [],
          author: extracted.author || null,
          site_name: extracted.site_name || null,
          favicon_url: extracted.favicon || null,
          published_date: extracted.published_date || null,
          reading_time: extracted.reading_time || null,
          language: extracted.language || null,
          error_message: null
        });

        console.log(`[Worker] ✅ [Phase 2] Successfully lazy-scraped bookmark ${bookmark.id}`);
        currentQuotaBackoffMs = 10000; // Reset backoff on success
      } catch (scrapeError) {
        console.error(`[Worker] ❌ [Phase 2] Lazy scraping failed for ${bookmark.id}:`, scrapeError.message);

        if (isQuotaError(scrapeError)) {
          // If Gemini API quota limit is hit, revert to 'metadata' to retry later, and wait
          await updateBookmarkRecord(bookmark.id, {
            extraction_method: 'metadata'
          });
          // Set backoff
          quotaExhausted = true;
          currentQuotaBackoffMs = Math.min(currentQuotaBackoffMs * 2, 5 * 60 * 1000); // Double backoff, max 5 minutes
          quotaBackoffUntil = Date.now() + currentQuotaBackoffMs;
          console.log(`[Worker] [Phase 2] Quota exceeded. Backing off for ${currentQuotaBackoffMs / 1000}s (Until ${new Date(quotaBackoffUntil).toLocaleTimeString()})`);
          throw scrapeError;
        }

        // If it's a permanent page access/scraping error, keep it completed but set method to 'metadata-failed'
        await updateBookmarkRecord(bookmark.id, {
          extraction_method: 'metadata-failed',
          error_message: `Lazy scrape failed: ${scrapeError.message}`
        });
      }
    }
  } catch (error) {
    console.error('[Worker] Error in lazy scrape cycle:', error);
  } finally {
    isLazyScraping = false;
  }
}

/**
 * Reset bookmarks stuck in 'processing' status back to 'pending'
 * This handles orphans from previous crashes/restarts
 */
async function resetStaleJobs() {
  try {
    console.log('[Worker] Checking for stale "processing" and "scraping" jobs...');
    
    // Any bookmark stuck in 'processing' or 'scraping' for more than 30 minutes is likely orphaned
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    
    // 1. Reset Phase 1 stale jobs (processing -> pending)
    const { count: phase1Count, error: error1 } = await supabaseAdmin
      .from('bookmarks')
      .update({ 
        processing_status: 'pending',
        error_message: 'Stale job reset by worker' 
      })
      .eq('processing_status', 'processing')
      .lt('updated_at', thirtyMinutesAgo);

    if (error1) throw error1;

    // 2. Reset Phase 2 stale scraping jobs (scraping -> metadata)
    const { count: phase2Count, error: error2 } = await supabaseAdmin
      .from('bookmarks')
      .update({
        extraction_method: 'metadata',
        error_message: 'Stale Phase 2 scraping job reset by worker'
      })
      .eq('extraction_method', 'scraping')
      .lt('updated_at', thirtyMinutesAgo);

    if (error2) throw error2;
    
    if (phase1Count > 0 || phase2Count > 0) {
      if (phase1Count > 0) {
        console.log(`[Worker] 🔄 Reset ${phase1Count} stale "processing" bookmarks back to "pending"`);
      }
      if (phase2Count > 0) {
        console.log(`[Worker] 🔄 Reset ${phase2Count} stale "scraping" bookmarks back to "metadata"`);
      }
    } else {
      console.log('[Worker] No stale jobs found.');
    }
  } catch (error) {
    console.error('[Worker] Error resetting stale jobs:', error.message);
  }
}

/**
 * Start the background worker
 */
export function startWorker() {
  if (workerRunning) {
    console.log('[Worker] Already running');
    return;
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log('🤖 Starting Bookmark Processing Worker');
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📊 Poll interval: ${POLL_INTERVAL_MS / 1000}s`);
  console.log(`🔄 Max retries: ${MAX_RETRIES}`);
  console.log(`📦 Batch size: ${BATCH_SIZE}`);
  console.log(`⚡ Processing mode: ${ENABLE_PARALLEL_PROCESSING ? 'PARALLEL' : 'SEQUENTIAL'}`);
  if (ENABLE_PARALLEL_PROCESSING) {
    console.log(`🚀 Concurrency: ${CONCURRENCY} bookmarks at a time`);
  }
  console.log(`🧩 Chunking: ${ENABLE_CHUNKING ? 'ENABLED (improved search quality)' : 'DISABLED (legacy mode)'}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  workerRunning = true;

  // Run cleanup and start polling loop
  (async () => {
    await resetStaleJobs();
    
    // Start polling loop
    setInterval(pollAndProcess, POLL_INTERVAL_MS);
    setInterval(pollAndLazyScrape, LAZY_SCRAPE_INTERVAL_MS);

    // Run immediately on start
    pollAndProcess();
    pollAndLazyScrape();
  })();
}

/**
 * Stop the worker (for graceful shutdown)
 */
export function stopWorker() {
  if (workerRunning) {
    console.log('[Worker] Stopping...');
    workerRunning = false;
    // Note: setInterval can't be easily stopped without keeping reference
    // In production, use a proper job queue like Bull
  }
}

// Import supabaseAdmin for worker queries
import { supabaseAdmin } from '../config/supabase.js';

/**
 * Get current background worker health stats
 */
export function getWorkerHealth() {
  return {
    workerRunning,
    isProcessing,
    isLazyScraping,
    quotaExhausted,
    quotaBackoffUntil: quotaBackoffUntil ? new Date(quotaBackoffUntil).toISOString() : null,
    currentQuotaBackoffMs,
    concurrencyLimit: CONCURRENCY,
    parallelProcessing: ENABLE_PARALLEL_PROCESSING,
    chunkingEnabled: ENABLE_CHUNKING
  };
}
