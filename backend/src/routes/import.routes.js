/**
 * Import Routes
 *
 * Handles bulk bookmark imports
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  createBookmarkRecord,
  checkBookmarkExists,
  getUserBookmarkCount
} from '../services/supabase.service.js';
import {
  createImportJob,
  getImportJob,
  getUserImportJobs,
  updateImportJobProgress
} from '../services/import.service.js';

const router = Router();

// All import routes require authentication
router.use(requireAuth);

/**
 * POST /api/import/batch
 * Create a batch import job
 *
 * Body: {
 *   bookmarks: [{ url: string, title?: string }]
 * }
 */
router.post('/batch', async (req, res) => {
  try {
    const { bookmarks } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!bookmarks || !Array.isArray(bookmarks) || bookmarks.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'bookmarks array is required and must not be empty'
      });
    }

    // Validate bookmark format
    for (const bookmark of bookmarks) {
      if (!bookmark.url) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Each bookmark must have a url field'
        });
      }

      // Validate URL format
      try {
        new URL(bookmark.url);
      } catch (error) {
        return res.status(400).json({
          error: 'Bad Request',
          message: `Invalid URL format: ${bookmark.url}`
        });
      }
    }

    // Get current count for logging
    const currentCount = await getUserBookmarkCount(userId);
    console.log(`[Import] User ${userId} currently has ${currentCount} bookmarks, importing ${bookmarks.length} more`);

    // Create import job (no limit - import all bookmarks)
    const jobId = createImportJob(userId, bookmarks.length);

    // Optimized approach: Fetch all existing URLs once
    const existingUrls = await import('../services/supabase.service.js').then(s => s.getAllUserBookmarkUrls(userId));
    
    const toCreate = [];
    let duplicateCount = 0;

    for (const bookmark of bookmarks) {
      if (existingUrls.has(bookmark.url)) {
        duplicateCount++;
      } else {
        toCreate.push({
          url: bookmark.url,
          title: bookmark.title || null,
          processing_status: 'pending'
        });
      }
    }

    // Batch create new records
    let successCount = 0;
    let failCount = 0;

    if (toCreate.length > 0) {
      try {
        const { createBookmarkRecordsBatch } = await import('../services/supabase.service.js');
        const created = await createBookmarkRecordsBatch(userId, toCreate);
        successCount = created.length;
      } catch (error) {
        console.error('[Import] Batch creation failed:', error);
        failCount = toCreate.length;
      }
    }

    // Mark job as completed
    updateImportJobProgress(jobId, {
      status: 'completed',
      processedBookmarks: bookmarks.length,
      successfulBookmarks: successCount,
      failedBookmarks: failCount
    });

    res.status(201).json({
      message: 'Batch import started',
      jobId,
      totalBookmarks: bookmarks.length,
      createdBookmarks: successCount,
      skippedDuplicates: duplicateCount,
      failedBookmarks: failCount,
      currentBookmarkCount: currentCount + successCount
    });

  } catch (error) {
    console.error('Batch import error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to start batch import'
    });
  }
});

/**
 * GET /api/import/:jobId/status
 * Get import job status and progress
 */
router.get('/:jobId/status', async (req, res) => {
  try {
    const { jobId } = req.params;
    const userId = req.user.id;

    const job = getImportJob(jobId);

    if (!job) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Import job not found'
      });
    }

    // Check ownership
    if (job.userId !== userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this import job'
      });
    }

    res.json({
      jobId: job.jobId,
      status: job.status,
      totalBookmarks: job.totalBookmarks,
      processedBookmarks: job.processedBookmarks,
      successfulBookmarks: job.successfulBookmarks,
      failedBookmarks: job.failedBookmarks,
      progress: job.totalBookmarks > 0
        ? Math.round((job.processedBookmarks / job.totalBookmarks) * 100)
        : 0,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt
    });

  } catch (error) {
    console.error('Get import status error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get import status'
    });
  }
});

/**
 * GET /api/import/jobs
 * List all import jobs for authenticated user
 */
router.get('/jobs', async (req, res) => {
  try {
    const userId = req.user.id;

    const jobs = getUserImportJobs(userId);

    res.json({
      jobs: jobs.map(job => ({
        jobId: job.jobId,
        status: job.status,
        totalBookmarks: job.totalBookmarks,
        processedBookmarks: job.processedBookmarks,
        successfulBookmarks: job.successfulBookmarks,
        failedBookmarks: job.failedBookmarks,
        progress: job.totalBookmarks > 0
          ? Math.round((job.processedBookmarks / job.totalBookmarks) * 100)
          : 0,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt
      }))
    });

  } catch (error) {
    console.error('List import jobs error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to list import jobs'
    });
  }
});

export default router;
