/**
 * Supabase Service
 *
 * Handles all interactions with Supabase PostgreSQL database
 */

import { supabaseAdmin } from '../config/supabase.js';

/**
 * Check if a bookmark with the same URL already exists for a user
 */
export async function checkBookmarkExists(userId, url) {
  try {
    const { data, error } = await supabaseAdmin
      .from('bookmarks')
      .select('id')
      .eq('user_id', userId)
      .eq('url', url)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return !!data; // Returns true if bookmark exists, false otherwise

  } catch (error) {
    console.error('Error checking bookmark existence in Supabase:', error);
    throw new Error(`Failed to check bookmark existence: ${error.message}`);
  }
}

/**
 * Create a bookmark record in Supabase
 */
export async function createBookmarkRecord(userId, bookmarkData) {
  try {
    const record = {
      user_id: userId,
      url: bookmarkData.url,
      title: bookmarkData.title,
      description: bookmarkData.description || null,
      tags: bookmarkData.tags || [],
      qdrant_point_id: bookmarkData.qdrant_point_id,
      processing_status: bookmarkData.processing_status || 'completed',
      extraction_method: bookmarkData.extraction_method || 'jina',
      extracted_content: bookmarkData.extracted_content || null,
      folder_id: bookmarkData.folder_id || null,
      folder_path: bookmarkData.folder_path || null,
      sources: bookmarkData.sources || (bookmarkData.folder_path ? [{
        browser: bookmarkData.browser || 'unknown',
        folder_id: bookmarkData.folder_id || null,
        folder_path: bookmarkData.folder_path || null,
        updated_at: new Date().toISOString()
      }] : []),
      error_message: bookmarkData.error_message || null,
      retry_count: bookmarkData.retry_count || 0,
      author: bookmarkData.author || null,
      site_name: bookmarkData.site_name || null,
      favicon_url: bookmarkData.favicon || bookmarkData.favicon_url || null,
      published_date: bookmarkData.published_date || null,
      reading_time: bookmarkData.reading_time || null,
      language: bookmarkData.language || null,
      notes: bookmarkData.notes || null,
      created_at: bookmarkData.created_at || new Date().toISOString()
    };

    // Only include image fields if they have actual values
    // This prevents errors when the columns don't exist yet in the database
    if (bookmarkData.cover_image) record.cover_image = bookmarkData.cover_image;
    if (bookmarkData.extracted_images && bookmarkData.extracted_images.length > 0) record.extracted_images = bookmarkData.extracted_images;

    const { data, error } = await supabaseAdmin
      .from('bookmarks')
      .insert(record)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;

  } catch (error) {
    console.error('Error creating bookmark record in Supabase:', error);
    throw new Error(`Failed to create bookmark record: ${error.message}`);
  }
}

/**
 * Create multiple bookmark records in Supabase (batch insert)
 */
export async function createBookmarkRecordsBatch(userId, bookmarksData) {
  try {
    const records = bookmarksData.map(bookmark => {
      const rec = {
        user_id: userId,
        url: bookmark.url,
        title: bookmark.title,
        processing_status: bookmark.processing_status || 'pending',
        extraction_method: bookmark.extraction_method || null,
        folder_id: bookmark.folder_id || null,
        folder_path: bookmark.folder_path || null,
        tags: bookmark.tags || [],
        sources: bookmark.sources || (bookmark.folder_path ? [{
          browser: bookmark.browser || 'unknown',
          folder_id: bookmark.folder_id || null,
          folder_path: bookmark.folder_path || null,
          updated_at: new Date().toISOString()
        }] : []),
        retry_count: 0,
        created_at: bookmark.created_at || new Date().toISOString()
      };
      if (bookmark.cover_image) rec.cover_image = bookmark.cover_image;
      if (bookmark.extracted_images && bookmark.extracted_images.length > 0) rec.extracted_images = bookmark.extracted_images;
      return rec;
    });

    // Split into chunks of 100 to avoid request size limits
    const CHUNK_SIZE = 100;
    let allCreated = [];

    for (let i = 0; i < records.length; i += CHUNK_SIZE) {
      const chunk = records.slice(i, i + CHUNK_SIZE);
      const { data, error } = await supabaseAdmin
        .from('bookmarks')
        .insert(chunk)
        .select();

      if (error) throw error;
      if (data) allCreated = [...allCreated, ...data];
    }

    return allCreated;
  } catch (error) {
    console.error('Error batch creating bookmark records in Supabase:', error);
    throw new Error(`Failed to batch create bookmark records: ${error.message}`);
  }
}

/**
 * Get all bookmark URLs for a user in a single efficient query
 */
export async function getAllUserBookmarkUrls(userId) {
  try {
    const { data, error } = await supabaseAdmin
      .from('bookmarks')
      .select('url')
      .eq('user_id', userId);

    if (error) throw error;

    return new Set(data.map(item => item.url));
  } catch (error) {
    console.error('Error fetching all user bookmark URLs:', error);
    throw new Error(`Failed to fetch bookmark URLs: ${error.message}`);
  }
}

/**
 * Update a bookmark record
 */
export async function updateBookmarkRecord(bookmarkId, updates) {
  try {
    const { data, error } = await supabaseAdmin
      .from('bookmarks')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', bookmarkId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;

  } catch (error) {
    console.error('Error updating bookmark record in Supabase:', error);
    throw new Error(`Failed to update bookmark record: ${error.message}`);
  }
}

/**
 * Upsert a source in the bookmark's sources array
 */
export async function upsertBookmarkSource(bookmarkId, sourceData) {
  try {
    // 1. Fetch current sources
    const { data: bookmark, error: fetchError } = await supabaseAdmin
      .from('bookmarks')
      .select('sources')
      .eq('id', bookmarkId)
      .single();

    if (fetchError) throw fetchError;

    let sources = bookmark.sources || [];
    if (!Array.isArray(sources)) sources = [];

    // 2. Find if source already exists (by browser name)
    const sourceIndex = sources.findIndex(s => s.browser === sourceData.browser);

    const newSourceEntry = {
      browser: sourceData.browser,
      folder_id: sourceData.folder_id,
      folder_path: sourceData.folder_path,
      updated_at: new Date().toISOString()
    };

    if (sourceIndex >= 0) {
      sources[sourceIndex] = newSourceEntry;
    } else {
      sources.push(newSourceEntry);
    }

    // 3. Update the record
    // We also update legacy fields for compatibility
    const { data, error } = await supabaseAdmin
      .from('bookmarks')
      .update({
        sources,
        folder_id: sourceData.folder_id,
        folder_path: sourceData.folder_path,
        updated_at: new Date().toISOString()
      })
      .eq('id', bookmarkId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error upserting bookmark source:', error);
    throw new Error(`Failed to upsert bookmark source: ${error.message}`);
  }
}


/**
 * Get a bookmark record by ID
 */
export async function getBookmarkRecord(bookmarkId) {
  try {
    const { data, error } = await supabaseAdmin
      .from('bookmarks')
      .select('*')
      .eq('id', bookmarkId)
      .single();

    if (error) {
      throw error;
    }

    return data;

  } catch (error) {
    console.error('Error getting bookmark record from Supabase:', error);
    throw new Error(`Failed to get bookmark record: ${error.message}`);
  }
}

/**
 * Get total count of bookmarks for a user (with filters, before tag filtering)
 */
export async function getUserBookmarkCount(userId, options = {}) {
  try {
    const {
      status = null,
      url = null,
      start_date = null,
      end_date = null,
      folder_path = null,
      folder_id = null
    } = options;

    let query = supabaseAdmin
      .from('bookmarks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (status) {
      query = query.eq('processing_status', status);
    }

    if (url) {
      query = query.eq('url', url);
    }

    // Add date range filtering
    if (start_date) {
      query = query.gte('created_at', start_date);
    }

    if (end_date) {
      query = query.lte('created_at', end_date);
    }

    if (folder_path) {
      query = query.eq('folder_path', folder_path);
    }

    if (folder_id) {
      query = query.eq('folder_id', folder_id);
    }


    const { count, error } = await query;

    if (error) {
      throw error;
    }

    return count || 0;

  } catch (error) {
    console.error('Error getting bookmark count from Supabase:', error);
    throw new Error(`Failed to get bookmark count: ${error.message}`);
  }
}

/**
 * Get all bookmark records for a user
 */
export async function getUserBookmarkRecords(userId, options = {}) {
  try {
    const {
      limit = 50,
      offset = 0,
      status = null,
      url = null,
      start_date = null,
      end_date = null,
      folder_path = null,
      folder_id = null
    } = options;

    let query = supabaseAdmin
      .from('bookmarks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('processing_status', status);
    }

    if (folder_path) {
      query = query.eq('folder_path', folder_path);
    }

    if (folder_id) {
      query = query.eq('folder_id', folder_id);
    }


    if (url) {
      query = query.eq('url', url);
    }

    // Add date range filtering
    if (start_date) {
      query = query.gte('created_at', start_date);
    }

    if (end_date) {
      query = query.lte('created_at', end_date);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return data;

  } catch (error) {
    console.error('Error getting user bookmarks from Supabase:', error);
    throw new Error(`Failed to get user bookmarks: ${error.message}`);
  }
}

/**
 * Delete a bookmark record
 */
export async function deleteBookmarkRecord(bookmarkId) {
  try {
    const { error } = await supabaseAdmin
      .from('bookmarks')
      .delete()
      .eq('id', bookmarkId);

    if (error) {
      throw error;
    }

    return true;

  } catch (error) {
    console.error('Error deleting bookmark record from Supabase:', error);
    throw new Error(`Failed to delete bookmark record: ${error.message}`);
  }
}

/**
 * Create search history entry
 */
export async function createSearchHistory(userId, searchData) {
  try {
    const { data, error } = await supabaseAdmin
      .from('search_history')
      .insert({
        user_id: userId,
        query: searchData.query,
        filters: searchData.filters || {},
        result_count: searchData.result_count || 0
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;

  } catch (error) {
    console.error('Error creating search history in Supabase:', error);
    throw new Error(`Failed to create search history: ${error.message}`);
  }
}

/**
 * Get user preferences
 */
export async function getUserPreferences(userId) {
  try {
    const { data, error } = await supabaseAdmin
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw error;
    }

    // Return default preferences if none exist
    return data || {
      user_id: userId,
      default_tags: [],
      auto_extract: true,
      search_threshold: 0.7,
      max_results: 20
    };

  } catch (error) {
    console.error('Error getting user preferences from Supabase:', error);
    throw new Error(`Failed to get user preferences: ${error.message}`);
  }
}

/**
 * Update or create user preferences
 */
export async function upsertUserPreferences(userId, preferences) {
  try {
    const { data, error } = await supabaseAdmin
      .from('user_preferences')
      .upsert({
        user_id: userId,
        ...preferences,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;

  } catch (error) {
    console.error('Error upserting user preferences in Supabase:', error);
    throw new Error(`Failed to update user preferences: ${error.message}`);
  }
}

/**
 * Create an import job
 */
export async function createImportJob(userId, importData) {
  try {
    const { data, error } = await supabaseAdmin
      .from('import_jobs')
      .insert({
        user_id: userId,
        source: importData.source,
        total_bookmarks: importData.total_bookmarks,
        processed_count: 0,
        failed_count: 0,
        status: 'pending'
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;

  } catch (error) {
    console.error('Error creating import job in Supabase:', error);
    throw new Error(`Failed to create import job: ${error.message}`);
  }
}

/**
 * Update an import job
 */
export async function updateImportJob(jobId, updates) {
  try {
    const { data, error } = await supabaseAdmin
      .from('import_jobs')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;

  } catch (error) {
    console.error('Error updating import job in Supabase:', error);
    throw new Error(`Failed to update import job: ${error.message}`);
  }
}

/**
 * Delete all bookmark records for a user
 * Used for re-import scenarios where user wants to start fresh
 *
 * @param {string} userId - User ID
 * @returns {Promise<number>} Number of bookmarks deleted
 */
export async function deleteAllUserBookmarks(userId) {
  try {
    console.log(`[Supabase] Deleting all bookmarks for user ${userId}...`);

    // Delete all bookmark records for this user
    const { data, error } = await supabaseAdmin
      .from('bookmarks')
      .delete()
      .eq('user_id', userId)
      .select();

    if (error) {
      throw error;
    }

    const deletedCount = data?.length || 0;
    console.log(`[Supabase] Deleted ${deletedCount} bookmark records`);

    return deletedCount;

  } catch (error) {
    console.error('Error deleting all user bookmarks from Supabase:', error);
    throw new Error(`Failed to delete all user bookmarks: ${error.message}`);
  }
}

/**
 * Get all unique folder paths for a user
 *
 * @param {string} userId - User ID
 * @returns {Promise<string[]>} List of unique folder paths
 */
export async function getUserUniqueFolderPaths(userId) {
  try {
    const { data, error } = await supabaseAdmin
      .from('bookmarks')
      .select('folder_path')
      .eq('user_id', userId)
      .not('folder_path', 'is', null);

    if (error) {
      throw error;
    }

    // Extract unique paths and filter out empty strings
    const uniquePaths = [...new Set(data.map(d => d.folder_path))].filter(Boolean);
    return uniquePaths;

  } catch (error) {
    console.error('Error fetching unique folder paths from Supabase:', error);
    throw new Error(`Failed to fetch unique folder paths: ${error.message}`);
  }
}

