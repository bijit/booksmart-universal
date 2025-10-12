-- ============================================
-- BookSmart Database Schema
-- Migration 005: Row Level Security (RLS) Policies
-- ============================================

-- Enable RLS on all tables
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Bookmarks Policies
-- ============================================

-- Users can only see their own bookmarks
CREATE POLICY "Users can view own bookmarks"
  ON bookmarks FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own bookmarks
CREATE POLICY "Users can insert own bookmarks"
  ON bookmarks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own bookmarks
CREATE POLICY "Users can update own bookmarks"
  ON bookmarks FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own bookmarks
CREATE POLICY "Users can delete own bookmarks"
  ON bookmarks FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- Search History Policies
-- ============================================

CREATE POLICY "Users can view own search history"
  ON search_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own search history"
  ON search_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- User Preferences Policies
-- ============================================

CREATE POLICY "Users can view own preferences"
  ON user_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
  ON user_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON user_preferences FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================
-- Import Jobs Policies
-- ============================================

CREATE POLICY "Users can view own import jobs"
  ON import_jobs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own import jobs"
  ON import_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own import jobs"
  ON import_jobs FOR UPDATE
  USING (auth.uid() = user_id);

-- Add comments
COMMENT ON POLICY "Users can view own bookmarks" ON bookmarks IS 'RLS: Users can only access their own bookmarks';
COMMENT ON POLICY "Users can view own search history" ON search_history IS 'RLS: Users can only see their own search history';
