-- ============================================
-- BookSmart Database Schema
-- Migration 012: Add unique constraint on bookmarks(user_id, url)
-- ============================================

-- Add unique constraint to prevent duplicate bookmarks for the same user
ALTER TABLE bookmarks
ADD CONSTRAINT unique_user_bookmark_url UNIQUE (user_id, url);

-- Comment for documentation
COMMENT ON CONSTRAINT unique_user_bookmark_url ON bookmarks IS 'Prevents a user from saving duplicate bookmarks for the same URL, securing sync operations';
