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
    const { data, error } = await supabaseAdmin
      .from('bookmarks')
      .insert({
        user_id: userId,
        url: bookmarkData.url,
        title: bookmarkData.title,
        qdrant_point_id: bookmarkData.qdrant_point_id,
        processing_status: bookmarkData.processing_status || 'completed',
        extraction_method: bookmarkData.extraction_method || 'jina',
        extracted_content: bookmarkData.extracted_content || null,
        error_message: bookmarkData.error_message || null,
        retry_count: bookmarkData.retry_count || 0
      })
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
      end_date = null
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
      end_date = null
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
