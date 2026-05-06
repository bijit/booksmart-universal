/**
 * Debug Routes
 *
 * Temporary routes for debugging issues
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/debug/pending-bookmarks
 * Check how many pending bookmarks exist
 */
router.get('/pending-bookmarks', requireAuth, async (req, res) => {
  try {
    const { supabaseAdmin } = await import('../config/supabase.js');
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
    const { data: allPending, error: allError } = await supabaseAdmin
      .from('bookmarks')
      .select('id, user_id, processing_status')
      .eq('processing_status', 'pending');

    if (allError) {
      throw allError;
    }

    // Get processing bookmarks
    const { data: processing, error: processingError } = await supabaseAdmin
      .from('bookmarks')
      .select('id, user_id, processing_status')
      .eq('processing_status', 'processing');

    if (processingError) {
      throw processingError;
    }

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
    const { supabaseAdmin } = await import('../config/supabase.js');
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

/**
 * GET /api/debug/info
 * Basic system info for verification
 */
router.get('/info', async (req, res) => {
  try {
    // Dynamic imports to prevent startup blocking
    const { supabase, supabaseAdmin } = await import('../config/supabase.js');
    const { qdrantClient } = await import('../config/qdrant.js');
    const { genAI } = await import('../services/gemini.service.js');

    res.json({
      status: 'online',
      version: '1.0.0',
      nodeVersion: process.version,
      env: {
        hasSupabaseUrl: !!process.env.SUPABASE_URL,
        hasSupabaseAnonKey: !!process.env.SUPABASE_ANON_KEY,
        hasSupabaseServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        hasQdrantUrl: !!process.env.QDRANT_URL,
        hasQdrantApiKey: !!process.env.QDRANT_API_KEY,
        hasGoogleAiApiKey: !!process.env.GOOGLE_AI_API_KEY,
      },
      clients: {
        supabase: !!supabase,
        supabaseAdmin: !!supabaseAdmin,
        qdrant: !!qdrantClient,
        gemini: !!genAI
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Debug info error:', error);
    res.status(500).json({
      error: 'Failed to load debug info',
      message: error.message
    });
  }
});

export default router;
