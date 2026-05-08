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
  deleteBookmarkRecord,
  deleteAllUserBookmarks,
  getUserUniqueFolderPaths
} from '../services/supabase.service.js';

import {
  getBookmarkById,
  deleteBookmark as deleteQdrantBookmark,
  deleteAllUserPoints
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
      extractedContent, 
      extractedTitle, 
      extractedExcerpt,
      extractedMethod, 
      extractedLength,
      folder_id,
      folder_path,
      browser,
      cover_image,
      extracted_images
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
      folder_id: folder_id || null,
      folder_path: folder_path || null,
      browser: browser || 'unknown',
      cover_image: cover_image || null,
      extracted_images: extracted_images || null,
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
      end_date = null,
      folder_path = null,
      folder_id = null
    } = req.query;

    // Parse tags if provided (comma-separated)
    const tagArray = tags ? tags.split(',').map(t => t.trim()).filter(t => t) : null;

    // Get total count from Supabase (before pagination and tag filtering)
    const totalCount = await getUserBookmarkCount(userId, {
      status,
      url,
      start_date,
      end_date,
      folder_path,
      folder_id
    });

    // If limit=0, just return the count (used for badge polling)
    const parsedLimit = parseInt(limit) || 50;
    if (parsedLimit === 0 || limit === '0') {
      return res.json({
        bookmarks: [],
        pagination: {
          limit: 0,
          offset: parseInt(offset),
          total: totalCount,
          totalPages: 0
        }
      });
    }

    // Get bookmarks from Supabase with date filtering
    const bookmarks = await getUserBookmarkRecords(userId, {
      limit: parsedLimit,
      offset: parseInt(offset),
      status,
      url,
      start_date,
      end_date,
      folder_path,
      folder_id
    });

    // Handle empty or null bookmarks
    if (!bookmarks || !Array.isArray(bookmarks)) {
      return res.json({
        bookmarks: [],
        pagination: {
          limit: parsedLimit,
          offset: parseInt(offset),
          total: totalCount,
          totalPages: Math.ceil(totalCount / parsedLimit)
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
        limit: parsedLimit,
        offset: parseInt(offset),
        total: effectiveTotal,
        totalPages: Math.ceil(effectiveTotal / parsedLimit),
        currentPage: Math.floor(parseInt(offset) / parsedLimit) + 1
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
 * GET /api/bookmarks/folders
 * Get all unique folder paths for the user
 */
router.get('/folders', async (req, res) => {
  try {
    const userId = req.user.id;
    const folderPaths = await getUserUniqueFolderPaths(userId);
    res.json({ folders: folderPaths });
  } catch (error) {
    console.error('Fetch unique folders error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch unique folder paths'
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
    const { title, tags, folder_id, folder_path, browser } = req.body;



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
    if (folder_id !== undefined) {
      supabaseUpdates.folder_id = folder_id;
    }
    if (folder_path !== undefined) {
      supabaseUpdates.folder_path = folder_path;
    }


    // Update folder hierarchy with source tracking
    if (browser && (folder_path !== undefined || folder_id !== undefined)) {
      const { upsertBookmarkSource } = await import('../services/supabase.service.js');
      await upsertBookmarkSource(id, {
        browser,
        folder_id: folder_id || null,
        folder_path: folder_path || null
      });
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
        if (folder_id !== undefined) qdrantUpdates.folder_id = folder_id;
        if (folder_path !== undefined) qdrantUpdates.folder_path = folder_path;


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
 * DELETE /api/bookmarks/all
 * Delete ALL bookmarks for authenticated user
 * Used for re-import scenarios - requires confirmation from client
 * NOTE: This route must come BEFORE the /:id route to avoid path collision
 */
router.delete('/all', async (req, res) => {
  try {
    const userId = req.user.id;

    console.log(`[Bookmarks] Deleting ALL bookmarks for user ${userId}...`);

    // Get count before deletion for logging
    const countBefore = await getUserBookmarkCount(userId);
    console.log(`[Bookmarks] User has ${countBefore} bookmarks to delete`);

    // Delete from Qdrant first (all user points)
    try {
      await deleteAllUserPoints(userId);
      console.log(`[Bookmarks] Deleted all Qdrant points for user ${userId}`);
    } catch (error) {
      console.error('Error deleting from Qdrant:', error);
      // Continue - we still want to delete from Supabase
    }

    // Delete from Supabase
    const deletedCount = await deleteAllUserBookmarks(userId);

    console.log(`[Bookmarks] Successfully deleted ${deletedCount} bookmarks for user ${userId}`);

    res.json({
      message: 'All bookmarks deleted successfully',
      deletedCount: deletedCount
    });

  } catch (error) {
    console.error('Delete all bookmarks error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete all bookmarks'
    });
  }
});

/**
 * POST /api/bookmarks/:id/summarize
 * Generate a deep summary for a bookmark
 */
router.post('/:id/summarize', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // 1. Get bookmark from Supabase
    const bookmark = await getBookmarkRecord(id);

    if (!bookmark) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Bookmark not found'
      });
    }

    // 2. Check ownership
    if (bookmark.user_id !== userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this bookmark'
      });
    }

    // 3. Check if we already have a detailed summary
    if (bookmark.detailed_summary && !req.query.refresh) {
      return res.json({
        message: 'Returning cached summary',
        summary: bookmark.detailed_summary
      });
    }

    // 4. Get full content from Qdrant (since Supabase only stores metadata or truncated content)
    let content = bookmark.extracted_content;
    if (!content && bookmark.qdrant_point_id) {
      const qdrantData = await getBookmarkById(bookmark.qdrant_point_id);
      content = qdrantData?.content;
    }

    if (!content || content.length < 200) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Bookmark does not have enough content for a deep summary'
      });
    }

    // 5. Generate deep summary using Gemini
    const { generateDeepSummary, suggestTags } = await import('../services/gemini.service.js');
    const summary = await generateDeepSummary(content, bookmark.title);

    // 6. Save back to Supabase
    await updateBookmarkRecord(id, {
      detailed_summary: summary
    });

    res.status(200).json({
      message: 'Deep summary generated successfully',
      summary
    });
  } catch (error) {
    console.error('Error generating deep summary:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

/**
 * POST /api/bookmarks/analyze
 * Real-time analysis for tag suggestions (Pre-save)
 */
router.post('/analyze', requireAuth, async (req, res) => {
  try {
    const { title, content } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const { suggestTags } = await import('../services/gemini.service.js');
    const tags = await suggestTags(title, content);

    
    res.json({ tags });
  } catch (error) {
    console.error('Error analyzing page:', error);
    res.status(500).json({ error: 'Failed to analyze page' });
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
