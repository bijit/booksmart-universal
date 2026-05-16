-- ============================================
-- BookSmart Database Schema
-- Migration 010: Add Notes and Extended Metadata
-- ============================================

-- Add new columns to bookmarks table
ALTER TABLE bookmarks
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS author TEXT,
ADD COLUMN IF NOT EXISTS site_name TEXT,
ADD COLUMN IF NOT EXISTS favicon_url TEXT,
ADD COLUMN IF NOT EXISTS published_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reading_time INTEGER, -- in minutes
ADD COLUMN IF NOT EXISTS language TEXT;

-- Add comments for documentation
COMMENT ON COLUMN bookmarks.notes IS 'Personal notes added by the user';
COMMENT ON COLUMN bookmarks.author IS 'Author of the content';
COMMENT ON COLUMN bookmarks.site_name IS 'Name of the website/source';
COMMENT ON COLUMN bookmarks.favicon_url IS 'URL of the websites favicon';
COMMENT ON COLUMN bookmarks.published_date IS 'Date the content was published';
COMMENT ON COLUMN bookmarks.reading_time IS 'Estimated reading time in minutes';
COMMENT ON COLUMN bookmarks.language IS 'Language of the content (e.g., en, es)';

-- Add index for site_name for better filtering
CREATE INDEX IF NOT EXISTS idx_bookmarks_site_name ON bookmarks(site_name);
