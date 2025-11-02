/**
 * Debug Routes
 *
 * Temporary routes for debugging issues
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { supabaseAdmin } from '../config/supabase.js';

const router = Router();

/**
 * GET /api/debug/pending-bookmarks
 * Check how many pending bookmarks exist
 */
router.get('/pending-bookmarks', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user's pending bookmarks
    const { data: userPending, error: userError } = await supabaseAdmin
      .from('bookmarks')
      .select('id, url, title, processing_status, created_at, retry_count, error_message')
      .eq('user_id', userId)
      .eq('processing_status', 'pending')
      .order('created_at', { ascending: true });

    if (userError) {
      throw userError;
    }

    // Get ALL pending bookmarks (for debugging)
    const { data: allPending, error: allError, count: totalCount } = await supabaseAdmin
      .from('bookmarks')
      .select('id, user_id, processing_status', { count: 'exact' })
      .eq('processing_status', 'pending');

    if (allError) {
      throw allError;
    }

    // Get processing bookmarks
    const { data: processing, error: processingError } = await supabaseAdmin
      .from('bookmarks')
      .select('id, user_id, processing_status')
      .eq('processing_status', 'processing');

    res.json({
      yourPendingBookmarks: userPending?.length || 0,
      yourBookmarks: userPending || [],
      totalPendingAcrossAllUsers: allPending?.length || 0,
      currentlyProcessing: processing?.length || 0,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Debug pending bookmarks error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

/**
 * GET /api/debug/bookmark-stats
 * Get overall bookmark statistics
 */
router.get('/bookmark-stats', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get counts by status for user
    const { data: userStats, error: userError } = await supabaseAdmin
      .from('bookmarks')
      .select('processing_status')
      .eq('user_id', userId);

    if (userError) {
      throw userError;
    }

    const stats = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0
    };

    userStats?.forEach(bookmark => {
      const status = bookmark.processing_status || 'unknown';
      if (stats[status] !== undefined) {
        stats[status]++;
      }
    });

    res.json({
      userId,
      stats,
      total: userStats?.length || 0,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Debug stats error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

export default router;
