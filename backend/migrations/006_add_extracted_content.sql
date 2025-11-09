-- ============================================
-- BookSmart Database Schema
-- Migration 006: Add extracted_content column
-- ============================================

-- Add extracted_content column to store locally extracted content from extension
ALTER TABLE bookmarks
ADD COLUMN IF NOT EXISTS extracted_content TEXT;

-- Add comment for documentation
COMMENT ON COLUMN bookmarks.extracted_content IS 'Content extracted locally from browser using Readability.js. Used as primary source, with Jina as fallback.';
