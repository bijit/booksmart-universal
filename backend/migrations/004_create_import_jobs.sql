-- ============================================
-- BookSmart Database Schema
-- Migration 004: Create import_jobs table
-- ============================================

-- Create import_jobs table for bulk imports
CREATE TABLE IF NOT EXISTS import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_bookmarks INTEGER NOT NULL,
  processed_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_import_jobs_user_id
  ON import_jobs(user_id);

CREATE INDEX IF NOT EXISTS idx_import_jobs_status
  ON import_jobs(status);

CREATE INDEX IF NOT EXISTS idx_import_jobs_created_at
  ON import_jobs(created_at DESC);

-- Add comments
COMMENT ON TABLE import_jobs IS 'Tracks bulk bookmark import jobs for progress monitoring';
COMMENT ON COLUMN import_jobs.processed_count IS 'Number of bookmarks processed so far';
COMMENT ON COLUMN import_jobs.success_count IS 'Number successfully imported';
COMMENT ON COLUMN import_jobs.failed_count IS 'Number that failed to import';
