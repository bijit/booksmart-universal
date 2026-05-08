-- ============================================
-- BookSmart Database Schema
-- Migration 008: Add folder hierarchy support
-- ============================================

-- Add folder columns to bookmarks table
ALTER TABLE bookmarks
ADD COLUMN IF NOT EXISTS folder_id TEXT,
ADD COLUMN IF NOT EXISTS folder_path TEXT;

-- Add comments for documentation
COMMENT ON COLUMN bookmarks.folder_id IS 'Native browser bookmark folder ID';
COMMENT ON COLUMN bookmarks.folder_path IS 'Recursive path of the folder (e.g., Tools > Research > AI)';

-- Create an index on folder_path for faster hierarchical filtering
CREATE INDEX IF NOT EXISTS idx_bookmarks_folder_path ON bookmarks (folder_path);
