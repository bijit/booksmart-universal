-- ============================================
-- BookSmart Database Schema
-- Migration 002: Create search_history table
-- ============================================

-- Create search_history table for analytics
CREATE TABLE IF NOT EXISTS search_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  results_count INTEGER DEFAULT 0,
  response_time_ms INTEGER, -- Response time in milliseconds
  search_type TEXT, -- 'semantic', 'full_text', 'hybrid'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_search_history_user_id
  ON search_history(user_id);

CREATE INDEX IF NOT EXISTS idx_search_history_created_at
  ON search_history(created_at DESC);

-- Add comments
COMMENT ON TABLE search_history IS 'Logs all user searches for analytics and improving search quality';
COMMENT ON COLUMN search_history.response_time_ms IS 'Time taken to return results, for performance monitoring';
