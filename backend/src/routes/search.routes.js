/**
 * Search Routes
 *
 * Handles semantic and hybrid search for bookmarks
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { semanticSearch, hybridSearch, searchByTags } from '../services/search.service.js';
import { parseSearchIntent } from '../services/gemini.service.js';

const router = Router();

// All search routes require authentication
router.use(requireAuth);

/**
 * POST /api/search
 * Perform semantic or hybrid search on bookmarks
 */
router.post('/', async (req, res) => {
  try {
    const { query, tags, startDate, endDate, limit, scoreThreshold, searchType, folderPath, offset } = req.body;
    const userId = req.user.id;

    // Validate input
    if (typeof query !== 'string') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Query is required and must be a string'
      });
    }

    const isPureFilter = query.trim().length === 0 && (tags || folderPath);
    if (!isPureFilter && query.trim().length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Query is required and must be a non-empty string'
      });
    }

    let effectiveQuery = query;
    let effectiveTags = tags;
    let effectiveStartDate = startDate;
    let effectiveEndDate = endDate;

    const deepSearch = req.body.deepSearch === true || req.body.deepSearch === 'true';

    // AI Intent Parsing for natural language queries (only if deepSearch is enabled)
    if (deepSearch && query.split(' ').length > 3) {
      try {
        console.log('[Search] Deep search enabled: Parsing intent...');
        const intent = await parseSearchIntent(query);
        effectiveQuery = intent.refinedQuery;
        // Merge AI-extracted filters with existing ones (existing take precedence if provided)
        effectiveTags = tags || intent.tags;
        effectiveStartDate = startDate || intent.startDate;
        effectiveEndDate = endDate || intent.endDate;
      } catch (err) {
        console.warn('[Search] Intent parsing failed, falling back to raw query:', err.message);
      }
    }

    const options = {
      limit: parseInt(limit) || 20,
      offset: parseInt(offset) || 0,
      tags: Array.isArray(effectiveTags) ? effectiveTags : null,
      startDate: effectiveStartDate || null,
      endDate: effectiveEndDate || null,
      folderPath: folderPath || null,
      scoreThreshold: parseFloat(scoreThreshold) || 0.5,
      deepSearch, // Pass the deep search flag
      generateAnswer: req.body.generateAnswer !== false // Default to true if not specified
    };

    // Validate limits
    const maxLimit = isPureFilter ? 10000 : 100;
    if (options.limit < 1 || options.limit > maxLimit) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Limit must be between 1 and ${maxLimit}`
      });
    }

    if (options.scoreThreshold < 0 || options.scoreThreshold > 1) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Score threshold must be between 0 and 1'
      });
    }

    // Perform search based on type
    let searchData;
    const type = searchType || 'hybrid';  // Default to hybrid

    if (isPureFilter) {
      const { getBookmarksByUser } = await import('../services/qdrant.service.js');
      const results = await getBookmarksByUser(userId, {
        limit: options.limit,
        offset: options.offset,
        tags: options.tags,
        folderPath: options.folderPath
      });
      
      // De-duplicate by bookmark_id to get unique bookmarks
      const bookmarkMap = new Map();
      for (const item of results) {
        const id = item.bookmark_id || item.id;
        if (!bookmarkMap.has(id)) {
          bookmarkMap.set(id, item);
        }
      }
      const uniqueResults = Array.from(bookmarkMap.values()).slice(0, options.limit);
      searchData = { results: uniqueResults, answer: null };
    } else if (type === 'semantic') {
      const results = await semanticSearch(userId, effectiveQuery, options);
      searchData = { results, answer: null };
    } else if (type === 'hybrid') {
      searchData = await hybridSearch(userId, effectiveQuery, options);
    } else {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Search type must be "semantic" or "hybrid"'
      });
    }

    const { results, answer } = searchData;

    res.json({
      query,
      searchType: type,
      answer, // New RAG answer field
      results: results.map(r => ({
        id: r.id,
        url: r.url,
        title: r.title,
        description: r.description,
        tags: r.tags || [],
        created_at: r.created_at,
        score: r.rerank_score || r.hybrid_score || r.score,
        hybrid_score: r.hybrid_score,
        rerank_score: r.rerank_score,
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

/**
 * POST /api/search/web-query
 * Generate a refined web search query based on context
 */
router.post('/web-query', async (req, res) => {
  try {
    const { query, overview } = req.body;

    if (!query || !overview) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'query and overview are required'
      });
    }

    const { generateWebSearchQuery } = await import('../services/gemini.service.js');
    const refinedQuery = await generateWebSearchQuery(query, overview);

    res.json({
      originalQuery: query,
      refinedQuery
    });
  } catch (error) {
    console.error('Web query generation error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to generate web search query'
    });
  }
});

export default router;
