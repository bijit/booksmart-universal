-- Add missing columns to search_history table
-- Run this in Supabase SQL Editor

-- Add the filters column (JSONB type for flexible filter storage)
ALTER TABLE search_history
ADD COLUMN IF NOT EXISTS filters JSONB DEFAULT '{}';

-- Add the result_count column (integer to track number of results)
ALTER TABLE search_history
ADD COLUMN IF NOT EXISTS result_count INTEGER DEFAULT 0;

-- Add comments to document the columns
COMMENT ON COLUMN search_history.filters IS 'JSONB object containing search filters (tags, scoreThreshold, etc.)';
COMMENT ON COLUMN search_history.result_count IS 'Number of results returned by the search';

-- Create an index on filters for better query performance
CREATE INDEX IF NOT EXISTS idx_search_history_filters ON search_history USING GIN (filters);
