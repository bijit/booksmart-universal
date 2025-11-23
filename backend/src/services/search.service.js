/**
 * Search Service
 *
 * Provides semantic search capabilities using Qdrant vector search
 * and hybrid search combining vector similarity with text matching
 */

import { generateEmbedding, rerankResults } from './gemini.service.js';
import { searchBookmarks as searchQdrant, searchChunks } from './qdrant.service.js';
import { createSearchHistory } from './supabase.service.js';
// import { scoreBM25, enhancedTextMatch } from '../utils/text-matching.js'; // Disabled for semantic-only search

// Configuration: Enable chunked search (set to false to use legacy non-chunked search)
const ENABLE_CHUNKED_SEARCH = true;

// Configuration: Enable LLM-based reranking for top results (higher quality but slower)
// Set to false for faster search (trades quality for speed)
const ENABLE_RERANKING = false;

/**
 * Aggregate chunks by parent bookmark and select best score
 *
 * @param {Array} chunks - Array of chunk search results
 * @param {number} limit - Number of bookmarks to return
 * @returns {Array} Aggregated bookmarks with best scores
 */
function aggregateChunksByBookmark(chunks, limit = 10) {
  // Group chunks by bookmark_id
  const bookmarkMap = new Map();

  for (const chunk of chunks) {
    const bookmarkId = chunk.bookmark_id;

    if (!bookmarkMap.has(bookmarkId)) {
      // First chunk for this bookmark
      bookmarkMap.set(bookmarkId, {
        bookmark_id: bookmarkId,
        url: chunk.url,
        title: chunk.title,
        description: chunk.description,
        content: chunk.content,
        tags: chunk.tags,
        favicon_url: chunk.favicon_url,
        created_at: chunk.created_at,
        updated_at: chunk.updated_at,
        // Keep track of best matching chunk
        best_chunk: {
          score: chunk.score,
          chunk_index: chunk.chunk_index,
          chunk_text: chunk.chunk_text
        },
        // Keep track of all chunks for this bookmark
        matching_chunks: [{
          chunk_index: chunk.chunk_index,
          score: chunk.score,
          chunk_text: chunk.chunk_text.substring(0, 200) + '...' // Preview only
        }]
      });
    } else {
      // Additional chunk for existing bookmark
      const bookmark = bookmarkMap.get(bookmarkId);

      // Update best score if this chunk is better
      if (chunk.score > bookmark.best_chunk.score) {
        bookmark.best_chunk = {
          score: chunk.score,
          chunk_index: chunk.chunk_index,
          chunk_text: chunk.chunk_text
        };
      }

      // Add to matching chunks list
      bookmark.matching_chunks.push({
        chunk_index: chunk.chunk_index,
        score: chunk.score,
        chunk_text: chunk.chunk_text.substring(0, 200) + '...'
      });
    }
  }

  // Convert map to array and sort by best score
  const bookmarks = Array.from(bookmarkMap.values())
    .sort((a, b) => b.best_chunk.score - a.best_chunk.score)
    .slice(0, limit)
    .map(bookmark => ({
      id: bookmark.bookmark_id,
      url: bookmark.url,
      title: bookmark.title,
      description: bookmark.description,
      content: bookmark.content,
      tags: bookmark.tags,
      favicon_url: bookmark.favicon_url,
      created_at: bookmark.created_at,
      updated_at: bookmark.updated_at,
      score: bookmark.best_chunk.score,
      chunk_index: bookmark.best_chunk.chunk_index,
      matching_chunks_count: bookmark.matching_chunks.length,
      matching_chunks: bookmark.matching_chunks.sort((a, b) => b.score - a.score).slice(0, 3) // Top 3 chunks
    }));

  return bookmarks;
}

/**
 * Perform semantic search on bookmarks (with chunking support)
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
      scoreThreshold = 0.5  // Higher threshold to filter out weak/irrelevant matches
    } = options;

    console.log(`[Search] Semantic search: "${query}" for user ${userId}`);
    console.log(`[Search] Mode: ${ENABLE_CHUNKED_SEARCH ? 'CHUNKED' : 'LEGACY'}`);

    // Step 1: Generate embedding for the search query
    console.log('[Search] Generating query embedding...');
    const queryEmbedding = await generateEmbedding(query);
    console.log(`[Search] Query embedding generated: ${queryEmbedding.length}D`);

    let results;

    if (ENABLE_CHUNKED_SEARCH) {
      // Step 2a: Search chunks (get more chunks to allow aggregation)
      console.log(`[Search] Searching chunks (limit: ${limit * 5}, threshold: ${scoreThreshold})...`);
      const chunkResults = await searchChunks(userId, queryEmbedding, {
        limit: limit * 5, // Fetch more chunks to aggregate into top bookmarks
        tags,
        scoreThreshold
      });

      console.log(`[Search] Found ${chunkResults.length} matching chunks`);

      // Step 3a: Aggregate chunks by parent bookmark
      results = aggregateChunksByBookmark(chunkResults, limit);

      console.log(`[Search] Aggregated into ${results.length} unique bookmarks`);
    } else {
      // Step 2b: Legacy search (non-chunked)
      console.log(`[Search] Searching Qdrant (limit: ${limit}, threshold: ${scoreThreshold})...`);
      results = await searchQdrant(userId, queryEmbedding, {
        limit,
        tags,
        scoreThreshold
      });

      console.log(`[Search] Found ${results.length} results`);
    }

    // Step 4: Record search in history (fire and forget)
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
      scoreThreshold = 0.5  // Higher threshold to filter out irrelevant results
    } = options;

    console.log(`[Search] Hybrid search: "${query}" for user ${userId}`);

    // Get semantic results with higher limit for re-ranking
    const semanticResults = await semanticSearch(userId, query, {
      limit: limit * 3,  // Get more results for better re-ranking with BM25
      tags,
      scoreThreshold
    });

    if (semanticResults.length === 0) {
      console.log('[Search] No semantic results found');
      return [];
    }

    // Use semantic scores only (BM25/text matching disabled for better quality)
    console.log(`[Search] Using semantic-only ranking for ${semanticResults.length} results...`);

    const scoredResults = semanticResults.map(result => {
      const semanticScore = result.score; // Vector similarity score (0-1)

      // Use semantic score as hybrid score (100% semantic, 0% BM25, 0% text match)
      const hybridScore = semanticScore;

      return {
        ...result,
        semantic_score: semanticScore,
        bm25_score: 0, // Disabled
        text_match_score: 0, // Disabled
        hybrid_score: hybridScore
      };
    });

    // Sort by semantic score and limit (already sorted, but ensure correct order)
    let rankedResults = scoredResults
      .sort((a, b) => b.hybrid_score - a.hybrid_score)
      .slice(0, limit);

    // Apply LLM-based reranking if enabled (for premium quality)
    if (ENABLE_RERANKING && rankedResults.length > 1) {
      console.log(`[Search] Applying LLM-based reranking to top ${rankedResults.length} results...`);
      rankedResults = await rerankResults(query, rankedResults);
    }

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
