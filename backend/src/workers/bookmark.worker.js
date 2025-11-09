/**
 * Bookmark Processing Worker
 *
 * Background worker that processes pending bookmarks through the AI pipeline:
 * 1. Extract content (Jina)
 * 2. Summarize & embed (Gemini)
 * 3. Store in Qdrant
 * 4. Update Supabase status
 */

import { extractContent } from '../services/jina.service.js';
import { processContent, summarizeFromMetadata, generateEmbedding } from '../services/gemini.service.js';
import { createBookmark } from '../services/qdrant.service.js';
import {
  getUserBookmarkRecords,
  updateBookmarkRecord,
  deleteBookmarkRecord
} from '../services/supabase.service.js';
import { isQuotaError } from '../utils/errors.js';

// Worker configuration
const POLL_INTERVAL_MS = 5000; // Check for new bookmarks every 5 seconds
const MAX_RETRIES = 3;
const BATCH_SIZE = 5; // Process up to 5 bookmarks concurrently
const QUOTA_BACKOFF_MS = 60 * 60 * 1000; // Back off for 1 hour when quota is hit

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
      favicon_url: null
    });

    // Step 4: Update Supabase with completion
    await updateBookmarkRecord(id, {
      title: summary.title,
      qdrant_point_id: qdrantPointId,
      processing_status: 'completed',
      extraction_method: 'metadata-only', // Mark as fallback method
      error_message: 'Content extraction failed, processed using metadata only'
    });

    console.log(`[Worker] ✅ Successfully processed ${id} using metadata-only fallback`);
    return true;

  } catch (error) {
    console.error(`[Worker] ❌ Metadata-only processing failed for ${id}:`, error.message);
    throw error;
  }
}

/**
 * Process a single bookmark through the AI pipeline
 *
 * @param {Object} bookmark - The bookmark record from Supabase
 * @returns {Promise<boolean>} True if successful, false if failed
 */
async function processBookmark(bookmark) {
  const { id, url, title, user_id, retry_count } = bookmark;

  console.log(`\n[Worker] Processing bookmark ${id}: ${url}`);

  try {
    // Step 1: Update status to "processing"
    await updateBookmarkRecord(id, {
      processing_status: 'processing'
    });

    // Step 2: Extract content with Jina
    console.log(`[Worker] Step 1/4: Extracting content...`);
    const extracted = await extractContent(url);

    // Step 3: Process with Gemini (summarize + embed)
    console.log(`[Worker] Step 2/4: Generating AI summary and embeddings...`);
    const aiResult = await processContent(extracted.content, url);

    // Step 4: Store in Qdrant
    console.log(`[Worker] Step 3/4: Storing in vector database...`);
    const qdrantPointId = await createBookmark(user_id, {
      url: url,
      title: aiResult.title,
      description: aiResult.description,
      content: extracted.content,
      embedding: aiResult.embedding,
      tags: aiResult.tags || [], // AI-generated tags
      favicon_url: extracted.favicon || null
    });

    // Step 5: Update Supabase with completion
    console.log(`[Worker] Step 4/4: Updating database...`);
    await updateBookmarkRecord(id, {
      title: aiResult.title,
      qdrant_point_id: qdrantPointId,
      processing_status: 'completed',
      extraction_method: 'jina',
      error_message: null
    });

    console.log(`[Worker] ✅ Successfully processed bookmark ${id}`);
    return true;

  } catch (error) {
    console.error(`[Worker] ❌ Error processing bookmark ${id}:`, error.message);

    // Check if this is a permanent HTTP error (404, 403, 410)
    const is404 = error.message && error.message.includes('404');
    const is403 = error.message && error.message.includes('403');
    const is410 = error.message && error.message.includes('410');

    if (is404 || is403 || is410) {
      let errorMsg = 'Page not accessible';
      if (is404) errorMsg = 'Page not found (404) - URL may be deleted or expired';
      if (is403) errorMsg = 'Access forbidden (403) - Page may require authentication';
      if (is410) errorMsg = 'Page gone (410) - Content permanently deleted';

      console.log(`[Worker] 🗑️  ${errorMsg} for ${id}, deleting bookmark`);

      // Delete the bookmark entirely - no point keeping dead links
      await deleteBookmarkRecord(id);

      return false; // Don't retry
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
      console.log(`\n[Worker] Found ${pendingBookmarks.length} pending bookmark(s)`);

      // Process bookmarks sequentially to stop immediately on quota error
      let successful = 0;
      let failed = 0;

      for (const bookmark of pendingBookmarks) {
        try {
          const result = await processBookmark(bookmark);
          if (result) {
            successful++;
          } else {
            failed++;
          }
        } catch (error) {
          if (error.message === 'QUOTA_EXHAUSTED') {
            console.log(`[Worker] 🚫 Stopping batch processing due to quota exhaustion`);
            break; // Stop processing more bookmarks
          }
          failed++;
        }
      }

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
