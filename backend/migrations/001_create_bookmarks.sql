-- ============================================
-- BookSmart Database Schema
-- Migration 001: Create bookmarks table
-- ============================================

-- Create bookmarks table
CREATE TABLE IF NOT EXISTS bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT,
  qdrant_point_id UUID, -- Reference to Qdrant vector
  processing_status TEXT NOT NULL DEFAULT 'pending',
    -- Status values: 'pending', 'processing', 'completed', 'failed'
  extraction_method TEXT,
    -- Method used: 'jina', 'puppeteer', 'metadata', 'content_script'
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id
  ON bookmarks(user_id);

CREATE INDEX IF NOT EXISTS idx_bookmarks_status
  ON bookmarks(processing_status);

CREATE INDEX IF NOT EXISTS idx_bookmarks_created_at
  ON bookmarks(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bookmarks_url
  ON bookmarks(url);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_bookmarks_updated_at
  BEFORE UPDATE ON bookmarks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE bookmarks IS 'Stores bookmark metadata and processing status. Full content stored in Qdrant.';
COMMENT ON COLUMN bookmarks.qdrant_point_id IS 'UUID of the corresponding vector point in Qdrant collection';
COMMENT ON COLUMN bookmarks.processing_status IS 'Tracks processing: pending → processing → completed/failed';
COMMENT ON COLUMN bookmarks.extraction_method IS 'Method used for content extraction (jina, puppeteer, etc.)';
