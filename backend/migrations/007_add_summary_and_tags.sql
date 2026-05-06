-- ============================================
-- BookSmart Database Schema
-- Migration 007: Add description and tags columns
-- ============================================

-- Add description and tags columns to bookmarks table
ALTER TABLE bookmarks
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Add comments for documentation
COMMENT ON COLUMN bookmarks.description IS 'AI-generated summary of the page content';
COMMENT ON COLUMN bookmarks.tags IS 'AI-generated tags/keywords for the bookmark';
