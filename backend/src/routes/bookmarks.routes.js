/**
 * Bookmarks Routes
 *
 * Handles bookmark CRUD operations
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  createBookmarkRecord,
  getBookmarkRecord,
  getUserBookmarkRecords,
  getUserBookmarkCount,
  updateBookmarkRecord,
  deleteBookmarkRecord
} from '../services/supabase.service.js';
import {
  getBookmarkById,
  deleteBookmark as deleteQdrantBookmark
} from '../services/qdrant.service.js';

const router = Router();

// All bookmark routes require authentication
router.use(requireAuth);

/**
 * POST /api/bookmarks
 * Create a new bookmark (queued for processing)
 */
router.post('/', async (req, res) => {
  try {
    const {
      url,
      title,
      tags,
      extractedContent,
      extractedTitle,
      extractedExcerpt,
      extractedMethod,
      extractedLength
    } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!url) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'URL is required'
      });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (error) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid URL format'
      });
    }

    // Check if we have valid extracted content from the extension
    const hasExtractedContent = extractedContent && extractedContent.length > 500;

    // Log extraction info
    if (hasExtractedContent) {
      console.log(`[Bookmark] Received extracted content (${extractedLength} chars) via ${extractedMethod}`);
    } else {
      console.log('[Bookmark] No extracted content, worker will use Jina fallback');
    }

    // Create bookmark record in Supabase with "pending" status
    // The bookmark will be processed by background worker
    const bookmark = await createBookmarkRecord(userId, {
      url,
      title: extractedTitle || title || null,
      processing_status: 'pending',
      extraction_method: hasExtractedContent ? extractedMethod : null,
      extracted_content: hasExtractedContent ? extractedContent : null,
      qdrant_point_id: null,
      error_message: null,
      retry_count: 0
    });

    // TODO: In next session, we'll add this to a job queue
    // For now, just return the pending bookmark

    res.status(201).json({
      message: 'Bookmark created successfully',
      bookmark: {
        id: bookmark.id,
        url: bookmark.url,
        title: bookmark.title,
        status: bookmark.processing_status,
        created_at: bookmark.created_at
      }
    });

  } catch (error) {
    console.error('Create bookmark error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create bookmark'
    });
  }
});

/**
 * GET /api/bookmarks
 * List all bookmarks for authenticated user
 * Query params: limit, offset, status, url, tags, start_date, end_date
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      limit = 50,
      offset = 0,
      status = null,
      url = null,
      tags = null,
      start_date = null,
      end_date = null
    } = req.query;

    // Parse tags if provided (comma-separated)
    const tagArray = tags ? tags.split(',').map(t => t.trim()).filter(t => t) : null;

    // Get total count from Supabase (before pagination and tag filtering)
    const totalCount = await getUserBookmarkCount(userId, {
      status,
      url,
      start_date,
      end_date
    });

    // Get bookmarks from Supabase with date filtering
    const bookmarks = await getUserBookmarkRecords(userId, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      status,
      url,
      start_date,
      end_date
    });

    // Handle empty or null bookmarks
    if (!bookmarks || !Array.isArray(bookmarks)) {
      return res.json({
        bookmarks: [],
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: totalCount,
          totalPages: Math.ceil(totalCount / parseInt(limit))
        }
      });
    }

    // For completed bookmarks, enrich with Qdrant data
    const enrichedBookmarks = await Promise.all(
      bookmarks.map(async (bookmark) => {
        if (bookmark.processing_status === 'completed' && bookmark.qdrant_point_id) {
          try {
            const qdrantData = await getBookmarkById(bookmark.qdrant_point_id);
            if (qdrantData) {
              return {
                ...bookmark,
                description: qdrantData.description,
                tags: qdrantData.tags || [],
                favicon_url: qdrantData.favicon_url
              };
            }
          } catch (error) {
            console.error(`Error fetching Qdrant data for ${bookmark.id}:`, error.message);
            // Return bookmark without enrichment on error
          }
        }
        return bookmark;
      })
    );

    // Filter by tags if specified (client-side filtering after enrichment)
    let filteredBookmarks = enrichedBookmarks;
    if (tagArray && tagArray.length > 0) {
      filteredBookmarks = enrichedBookmarks.filter(bookmark => {
        if (!bookmark.tags || !Array.isArray(bookmark.tags)) return false;
        // Check if bookmark has ANY of the requested tags
        return tagArray.some(tag => bookmark.tags.includes(tag));
      });
    }

    // Note: If tags are filtered, totalCount may not be accurate for filtered results
    // But it gives a reasonable approximation for pagination
    const effectiveTotal = tagArray && tagArray.length > 0
      ? Math.max(filteredBookmarks.length, totalCount) // Use the larger value as estimate
      : totalCount;

    res.json({
      bookmarks: filteredBookmarks,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: effectiveTotal,
        totalPages: Math.ceil(effectiveTotal / parseInt(limit)),
        currentPage: Math.floor(parseInt(offset) / parseInt(limit)) + 1
      }
    });

  } catch (error) {
    console.error('List bookmarks error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to fetch bookmarks',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * GET /api/bookmarks/:id
 * Get a single bookmark by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Get bookmark from Supabase
    const bookmark = await getBookmarkRecord(id);

    if (!bookmark) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Bookmark not found'
      });
    }

    // Check ownership
    if (bookmark.user_id !== userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this bookmark'
      });
    }

    // If completed, get full content from Qdrant
    if (bookmark.processing_status === 'completed' && bookmark.qdrant_point_id) {
      try {
        const qdrantData = await getBookmarkById(bookmark.qdrant_point_id);
        if (qdrantData) {
          bookmark.description = qdrantData.description;
          bookmark.content = qdrantData.content;
          bookmark.tags = qdrantData.tags || [];
          bookmark.favicon_url = qdrantData.favicon_url;
        }
      } catch (error) {
        console.error('Error fetching Qdrant data:', error);
        // Continue without Qdrant data
      }
    }

    res.json({ bookmark });

  } catch (error) {
    console.error('Get bookmark error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch bookmark'
    });
  }
});

/**
 * PUT /api/bookmarks/:id
 * Update a bookmark (title, tags, etc.)
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { title, tags } = req.body;

    // Get bookmark to check ownership
    const bookmark = await getBookmarkRecord(id);

    if (!bookmark) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Bookmark not found'
      });
    }

    // Check ownership
    if (bookmark.user_id !== userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this bookmark'
      });
    }

    // Prepare updates for Supabase
    const supabaseUpdates = {};
    if (title !== undefined) {
      supabaseUpdates.title = title;
    }

    // Update Supabase record
    const updatedBookmark = await updateBookmarkRecord(id, supabaseUpdates);

    // If bookmark is completed and has Qdrant data, update that too
    if (bookmark.processing_status === 'completed' && bookmark.qdrant_point_id) {
      try {
        const { updateBookmark } = await import('../services/qdrant.service.js');
        const qdrantUpdates = {};
        if (title !== undefined) qdrantUpdates.title = title;
        if (tags !== undefined) qdrantUpdates.tags = tags;

        if (Object.keys(qdrantUpdates).length > 0) {
          await updateBookmark(bookmark.qdrant_point_id, qdrantUpdates);
        }
      } catch (error) {
        console.error('Error updating Qdrant data:', error);
        // Continue - Supabase update succeeded
      }
    }

    res.json({
      message: 'Bookmark updated successfully',
      bookmark: updatedBookmark
    });

  } catch (error) {
    console.error('Update bookmark error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update bookmark'
    });
  }
});

/**
 * DELETE /api/bookmarks/:id
 * Delete a bookmark (removes from both Supabase and Qdrant)
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Get bookmark to check ownership and get Qdrant ID
    const bookmark = await getBookmarkRecord(id);

    if (!bookmark) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Bookmark not found'
      });
    }

    // Check ownership
    if (bookmark.user_id !== userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this bookmark'
      });
    }

    // Delete from Qdrant if it exists there
    if (bookmark.qdrant_point_id) {
      try {
        await deleteQdrantBookmark(bookmark.qdrant_point_id);
      } catch (error) {
        console.error('Error deleting from Qdrant:', error);
        // Continue - we still want to delete from Supabase
      }
    }

    // Delete from Supabase
    await deleteBookmarkRecord(id);

    res.json({
      message: 'Bookmark deleted successfully'
    });

  } catch (error) {
    console.error('Delete bookmark error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete bookmark'
    });
  }
});

export default router;
