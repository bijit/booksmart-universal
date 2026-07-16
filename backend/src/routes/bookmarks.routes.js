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
  getBookmarkByUrl,
  getUserBookmarkRecords,
  getUserBookmarkCount,
  updateBookmarkRecord,
  upsertBookmarkSource,
  deleteBookmarkRecord,
  deleteAllUserBookmarks,
  getUserUniqueFolderPaths,
  renameFolderInDb,
  deleteFolderInDb
} from '../services/supabase.service.js';

import {
  getBookmarkById,
  deleteBookmark as deleteQdrantBookmark,
  deleteAllUserPoints,
  updateQdrantFolderPaths,
  deleteQdrantBookmarks,
  dissolveQdrantFolder
} from '../services/qdrant.service.js';
import { generateEmbedding } from '../services/gemini.service.js';
import { QdrantClient } from '@qdrant/js-client-rest';

const qdrantClient = new QdrantClient({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY
});
const COLLECTION_NAME = 'bookmarks';

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
      extracted_images,
      created_at
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

    // Check if a bookmark with the same URL already exists for the user to prevent duplicates
    const existingBookmark = await getBookmarkByUrl(userId, url);
    
    if (existingBookmark) {
      console.log(`[Bookmark] Bookmark with URL ${url} already exists for user ${userId}. Handling deduplication...`);
      
      // 1. Update/upsert the source info (folder_id, folder_path, browser)
      if (folder_path || folder_id) {
        await upsertBookmarkSource(existingBookmark.id, {
          browser: browser || 'unknown',
          folder_id: folder_id || null,
          folder_path: folder_path || null
        });
      }

      // 2. Check if we should upgrade a metadata-only or content-less bookmark to full text content
      const existingHasNoContent = !existingBookmark.extracted_content || existingBookmark.extracted_content.length <= 500;
      const existingIsMetadataOnly = existingBookmark.extraction_method === 'metadata' || existingBookmark.processing_status === 'failed';
      
      if (hasExtractedContent && (existingHasNoContent || existingIsMetadataOnly)) {
        console.log(`[Bookmark] Upgrading existing metadata-only bookmark ${existingBookmark.id} to full text content...`);
        const updated = await updateBookmarkRecord(existingBookmark.id, {
          title: extractedTitle || title || existingBookmark.title,
          processing_status: 'pending',
          extraction_method: extractedMethod,
          extracted_content: extractedContent,
          cover_image: cover_image || null,
          extracted_images: extracted_images || null,
          error_message: null,
          retry_count: 0
        });

        return res.status(200).json({
          message: 'Bookmark updated and queued for full processing',
          bookmark: {
            id: updated.id,
            url: updated.url,
            title: updated.title,
            status: updated.processing_status,
            created_at: updated.created_at
          }
        });
      }

      // Otherwise, the bookmark is already processed or is pending full extraction, so just return it
      return res.status(200).json({
        message: 'Bookmark already exists',
        bookmark: {
          id: existingBookmark.id,
          url: existingBookmark.url,
          title: existingBookmark.title,
          status: existingBookmark.processing_status,
          created_at: existingBookmark.created_at
        }
      });
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
      created_at: created_at || null,
      qdrant_point_id: null,
      error_message: null,
      retry_count: 0
    });

    // Trigger background worker cycle immediately (asynchronously, do not block API response)
    import('../workers/bookmark.worker.js').then(({ pollAndProcess, pollAndLazyScrape }) => {
      console.log(`[Route] Triggered immediate worker cycles for new bookmark: ${bookmark.id}`);
      pollAndProcess().catch(err => console.error('[Route] Immediate pollAndProcess failed:', err));
      // Give a tiny offset to lazy-scraping so Phase 1 completes first
      setTimeout(() => {
        pollAndLazyScrape().catch(err => console.error('[Route] Immediate pollAndLazyScrape failed:', err));
      }, 2000);
    }).catch(err => console.error('[Route] Failed to load worker functions in route:', err));

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
      folder_id = null,
      content_type = null
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
      folder_id,
      content_type
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
      folder_id,
      content_type
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
 * PUT /api/bookmarks/folders/rename
 * Rename a folder (and all its subfolders)
 */
router.put('/folders/rename', async (req, res) => {
  try {
    const userId = req.user.id;
    const { oldPath, newPath } = req.body;

    if (!oldPath || !newPath) {
      return res.status(400).json({ error: 'Missing oldPath or newPath parameter' });
    }

    console.log(`[Folders] User ${userId} renaming folder: "${oldPath}" ➔ "${newPath}"`);
    const updated = await renameFolderInDb(userId, oldPath, newPath);

    // Update Qdrant payloads in background/parallel
    if (updated.length > 0) {
      try {
        await updateQdrantFolderPaths(userId, updated);
      } catch (qErr) {
        console.error('Failed to sync renamed folders to Qdrant:', qErr);
      }
    }

    res.json({
      message: 'Folder renamed successfully',
      updatedCount: updated.length
    });
  } catch (error) {
    console.error('Rename folder error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to rename folder'
    });
  }
});

/**
 * PUT /api/bookmarks/folders/move
 * Move a folder (and its subfolders) under a new parent folder
 */
router.put('/folders/move', async (req, res) => {
  try {
    const userId = req.user.id;
    const { folderPath, newParentPath } = req.body;

    if (!folderPath) {
      return res.status(400).json({ error: 'Missing folderPath parameter' });
    }

    // Get folder name (last part of folderPath)
    const pathParts = folderPath.split(' > ');
    const folderName = pathParts[pathParts.length - 1];

    // Compute the new path
    const computedNewPath = !newParentPath 
      ? folderName 
      : `${newParentPath} > ${folderName}`;

    console.log(`[Folders] User ${userId} moving folder: "${folderPath}" under parent: "${newParentPath || 'Root'}" (computed new path: "${computedNewPath}")`);
    
    if (folderPath === computedNewPath) {
      return res.status(400).json({ error: 'Cannot move folder into itself or parent path is unchanged' });
    }

    // A folder cannot be moved under its own subfolders
    if (computedNewPath.startsWith(folderPath + ' > ')) {
      return res.status(400).json({ error: 'Cannot move a folder under its own subfolders' });
    }

    const updated = await renameFolderInDb(userId, folderPath, computedNewPath);

    if (updated.length > 0) {
      try {
        await updateQdrantFolderPaths(userId, updated);
      } catch (qErr) {
        console.error('Failed to sync moved folders to Qdrant:', qErr);
      }
    }

    res.json({
      message: 'Folder moved successfully',
      updatedCount: updated.length
    });
  } catch (error) {
    console.error('Move folder error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to move folder'
    });
  }
});

/**
 * DELETE /api/bookmarks/folders
 * Delete a folder (either dissolving or deleting bookmarks inside)
 */
router.delete('/folders', async (req, res) => {
  try {
    const userId = req.user.id;
    const folderPath = req.body.folderPath || req.query.folderPath;
    const deleteBookmarks = req.body.deleteBookmarks === true || 
                            req.body.deleteBookmarks === 'true' || 
                            req.query.deleteBookmarks === 'true';

    if (!folderPath) {
      return res.status(400).json({ error: 'Missing folderPath parameter' });
    }

    console.log(`[Folders] User ${userId} deleting folder: "${folderPath}" (deleteBookmarks: ${deleteBookmarks})`);
    
    const affectedBookmarks = await deleteFolderInDb(userId, folderPath, deleteBookmarks);

    if (affectedBookmarks.length > 0) {
      try {
        if (deleteBookmarks) {
          await deleteQdrantBookmarks(userId, affectedBookmarks);
        } else {
          await dissolveQdrantFolder(userId, affectedBookmarks);
        }
      } catch (qErr) {
        console.error('Failed to sync folder deletion/dissolution to Qdrant:', qErr);
      }
    }

    res.json({
      message: deleteBookmarks ? 'Folder and bookmarks deleted' : 'Folder dissolved successfully',
      affectedCount: affectedBookmarks.length
    });
  } catch (error) {
    console.error('Delete folder error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete folder'
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
    const { 
      title, 
      tags, 
      notes,
      folder_id, 
      folder_path, 
      browser,
      extractedContent,
      extractedTitle,
      extractedExcerpt,
      extractedMethod,
      extractedLength,
      cover_image,
      extracted_images
    } = req.body;

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
    if (notes !== undefined) {
      supabaseUpdates.notes = notes;
    }
    if (tags !== undefined) {
      supabaseUpdates.tags = tags;
    }
    if (folder_id !== undefined) {
      supabaseUpdates.folder_id = folder_id;
    }
    if (folder_path !== undefined) {
      supabaseUpdates.folder_path = folder_path;
    }

    // Allow updating content & images if provided (e.g. from popup update)
    if (extractedContent && extractedContent.length > 500) {
      supabaseUpdates.extracted_content = extractedContent;
      supabaseUpdates.extraction_method = extractedMethod || 'readability';
      supabaseUpdates.processing_status = 'pending'; // Put back in queue to re-process with images
    }
    if (cover_image !== undefined) {
      supabaseUpdates.cover_image = cover_image;
    }
    if (extracted_images !== undefined) {
      supabaseUpdates.extracted_images = extracted_images;
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

    // If it's a metadata-only bookmark or content is missing, fall back to using title and description
    let isMetadataOnly = false;
    if (!content || content.length < 200 || content.startsWith('Metadata-only bookmark.')) {
      if (bookmark.description && bookmark.description.length >= 20) {
        content = `Title: ${bookmark.title || 'Untitled'}\nDescription: ${bookmark.description}\nURL: ${bookmark.url}`;
        isMetadataOnly = true;
      } else {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Bookmark does not have enough content or description for a deep summary'
        });
      }
    }

    // 5. Generate deep summary using Gemini
    const { generateDeepSummary, suggestTags } = await import('../services/gemini.service.js');
    const summary = await generateDeepSummary(content, bookmark.title);

    // 6. Save back to Supabase
    await updateBookmarkRecord(id, {
      detailed_summary: summary
    });

    // 7. Re-index the deep summary into Qdrant so it becomes searchable.
    //    We embed the summary text and upsert it as a dedicated 'deep_summary' chunk.
    //    Failures here are non-fatal — the summary is still returned to the client.
    try {
      // Convert the structured summary object to plain text for embedding
      const summaryText = typeof summary === 'object' && summary !== null
        ? [summary.tldr, summary.analysis,
           summary.category ? `Category: ${summary.category}` : null,
           Array.isArray(summary.key_takeaways) ? 'Key takeaways: ' + summary.key_takeaways.join('. ') : summary.key_takeaways
          ].filter(Boolean).join('\n\n')
        : String(summary);
      const summaryEmbedding = await generateEmbedding(summaryText);
      const { v4: uuidv4 } = await import('uuid');

      await qdrantClient.upsert(COLLECTION_NAME, {
        wait: true,
        points: [{
          id: uuidv4(),
          vector: summaryEmbedding,
          payload: {
            user_id: userId,
            bookmark_id: id,            // Supabase bookmark ID
            url: bookmark.url,
            title: bookmark.title,
            description: bookmark.description,
            tags: bookmark.tags || [],
            favicon_url: bookmark.favicon_url || null,
            folder_id: bookmark.folder_id || null,
            folder_path: bookmark.folder_path || null,
            cover_image: bookmark.cover_image || null,
            extracted_images: bookmark.extracted_images || [],
            // Summary-specific chunk fields
            chunk_index: -1,            // Sentinel: -1 = deep summary chunk
            chunk_text: summaryText,      // plain string — always safe for .substring()
            chunk_type: 'deep_summary', // Distinguishes from regular content chunks
            is_chunk: true,
            created_at: bookmark.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        }]
      });
      console.log(`[Summarize] Deep summary chunk upserted to Qdrant for bookmark ${id}`);
    } catch (qdrantError) {
      console.warn(`[Summarize] Failed to index summary in Qdrant (non-fatal): ${qdrantError.message}`);
    }

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
 * POST /api/bookmarks/:id/reindex
 * Queue a bookmark for re-indexing (scrapes page again and updates Qdrant)
 */
router.post('/:id/reindex', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    let bookmark;
    let isRecovered = false;

    try {
      // 1. Get bookmark from Supabase to check ownership
      bookmark = await getBookmarkRecord(id);
    } catch (dbError) {
      // Catch PGRST116 (0 rows returned / not found) to attempt recovery from Qdrant
      const isNotFoundError = dbError.message && (
        dbError.message.includes('Cannot coerce') || 
        dbError.message.includes('PGRST116') || 
        dbError.message.includes('not found')
      );

      if (isNotFoundError) {
        console.log(`[Reindex] Bookmark ${id} not found in Supabase. Attempting to recover from Qdrant...`);
        
        const { getBookmarkChunks, getBookmarkById } = await import('../services/qdrant.service.js');
        let qdrantData = null;

        try {
          const chunks = await getBookmarkChunks(id);
          if (chunks && chunks.length > 0) {
            qdrantData = chunks[0];
          } else {
            qdrantData = await getBookmarkById(id);
          }
        } catch (qError) {
          console.error(`[Reindex] Failed to fetch metadata from Qdrant for ${id}:`, qError.message);
        }

        if (qdrantData) {
          // Verify user ownership in the Qdrant payload
          if (qdrantData.user_id !== userId) {
            return res.status(403).json({
              error: 'Forbidden',
              message: 'You do not have access to this bookmark'
            });
          }

          console.log(`[Reindex] Found metadata in Qdrant. Restoring Supabase record for: ${qdrantData.url}`);
          
          const { supabaseAdmin } = await import('../config/supabase.js');
          const { data, error: insertError } = await supabaseAdmin
            .from('bookmarks')
            .insert({
              id, // Re-use the existing ID to align with Qdrant
              user_id: userId,
              url: qdrantData.url,
              title: qdrantData.title || 'Recovered Bookmark',
              description: qdrantData.description || null,
              tags: qdrantData.tags || [],
              folder_id: qdrantData.folder_id || null,
              folder_path: qdrantData.folder_path || null,
              cover_image: qdrantData.cover_image || null,
              extracted_images: qdrantData.extracted_images || null,
              created_at: qdrantData.created_at || new Date().toISOString(),
              processing_status: 'pending', // Queue it for re-scraping
              extraction_method: null,
              extracted_content: null,
              qdrant_point_id: id,
              retry_count: 0
            })
            .select()
            .single();

          if (insertError) {
            console.error('[Reindex] Failed to insert recovered bookmark:', insertError.message);
            throw new Error(`Failed to restore recovered bookmark: ${insertError.message}`);
          }

          bookmark = data;
          isRecovered = true;
        }
      }

      if (!bookmark) {
        throw dbError; // Re-throw if it wasn't a not-found error or couldn't be recovered
      }
    }

    if (!isRecovered) {
      // 2. Check ownership for existing Supabase bookmark
      if (bookmark.user_id !== userId) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You do not have access to this bookmark'
        });
      }

      // 3. Reset processing status to pending and clear extraction info to force a re-scrape
      bookmark = await updateBookmarkRecord(id, {
        processing_status: 'pending',
        extraction_method: null,
        extracted_content: null,
        cover_image: null,
        extracted_images: null,
        error_message: null,
        retry_count: 0
      });
    }

    console.log(`[Bookmarks] User ${userId} queued bookmark ${id} for re-indexing ${isRecovered ? '(recovered from Qdrant)' : ''}`);

    res.json({
      message: isRecovered ? 'Bookmark recovered and queued for re-indexing' : 'Bookmark queued for re-indexing',
      bookmark: bookmark
    });
  } catch (error) {
    console.error('Re-index bookmark error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: `Failed to queue bookmark for re-indexing: ${error.message}`
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
