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
import { processContent } from '../services/gemini.service.js';
import { createBookmark } from '../services/qdrant.service.js';
import {
  getUserBookmarkRecords,
  updateBookmarkRecord
} from '../services/supabase.service.js';

// Worker configuration
const POLL_INTERVAL_MS = 5000; // Check for new bookmarks every 5 seconds
const MAX_RETRIES = 3;
const BATCH_SIZE = 5; // Process up to 5 bookmarks concurrently

let isProcessing = false;
let workerRunning = false;

/**
 * Process a single bookmark through the AI pipeline
 *
 * @param {Object} bookmark - The bookmark record from Supabase
 * @returns {Promise<boolean>} True if successful, false if failed
 */
async function processBookmark(bookmark) {
  const { id, url, user_id, retry_count } = bookmark;

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
      tags: [], // No tags initially, user can add later
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

    // Determine if we should retry
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
      // Max retries exceeded, mark as failed
      await updateBookmarkRecord(id, {
        processing_status: 'failed',
        retry_count: newRetryCount,
        error_message: `Failed after ${MAX_RETRIES} retries: ${error.message}`
      });
      console.log(`[Worker] ❌ Bookmark ${id} failed permanently after ${MAX_RETRIES} retries`);
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

      // Process bookmarks in parallel (up to BATCH_SIZE)
      const results = await Promise.allSettled(
        pendingBookmarks.map(bookmark => processBookmark(bookmark))
      );

      const successful = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
      const failed = results.length - successful;

      console.log(`[Worker] Batch complete: ${successful} successful, ${failed} failed`);
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
