/**
 * Search Routes
 *
 * Handles semantic and hybrid search for bookmarks
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { semanticSearch, hybridSearch, searchByTags } from '../services/search.service.js';

const router = Router();

// All search routes require authentication
router.use(requireAuth);

/**
 * POST /api/search
 * Perform semantic or hybrid search on bookmarks
 */
router.post('/', async (req, res) => {
  try {
    const { query, tags, limit, scoreThreshold, searchType } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Query is required and must be a non-empty string'
      });
    }

    const options = {
      limit: parseInt(limit) || 10,
      tags: Array.isArray(tags) ? tags : null,
      scoreThreshold: parseFloat(scoreThreshold) || 0.35  // Lower threshold for better recall
    };

    // Validate limits
    if (options.limit < 1 || options.limit > 100) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Limit must be between 1 and 100'
      });
    }

    if (options.scoreThreshold < 0 || options.scoreThreshold > 1) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Score threshold must be between 0 and 1'
      });
    }

    // Perform search based on type
    let results;
    const type = searchType || 'hybrid';  // Default to hybrid

    if (type === 'semantic') {
      results = await semanticSearch(userId, query, options);
    } else if (type === 'hybrid') {
      results = await hybridSearch(userId, query, options);
    } else {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Search type must be "semantic" or "hybrid"'
      });
    }

    res.json({
      query,
      searchType: type,
      results: results.map(r => ({
        id: r.id,
        url: r.url,
        title: r.title,
        description: r.description,
        tags: r.tags || [],
        created_at: r.created_at,
        score: r.hybrid_score || r.score,
        ...(type === 'hybrid' && {
          semantic_score: r.semantic_score,
          text_match_score: r.text_match_score
        })
      })),
      total: results.length,
      options: {
        limit: options.limit,
        scoreThreshold: options.scoreThreshold,
        tags: options.tags
      }
    });

  } catch (error) {
    console.error('Search error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Search failed'
    });
  }
});

/**
 * GET /api/search/tags
 * Search bookmarks by tags only (no semantic search)
 */
router.get('/tags', async (req, res) => {
  try {
    const { tags, limit } = req.query;
    const userId = req.user.id;

    if (!tags) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Tags parameter is required'
      });
    }

    const tagArray = Array.isArray(tags) ? tags : [tags];
    const options = {
      limit: parseInt(limit) || 50
    };

    const results = await searchByTags(userId, tagArray, options);

    res.json({
      tags: tagArray,
      results,
      total: results.length
    });

  } catch (error) {
    console.error('Tag search error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Tag search failed'
    });
  }
});

export default router;
