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
import { processContent, processContentWithChunking, summarizeFromMetadata, generateEmbedding } from '../services/gemini.service.js';
import { createBookmark, createBookmarkChunks } from '../services/qdrant.service.js';
import {
  getUserBookmarkRecords,
  updateBookmarkRecord,
  deleteBookmarkRecord
} from '../services/supabase.service.js';
import { isQuotaError } from '../utils/errors.js';

// Worker configuration
const POLL_INTERVAL_MS = 1000; // Check for new bookmarks every 1 second (faster batch processing)
const MAX_RETRIES = 3;
const BATCH_SIZE = 50; // Fetch up to 50 bookmarks per poll
const QUOTA_BACKOFF_MS = 60 * 60 * 1000; // Back off for 1 hour when quota is hit

// Parallel processing configuration (set ENABLE_PARALLEL_PROCESSING = false to use sequential)
const ENABLE_PARALLEL_PROCESSING = true; // Toggle between parallel and sequential processing
const CONCURRENCY = 5; // Process 5 bookmarks at a time for faster batch imports

// Chunking configuration (set to true to use improved chunked embedding)
const ENABLE_CHUNKING = true; // Enable chunked embedding for better search quality

let isProcessing = false;
let workerRunning = false;
let quotaExhausted = false;
let quotaBackoffUntil = null;

/**
 * Process bookmark using metadata-only (fallback when content extraction fails)
 */
async function processMetadataOnly(id, url, title, user_id) {
  try {
    console.log(`[Worker] Processing ${id} with metadata-only mode...`);

    // Step 1: Generate summary/tags from URL + title only
    console.log(`[Worker] Step 1/3: Generating metadata-based summary...`);
    const summary = await summarizeFromMetadata(url, title);

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
      favicon_url: getFaviconUrl(url)
    });

    // Step 4: Update Supabase with completion
    await updateBookmarkRecord(id, {
      title: summary.title,
      description: summary.description,
      tags: summary.tags || [],
      qdrant_point_id: qdrantPointId,
      processing_status: 'completed',
      extraction_method: 'metadata-only', // Mark as fallback method
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
  const { id, url, title, user_id, retry_count, extracted_content, extraction_method } = bookmark;

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
        favicon: getFaviconUrl(url) // Generate favicon URL using Google's service
      };
    } else {
      console.log(`[Worker] Step 1/4: No local content, extracting with Readability...`);
      extracted = await extractContent(url);
      // If Readability didn't provide favicon, generate one
      if (!extracted.favicon) {
        extracted.favicon = getFaviconUrl(url);
      }
    }

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
        favicon_url: extracted.favicon || null
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
        favicon_url: extracted.favicon || null
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
      extraction_method: hasValidExtractedContent ? extraction_method : 'readability',
      error_message: null
    });

    console.log(`[Worker] ✅ Successfully processed bookmark ${id}`);
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
      console.log(`[Worker] 🚫 Quota exceeded! Keeping bookmark ${id} in pending state for retry tomorrow`);

      // Set quota backoff flag
      quotaExhausted = true;
      quotaBackoffUntil = Date.now() + QUOTA_BACKOFF_MS;

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
        const fallbackSuccess = await processMetadataOnly(id, url, title, user_id);
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
      batch.map(bookmark => processBookmark(bookmark))
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
      const result = await processBookmark(bookmark);
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
async function pollAndProcess() {
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
    // Get all pending bookmarks across all users
    // Note: This is simplified - in production you'd want pagination
    const { data: pendingBookmarks, error } = await supabaseAdmin
      .from('bookmarks')
      .select('*')
      .eq('processing_status', 'pending')
      .order('created_at', { ascending: true })
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

      const { successful, failed } = results;
      console.log(`[Worker] Batch complete: ${successful} successful, ${failed} failed/pending`);
    }

  } catch (error) {
    console.error('[Worker] Error in poll cycle:', error);
  } finally {
    isProcessing = false;
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

  // Start polling loop
  setInterval(pollAndProcess, POLL_INTERVAL_MS);

  // Run immediately on start
  pollAndProcess();
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
