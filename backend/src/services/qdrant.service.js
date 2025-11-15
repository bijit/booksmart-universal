/**
 * Qdrant Service
 *
 * Handles all interactions with Qdrant vector database
 */

import { qdrantClient, COLLECTION_NAME } from '../config/qdrant.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Create a new bookmark point in Qdrant
 */
export async function createBookmark(userId, bookmarkData) {
  try {
    const pointId = uuidv4();

    const point = {
      id: pointId,
      vector: bookmarkData.embedding, // 768-dimensional vector
      payload: {
        user_id: userId,
        url: bookmarkData.url,
        title: bookmarkData.title,
        description: bookmarkData.description,
        content: bookmarkData.content, // Full extracted content
        tags: bookmarkData.tags || [],
        favicon_url: bookmarkData.favicon_url || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    };

    await qdrantClient.upsert(COLLECTION_NAME, {
      wait: true,
      points: [point]
    });

    return pointId;

  } catch (error) {
    console.error('Error creating bookmark in Qdrant:', error);
    throw new Error(`Failed to create bookmark: ${error.message}`);
  }
}

/**
 * Update an existing bookmark point
 */
export async function updateBookmark(pointId, bookmarkData) {
  try {
    // Get existing point to preserve user_id
    const existingPoints = await qdrantClient.retrieve(COLLECTION_NAME, {
      ids: [pointId]
    });

    if (existingPoints.length === 0) {
      throw new Error('Bookmark not found');
    }

    const existingPayload = existingPoints[0].payload;

    const point = {
      id: pointId,
      vector: bookmarkData.embedding || existingPoints[0].vector,
      payload: {
        ...existingPayload,
        title: bookmarkData.title !== undefined ? bookmarkData.title : existingPayload.title,
        description: bookmarkData.description !== undefined ? bookmarkData.description : existingPayload.description,
        content: bookmarkData.content !== undefined ? bookmarkData.content : existingPayload.content,
        tags: bookmarkData.tags !== undefined ? bookmarkData.tags : existingPayload.tags,
        favicon_url: bookmarkData.favicon_url !== undefined ? bookmarkData.favicon_url : existingPayload.favicon_url,
        updated_at: new Date().toISOString()
      }
    };

    await qdrantClient.upsert(COLLECTION_NAME, {
      wait: true,
      points: [point]
    });

    return true;

  } catch (error) {
    console.error('Error updating bookmark in Qdrant:', error);
    throw new Error(`Failed to update bookmark: ${error.message}`);
  }
}

/**
 * Delete a bookmark point
 */
export async function deleteBookmark(pointId) {
  try {
    await qdrantClient.delete(COLLECTION_NAME, {
      wait: true,
      points: [pointId]
    });

    return true;

  } catch (error) {
    console.error('Error deleting bookmark from Qdrant:', error);
    throw new Error(`Failed to delete bookmark: ${error.message}`);
  }
}

/**
 * Search bookmarks using semantic search
 */
export async function searchBookmarks(userId, queryEmbedding, options = {}) {
  try {
    const {
      limit = 10,
      offset = 0,
      tags = null,
      scoreThreshold = 0.5
    } = options;

    // Build filter
    const filter = {
      must: [
        {
          key: 'user_id',
          match: { value: userId }
        }
      ]
    };

    // Add tag filter if provided
    if (tags && tags.length > 0) {
      filter.must.push({
        key: 'tags',
        match: { any: tags }
      });
    }

    // Perform search
    const searchResults = await qdrantClient.search(COLLECTION_NAME, {
      vector: queryEmbedding,
      filter: filter,
      limit: limit,
      offset: offset,
      score_threshold: scoreThreshold,
      with_payload: true
    });

    return searchResults.map(result => ({
      id: result.id,
      score: result.score,
      ...result.payload
    }));

  } catch (error) {
    console.error('Error searching bookmarks in Qdrant:', error);
    throw new Error(`Failed to search bookmarks: ${error.message}`);
  }
}

/**
 * Get bookmarks by user with filters
 */
export async function getBookmarksByUser(userId, options = {}) {
  try {
    const {
      limit = 50,
      offset = 0,
      tags = null
    } = options;

    // Build filter
    const filter = {
      must: [
        {
          key: 'user_id',
          match: { value: userId }
        }
      ]
    };

    // Add tag filter if provided
    if (tags && tags.length > 0) {
      filter.must.push({
        key: 'tags',
        match: { any: tags }
      });
    }

    // Scroll through points (no vector search, just filtering)
    const scrollResults = await qdrantClient.scroll(COLLECTION_NAME, {
      filter: filter,
      limit: limit,
      offset: offset,
      with_payload: true,
      with_vector: false
    });

    return scrollResults.points.map(point => ({
      id: point.id,
      ...point.payload
    }));

  } catch (error) {
    console.error('Error getting bookmarks from Qdrant:', error);
    throw new Error(`Failed to get bookmarks: ${error.message}`);
  }
}

/**
 * Get a single bookmark by ID
 */
export async function getBookmarkById(pointId) {
  try {
    const results = await qdrantClient.retrieve(COLLECTION_NAME, {
      ids: [pointId],
      with_payload: true,
      with_vector: false
    });

    if (results.length === 0) {
      return null;
    }

    return {
      id: results[0].id,
      ...results[0].payload
    };

  } catch (error) {
    console.error('Error getting bookmark from Qdrant:', error);
    throw new Error(`Failed to get bookmark: ${error.message}`);
  }
}

/**
 * Count bookmarks for a user
 */
export async function countUserBookmarks(userId) {
  try {
    const result = await qdrantClient.count(COLLECTION_NAME, {
      filter: {
        must: [
          {
            key: 'user_id',
            match: { value: userId }
          }
        ]
      }
    });

    return result.count;

  } catch (error) {
    console.error('Error counting bookmarks in Qdrant:', error);
    throw new Error(`Failed to count bookmarks: ${error.message}`);
  }
}

/**
 * CHUNKING SUPPORT
 * Functions for storing and searching content chunks
 */

/**
 * Create bookmark with chunks
 * Stores multiple chunk vectors for a single bookmark for improved search quality
 *
 * @param {string} userId - User ID
 * @param {Object} bookmarkData - Bookmark data with chunks
 * @param {string} bookmarkData.bookmark_id - Supabase bookmark ID (parent reference)
 * @param {string} bookmarkData.url - Bookmark URL
 * @param {string} bookmarkData.title - Bookmark title
 * @param {string} bookmarkData.description - Bookmark description
 * @param {string} bookmarkData.content - Full content
 * @param {Array} bookmarkData.tags - Tags
 * @param {Array<Object>} bookmarkData.chunks - Array of chunks with embeddings
 * @returns {Promise<Array<string>>} Array of chunk point IDs
 */
export async function createBookmarkChunks(userId, bookmarkData) {
  try {
    const { bookmark_id, url, title, description, content, tags, chunks, favicon_url } = bookmarkData;

    if (!chunks || chunks.length === 0) {
      throw new Error('No chunks provided for bookmark');
    }

    console.log(`[Qdrant] Creating ${chunks.length} chunks for bookmark ${bookmark_id}`);

    // Create points for each chunk
    const points = chunks.map(chunk => ({
      id: uuidv4(),
      vector: chunk.embedding, // 768-dimensional vector
      payload: {
        user_id: userId,
        bookmark_id: bookmark_id, // Reference to parent bookmark in Supabase
        url: url,
        title: title,
        description: description,
        content: content, // Store full content in each chunk for retrieval
        tags: tags || [],
        favicon_url: favicon_url || null,
        // Chunk-specific data
        chunk_index: chunk.index,
        chunk_text: chunk.text,
        chunk_start: chunk.start,
        chunk_end: chunk.end,
        total_chunks: chunk.total_chunks,
        is_chunk: true, // Flag to identify chunk points vs legacy bookmark points
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    }));

    // Batch insert all chunks
    await qdrantClient.upsert(COLLECTION_NAME, {
      wait: true,
      points: points
    });

    console.log(`[Qdrant] Successfully created ${points.length} chunks`);

    return points.map(p => p.id);

  } catch (error) {
    console.error('Error creating bookmark chunks in Qdrant:', error);
    throw new Error(`Failed to create bookmark chunks: ${error.message}`);
  }
}

/**
 * Search chunks using semantic search
 * Returns chunks that match the query, grouped by parent bookmark
 *
 * @param {string} userId - User ID
 * @param {Array<number>} queryEmbedding - Query embedding vector
 * @param {Object} options - Search options
 * @returns {Promise<Array>} Array of matching chunks with scores
 */
export async function searchChunks(userId, queryEmbedding, options = {}) {
  try {
    const {
      limit = 50, // Fetch more chunks to allow aggregation
      offset = 0,
      tags = null,
      scoreThreshold = 0.3
    } = options;

    // Build filter for chunks
    const filter = {
      must: [
        {
          key: 'user_id',
          match: { value: userId }
        },
        {
          key: 'is_chunk',
          match: { value: true }
        }
      ]
    };

    // Add tag filter if provided
    if (tags && tags.length > 0) {
      filter.must.push({
        key: 'tags',
        match: { any: tags }
      });
    }

    // Perform search
    const searchResults = await qdrantClient.search(COLLECTION_NAME, {
      vector: queryEmbedding,
      filter: filter,
      limit: limit,
      offset: offset,
      score_threshold: scoreThreshold,
      with_payload: true
    });

    return searchResults.map(result => ({
      id: result.id,
      score: result.score,
      ...result.payload
    }));

  } catch (error) {
    console.error('Error searching chunks in Qdrant:', error);
    throw new Error(`Failed to search chunks: ${error.message}`);
  }
}

/**
 * Delete all chunks for a bookmark
 *
 * @param {string} bookmarkId - Supabase bookmark ID
 * @returns {Promise<boolean>} Success status
 */
export async function deleteBookmarkChunks(bookmarkId) {
  try {
    // Find all chunks for this bookmark
    const scrollResults = await qdrantClient.scroll(COLLECTION_NAME, {
      filter: {
        must: [
          {
            key: 'bookmark_id',
            match: { value: bookmarkId }
          },
          {
            key: 'is_chunk',
            match: { value: true }
          }
        ]
      },
      limit: 100,
      with_payload: false,
      with_vector: false
    });

    if (scrollResults.points.length === 0) {
      console.log(`[Qdrant] No chunks found for bookmark ${bookmarkId}`);
      return true;
    }

    // Delete all chunks
    const chunkIds = scrollResults.points.map(p => p.id);

    await qdrantClient.delete(COLLECTION_NAME, {
      wait: true,
      points: chunkIds
    });

    console.log(`[Qdrant] Deleted ${chunkIds.length} chunks for bookmark ${bookmarkId}`);

    return true;

  } catch (error) {
    console.error('Error deleting bookmark chunks from Qdrant:', error);
    throw new Error(`Failed to delete bookmark chunks: ${error.message}`);
  }
}

/**
 * Get all chunks for a specific bookmark
 *
 * @param {string} bookmarkId - Supabase bookmark ID
 * @returns {Promise<Array>} Array of chunks
 */
export async function getBookmarkChunks(bookmarkId) {
  try {
    const scrollResults = await qdrantClient.scroll(COLLECTION_NAME, {
      filter: {
        must: [
          {
            key: 'bookmark_id',
            match: { value: bookmarkId }
          },
          {
            key: 'is_chunk',
            match: { value: true }
          }
        ]
      },
      limit: 100,
      with_payload: true,
      with_vector: false
    });

    return scrollResults.points.map(point => ({
      id: point.id,
      ...point.payload
    }));

  } catch (error) {
    console.error('Error getting bookmark chunks from Qdrant:', error);
    throw new Error(`Failed to get bookmark chunks: ${error.message}`);
  }
}
