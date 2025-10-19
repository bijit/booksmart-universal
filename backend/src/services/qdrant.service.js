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
