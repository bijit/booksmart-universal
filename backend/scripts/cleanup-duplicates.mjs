#!/usr/bin/env node

/**
 * Cleanup Duplicates Script
 * Identifies duplicate bookmarks (same user_id and url), merges their sources,
 * updates the best bookmark, and deletes redundant ones from Supabase & Qdrant.
 *
 * Run with: node backend/scripts/cleanup-duplicates.mjs
 */

import '../src/config/env.js';
import { supabaseAdmin } from '../src/config/supabase.js';
import { deleteBookmarkRecord, updateBookmarkRecord } from '../src/services/supabase.service.js';
import { deleteBookmark, deleteBookmarkChunks } from '../src/services/qdrant.service.js';

async function cleanupDuplicates() {
  console.log('\n🧹 Starting Duplicate Bookmarks Cleanup...\n');

  try {
    // 1. Fetch all bookmarks
    const { data: bookmarks, error } = await supabaseAdmin
      .from('bookmarks')
      .select('*');

    if (error) {
      throw error;
    }

    if (!bookmarks || bookmarks.length === 0) {
      console.log('ℹ️ No bookmarks found in the database.');
      return;
    }

    console.log(`📊 Total bookmarks scanned: ${bookmarks.length}`);

    // 2. Group by user_id and url
    const groups = {};
    for (const b of bookmarks) {
      const key = `${b.user_id}:${b.url}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(b);
    }

    // 3. Filter groups with duplicates
    const duplicateGroups = Object.values(groups).filter(g => g.length > 1);

    if (duplicateGroups.length === 0) {
      console.log('✅ No duplicate bookmarks found! Database is already clean.');
      return;
    }

    console.log(`🔍 Found ${duplicateGroups.length} duplicate group(s) to merge/cleanup.`);

    let totalMerged = 0;
    let totalDeleted = 0;

    for (const group of duplicateGroups) {
      // Find the "best" bookmark in the group
      // Best = has full text (not 'metadata' extraction method), has description, or is the oldest
      const best = group.reduce((prev, curr) => {
        const prevIsMetadata = prev.extraction_method === 'metadata';
        const currIsMetadata = curr.extraction_method === 'metadata';

        if (prevIsMetadata && !currIsMetadata) {
          return curr; // Current has full content, previous only has metadata
        }
        if (!prevIsMetadata && currIsMetadata) {
          return prev; // Previous has full content, current only has metadata
        }

        // Compare content length if both have content
        const prevContentLen = (prev.extracted_content || '').length;
        const currContentLen = (curr.extracted_content || '').length;
        if (prevContentLen !== currContentLen) {
          return prevContentLen > currContentLen ? prev : curr;
        }

        // Compare description length
        const prevDescLen = (prev.description || '').length;
        const currDescLen = (curr.description || '').length;
        if (prevDescLen !== currDescLen) {
          return prevDescLen > currDescLen ? prev : curr;
        }

        // Keep oldest by default
        return new Date(prev.created_at) <= new Date(curr.created_at) ? prev : curr;
      });

      console.log(`\n🔗 Merging duplicate group for: ${best.url}`);
      console.log(`   🏆 Keeping best bookmark ID: ${best.id} (Method: ${best.extraction_method || 'none'}, Status: ${best.processing_status})`);

      // Merge sources arrays
      const mergedSourcesMap = new Map();

      // Collect sources from all bookmarks in the group
      for (const item of group) {
        // Collect primary folder path if present
        if (item.folder_path) {
          const key = `${item.browser || 'unknown'}:${item.folder_path}`;
          mergedSourcesMap.set(key, {
            browser: item.browser || 'unknown',
            folder_id: item.folder_id || null,
            folder_path: item.folder_path,
            updated_at: item.updated_at || item.created_at || new Date().toISOString()
          });
        }

        // Collect array sources if present
        if (Array.isArray(item.sources)) {
          for (const src of item.sources) {
            if (src && src.folder_path) {
              const key = `${src.browser || 'unknown'}:${src.folder_path}`;
              const existingSrc = mergedSourcesMap.get(key);
              // If already exists, keep the one with the newer update timestamp
              if (!existingSrc || new Date(src.updated_at) > new Date(existingSrc.updated_at)) {
                mergedSourcesMap.set(key, src);
              }
            }
          }
        }
      }

      const mergedSources = Array.from(mergedSourcesMap.values());

      // Update the best bookmark with consolidated sources and tags
      // Merge unique tags
      const uniqueTags = new Set(group.flatMap(item => item.tags || []));
      
      // If we are upgrading or updating folder paths to the latest synced one
      const updates = {
        sources: mergedSources,
        tags: Array.from(uniqueTags)
      };

      // If best folder path is empty but one of the duplicates has it, update it
      const folderItem = group.find(item => item.folder_path);
      if (!best.folder_path && folderItem) {
        updates.folder_path = folderItem.folder_path;
        updates.folder_id = folderItem.folder_id || null;
      }

      await updateBookmarkRecord(best.id, updates);
      console.log(`   ✅ Updated best bookmark with ${mergedSources.length} source(s) and ${updates.tags.length} tag(s)`);

      // Delete other redundant duplicate records
      const redundant = group.filter(item => item.id !== best.id);
      for (const item of redundant) {
        console.log(`   🗑️  Deleting duplicate record: ${item.id}`);

        // Delete from Supabase
        await deleteBookmarkRecord(item.id);

        // Delete from Qdrant
        if (item.qdrant_point_id) {
          try {
            await deleteBookmark(item.qdrant_point_id);
          } catch (qe) {
            console.warn(`      ⚠️  Failed to delete Qdrant point ${item.qdrant_point_id}:`, qe.message);
          }
        }
        try {
          await deleteBookmarkChunks(item.id);
        } catch (qe) {
          console.warn(`      ⚠️  Failed to delete Qdrant chunks for bookmark ${item.id}:`, qe.message);
        }

        totalDeleted++;
      }

      totalMerged++;
    }

    console.log(`\n🎉 Duplicate cleanup complete!`);
    console.log(`   • Duplicates merged: ${totalMerged}`);
    console.log(`   • Redundant rows deleted: ${totalDeleted}\n`);

  } catch (err) {
    console.error('❌ Duplicate cleanup failed:', err);
    process.exit(1);
  }
}

cleanupDuplicates();
