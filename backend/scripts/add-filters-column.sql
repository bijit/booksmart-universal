-- Add filters column to search_history table
-- This column stores the search filters used (tags, scoreThreshold, etc.)
-- Run this in Supabase SQL Editor

-- Add the filters column (JSONB type for flexible filter storage)
ALTER TABLE search_history
ADD COLUMN IF NOT EXISTS filters JSONB DEFAULT '{}';

-- Add a comment to document the column
COMMENT ON COLUMN search_history.filters IS 'JSONB object containing search filters (tags, scoreThreshold, etc.)';

-- Optional: Create an index on filters for better query performance
CREATE INDEX IF NOT EXISTS idx_search_history_filters ON search_history USING GIN (filters);
