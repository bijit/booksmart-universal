/**
 * Search Service
 *
 * Provides semantic search capabilities using Qdrant vector search
 * and hybrid search combining vector similarity with text matching
 */

import { 
  generateEmbedding, 
  rerankResults, 
  generateSearchAnswer 
} from './gemini.service.js';
import { searchBookmarks as searchQdrant, searchChunks } from './qdrant.service.js';
import { createSearchHistory } from './supabase.service.js';
import { scoreBM25, enhancedTextMatch } from '../utils/text-matching.js';

// Configuration: Enable chunked search (set to false to use legacy non-chunked search)
const ENABLE_CHUNKED_SEARCH = true;

// Configuration: Enable LLM-based reranking for top results (higher quality but slower)
// Set to false for faster search (trades quality for speed)
const ENABLE_RERANKING = true;

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
    // For chunks, bookmark_id is the reference to Supabase. 
    // For legacy bookmarks, they might just have the 'id'.
    const bookmarkId = chunk.bookmark_id || chunk.id;

    if (!bookmarkMap.has(bookmarkId)) {
      // First time seeing this bookmark
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
        // Keep track of best matching chunk (or the bookmark itself if legacy)
        best_chunk: {
          score: chunk.score,
          chunk_index: chunk.chunk_index || 0,
          chunk_text: chunk.chunk_text || chunk.content?.substring(0, 500) || ''
        },
        // Keep track of all chunks for this bookmark
        matching_chunks: [{
          chunk_index: chunk.chunk_index || 0,
          score: chunk.score,
          chunk_text: (chunk.chunk_text || chunk.content || '').substring(0, 200) + '...'
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
      startDate = null,
      endDate = null,
      scoreThreshold = 0.3,
      folderPath = null
    } = options;

    console.log(`[Search] Semantic search for: "${query}" (${query.length} chars)`);
    console.log(`[Search] Mode: ${ENABLE_CHUNKED_SEARCH ? 'CHUNKED' : 'LEGACY'}`);

    // Step 1: Generate embedding for the search query
    console.log('[Search] Requesting query embedding from Gemini...');
    let queryEmbedding;
    try {
      queryEmbedding = await generateEmbedding(query);
      console.log(`[Search] Query embedding generated successfully: ${queryEmbedding.length}D`);
    } catch (embedError) {
      console.error('[Search] FAILED to generate query embedding:', embedError.message);
      throw embedError;
    }

    let results;

    if (ENABLE_CHUNKED_SEARCH) {
      // Step 2a: Search chunks (get more chunks to allow aggregation)
      console.log(`[Search] Searching chunks in Qdrant (limit: ${limit * 5}, threshold: ${scoreThreshold})...`);
      try {
        const chunkResults = await searchChunks(userId, queryEmbedding, {
          limit: limit * 5, // Fetch more chunks to aggregate into top bookmarks
          tags,
          startDate,
          endDate,
          scoreThreshold,
          folderPath
        });
        console.log(`[Search] Qdrant returned ${chunkResults.length} matching chunks`);
        results = aggregateChunksByBookmark(chunkResults, limit);
      } catch (qdrantError) {
        console.error('[Search] Qdrant search FAILED:', qdrantError.message);
        throw qdrantError;
      }
    } else {
      // Step 2b: Legacy search (non-chunked)
      console.log(`[Search] Searching legacy bookmarks in Qdrant...`);
      try {
        results = await searchQdrant(userId, queryEmbedding, {
          limit,
          tags,
          startDate,
          endDate,
          scoreThreshold,
          folderPath
        });
        console.log(`[Search] Qdrant returned ${results.length} results`);
      } catch (qdrantError) {
        console.error('[Search] Legacy Qdrant search FAILED:', qdrantError.message);
        throw qdrantError;
      }
    }

    // Step 4: Record search in history (fire and forget)
    createSearchHistory(userId, {
      query,
      filters: { tags, startDate, endDate, scoreThreshold },
      result_count: results.length
    }).catch(err => console.error('[Search] Failed to save search history:', err));

    return results;

  } catch (error) {
    console.error('[Search] CRITICAL: Semantic search pipeline failed:', error.message);
    throw error;
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
      startDate = null,
      endDate = null,
      scoreThreshold = 0.3,
      folderPath = null,
      generateAnswer = true // New flag for RAG
    } = options;

    const semanticResults = await semanticSearch(userId, query, { limit: limit * 2, tags, startDate, endDate, scoreThreshold, folderPath });
    const resultsWithBM25 = scoreBM25(query, semanticResults);

    const scoredResults = resultsWithBM25.map(result => {
      const semanticScore = result.score; // Vector similarity score (0-1)
      const bm25Score = result.bm25_score || 0;
      const textMatchScore = enhancedTextMatch(query, result);

      // HYBRID FORMULA:
      // - 70% Semantic (Vector)
      // - 20% BM25 (Frequency)
      // - 10% Exact Match (Boolean/Stemmed)
      // We also normalize BM25 which can be > 1
      const normalizedBM25 = Math.min(bm25Score / 5, 1.0);
      const hybridScore = (semanticScore * 0.7) + (normalizedBM25 * 0.2) + (textMatchScore * 0.1);

      return {
        ...result,
        semantic_score: semanticScore,
        bm25_score: bm25Score,
        text_match_score: textMatchScore,
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

    // Step 5: RAG Answer Generation (New)
    let answer = null;
    if (generateAnswer && rankedResults.length > 0 && query.length > 5) {
      try {
        answer = await generateSearchAnswer(query, rankedResults);
      } catch (error) {
        console.error('[Search] RAG generation failed:', error);
      }
    }

    console.log(`[Search] Hybrid search completed: ${rankedResults.length} results${answer ? ' (Answer generated)' : ''}`);

    return {
      results: rankedResults,
      answer: answer
    };

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
      limit: 1000, // Get more raw points to account for chunks
      tags
    });

    // De-duplicate by bookmark_id since multiple chunks may have the same tags
    const bookmarkMap = new Map();
    for (const item of results) {
      const id = item.bookmark_id || item.id;
      if (!bookmarkMap.has(id)) {
        bookmarkMap.set(id, item);
      }
    }

    const uniqueResults = Array.from(bookmarkMap.values()).slice(0, limit);
    console.log(`[Search] Found ${uniqueResults.length} unique results for tags (from ${results.length} raw points)`);

    return uniqueResults;

  } catch (error) {
    console.error('[Search] Tag search failed:', error);
    throw new Error(`Tag search failed: ${error.message}`);
  }
}
