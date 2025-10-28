/**
 * Search Service
 *
 * Provides semantic search capabilities using Qdrant vector search
 * and hybrid search combining vector similarity with text matching
 */

import { generateEmbedding } from './gemini.service.js';
import { searchBookmarks as searchQdrant } from './qdrant.service.js';
import { createSearchHistory } from './supabase.service.js';

/**
 * Perform semantic search on bookmarks
 *
 * @param {string} userId - User ID performing the search
 * @param {string} query - Natural language search query
 * @param {Object} options - Search options (limit, tags, threshold)
 * @returns {Promise<Array>} Array of matching bookmarks with scores
 */
export async function semanticSearch(userId, query, options = {}) {
  try {
    const {
      limit = 10,
      tags = null,
      scoreThreshold = 0.35  // Balanced threshold for good recall without noise
    } = options;

    console.log(`[Search] Semantic search: "${query}" for user ${userId}`);

    // Step 1: Generate embedding for the search query
    console.log('[Search] Generating query embedding...');
    const queryEmbedding = await generateEmbedding(query);
    console.log(`[Search] Query embedding generated: ${queryEmbedding.length}D`);

    // Step 2: Search Qdrant with the query embedding
    console.log(`[Search] Searching Qdrant (limit: ${limit}, threshold: ${scoreThreshold})...`);
    const results = await searchQdrant(userId, queryEmbedding, {
      limit,
      tags,
      scoreThreshold
    });

    console.log(`[Search] Found ${results.length} results`);

    // Step 3: Record search in history (fire and forget)
    createSearchHistory(userId, {
      query,
      filters: { tags, scoreThreshold },
      result_count: results.length
    }).catch(err => console.error('[Search] Failed to save search history:', err));

    return results;

  } catch (error) {
    console.error('[Search] Semantic search failed:', error);
    throw new Error(`Search failed: ${error.message}`);
  }
}

/**
 * Perform hybrid search (semantic + text matching)
 *
 * Combines vector similarity search with traditional text search
 * Uses a weighted approach: 60% semantic, 40% text matching
 *
 * @param {string} userId - User ID performing the search
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @returns {Promise<Array>} Ranked results combining both methods
 */
export async function hybridSearch(userId, query, options = {}) {
  try {
    const {
      limit = 10,
      tags = null,
      scoreThreshold = 0.25  // Lower threshold for hybrid (gets boosted by text matching)
    } = options;

    console.log(`[Search] Hybrid search: "${query}" for user ${userId}`);

    // Get semantic results with higher limit for re-ranking
    const semanticResults = await semanticSearch(userId, query, {
      limit: limit * 2,  // Get more results for better re-ranking
      tags,
      scoreThreshold
    });

    // For now, we'll use semantic results only
    // In a production system, you'd combine with text search from Supabase
    // and implement a scoring algorithm

    // Simple text matching bonus: boost results where query terms appear in title
    const queryTerms = query.toLowerCase().split(/\s+/);

    const scoredResults = semanticResults.map(result => {
      let score = result.score; // Start with semantic score (0-1)

      // Add text matching bonus
      const title = (result.title || '').toLowerCase();
      const description = (result.description || '').toLowerCase();

      let textMatchScore = 0;
      for (const term of queryTerms) {
        if (title.includes(term)) textMatchScore += 0.3;
        if (description.includes(term)) textMatchScore += 0.1;
      }

      // Weighted combination: 60% semantic, 40% text
      const hybridScore = (score * 0.6) + (Math.min(textMatchScore, 1.0) * 0.4);

      return {
        ...result,
        semantic_score: score,
        text_match_score: textMatchScore,
        hybrid_score: hybridScore
      };
    });

    // Sort by hybrid score and limit
    const rankedResults = scoredResults
      .sort((a, b) => b.hybrid_score - a.hybrid_score)
      .slice(0, limit);

    console.log(`[Search] Hybrid search completed: ${rankedResults.length} results`);

    return rankedResults;

  } catch (error) {
    console.error('[Search] Hybrid search failed:', error);
    throw new Error(`Hybrid search failed: ${error.message}`);
  }
}

/**
 * Search by tags only (no semantic search needed)
 *
 * @param {string} userId - User ID
 * @param {Array<string>} tags - Tags to search for
 * @param {Object} options - Search options
 * @returns {Promise<Array>} Bookmarks matching tags
 */
export async function searchByTags(userId, tags, options = {}) {
  try {
    const { limit = 50 } = options;

    console.log(`[Search] Tag search: ${tags.join(', ')} for user ${userId}`);

    const { getBookmarksByUser } = await import('./qdrant.service.js');
    const results = await getBookmarksByUser(userId, {
      limit,
      tags
    });

    console.log(`[Search] Found ${results.length} results for tags`);

    return results;

  } catch (error) {
    console.error('[Search] Tag search failed:', error);
    throw new Error(`Tag search failed: ${error.message}`);
  }
}
