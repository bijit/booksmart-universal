-- Add detailed_summary column to bookmarks table
-- Run this in Supabase SQL Editor
ALTER TABLE bookmarks 
ADD COLUMN IF NOT EXISTS detailed_summary JSONB;

-- Add a comment for documentation
COMMENT ON COLUMN bookmarks.detailed_summary IS 'Stores LLM-generated deep summaries, key takeaways, and structured analysis.';
