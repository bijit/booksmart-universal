/**
 * User Preferences Routes
 *
 * Handles user preferences and settings
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getUserPreferences, upsertUserPreferences } from '../services/supabase.service.js';

const router = Router();

// All preference routes require authentication
router.use(requireAuth);

/**
 * GET /api/preferences
 * Get current user's preferences
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;

    const preferences = await getUserPreferences(userId);

    res.json({
      preferences: {
        default_tags: preferences.default_tags || [],
        auto_extract: preferences.auto_extract !== false, // Default true
        search_threshold: preferences.search_threshold || 0.5,
        max_results: preferences.max_results || 20,
        created_at: preferences.created_at,
        updated_at: preferences.updated_at
      }
    });

  } catch (error) {
    console.error('Get preferences error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get preferences'
    });
  }
});

/**
 * PUT /api/preferences
 * Update user preferences
 */
router.put('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { default_tags, auto_extract, search_threshold, max_results } = req.body;

    // Validate inputs
    const updates = {};

    if (default_tags !== undefined) {
      if (!Array.isArray(default_tags)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'default_tags must be an array'
        });
      }
      updates.default_tags = default_tags;
    }

    if (auto_extract !== undefined) {
      if (typeof auto_extract !== 'boolean') {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'auto_extract must be a boolean'
        });
      }
      updates.auto_extract = auto_extract;
    }

    if (search_threshold !== undefined) {
      const threshold = parseFloat(search_threshold);
      if (isNaN(threshold) || threshold < 0 || threshold > 1) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'search_threshold must be a number between 0 and 1'
        });
      }
      updates.search_threshold = threshold;
    }

    if (max_results !== undefined) {
      const maxRes = parseInt(max_results);
      if (isNaN(maxRes) || maxRes < 1 || maxRes > 100) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'max_results must be a number between 1 and 100'
        });
      }
      updates.max_results = maxRes;
    }

    // Update preferences
    const updatedPreferences = await upsertUserPreferences(userId, updates);

    res.json({
      message: 'Preferences updated successfully',
      preferences: {
        default_tags: updatedPreferences.default_tags || [],
        auto_extract: updatedPreferences.auto_extract !== false,
        search_threshold: updatedPreferences.search_threshold || 0.5,
        max_results: updatedPreferences.max_results || 20,
        updated_at: updatedPreferences.updated_at
      }
    });

  } catch (error) {
    console.error('Update preferences error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update preferences'
    });
  }
});

/**
 * PATCH /api/preferences
 * Partially update user preferences (same as PUT for now)
 */
router.patch('/', async (req, res) => {
  // Reuse PUT logic for partial updates
  return router.put('/', req, res);
});

export default router;
