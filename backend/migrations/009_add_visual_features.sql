-- ============================================
-- BookSmart Database Schema
-- Migration 009: Add visual features columns (images)
-- ============================================

-- Add cover_image and extracted_images columns to bookmarks table
ALTER TABLE bookmarks
ADD COLUMN IF NOT EXISTS cover_image TEXT,
ADD COLUMN IF NOT EXISTS extracted_images TEXT[] DEFAULT '{}';

-- Add comments for documentation
COMMENT ON COLUMN bookmarks.cover_image IS 'Hero image URL for the bookmark (from og:image or similar)';
COMMENT ON COLUMN bookmarks.extracted_images IS 'Gallery of images extracted from the page content';
