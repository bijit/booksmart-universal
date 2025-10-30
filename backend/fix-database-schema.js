/**
 * Database Schema Fix
 *
 * This script checks and fixes the Supabase schema
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: resolve(__dirname, '../.env.local') });

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔧 Database Schema Fix');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSchema() {
  try {
    // Try to query a bookmark
    const { data, error } = await supabase
      .from('bookmarks')
      .select('*')
      .limit(1);

    if (error) {
      if (error.message.includes('does not exist')) {
        console.log('❌ Table "bookmarks" does not exist!');
        console.log('\n📋 You need to create the table. Run this SQL in Supabase SQL Editor:\n');
        console.log('   https://app.supabase.com/project/_/sql\n');
        printMigrationSQL();
        return false;
      }
      throw error;
    }

    if (!data || data.length === 0) {
      console.log('⚠️  Table exists but is empty (this is OK for a new database)');
      return true;
    }

    // Check if processing_status column exists
    const bookmark = data[0];
    const hasProcessingStatus = 'processing_status' in bookmark;

    if (!hasProcessingStatus) {
      console.log('❌ PROBLEM FOUND: "processing_status" column is missing!\n');
      console.log('🔧 FIX: Run this SQL in Supabase SQL Editor:\n');
      console.log('─'.repeat(60));
      console.log(`
-- Add missing column
ALTER TABLE bookmarks
ADD COLUMN IF NOT EXISTS processing_status TEXT NOT NULL DEFAULT 'pending';

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_bookmarks_status
ON bookmarks(processing_status);

-- Add comment
COMMENT ON COLUMN bookmarks.processing_status
IS 'Tracks processing: pending → processing → completed/failed';
`.trim());
      console.log('─'.repeat(60));
      console.log('\n📍 Run this at: ' + process.env.SUPABASE_URL.replace('//', '//app.') + '/sql\n');
      return false;
    }

    console.log('✅ Schema looks good! All required columns exist.\n');
    console.log('Columns found:');
    Object.keys(bookmark).forEach(key => {
      console.log(`   • ${key}`);
    });
    console.log('');

    return true;

  } catch (error) {
    console.error('❌ Error checking schema:', error.message);
    return false;
  }
}

function printMigrationSQL() {
  console.log('─'.repeat(60));
  console.log(`
-- BookSmart Database Schema - Migration 001

CREATE TABLE IF NOT EXISTS bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT,
  qdrant_point_id UUID,
  processing_status TEXT NOT NULL DEFAULT 'pending',
  extraction_method TEXT,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id ON bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_status ON bookmarks(processing_status);
CREATE INDEX IF NOT EXISTS idx_bookmarks_created_at ON bookmarks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookmarks_url ON bookmarks(url);

-- Trigger for updated_at
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
`.trim());
  console.log('─'.repeat(60));
  console.log('');
}

async function main() {
  const isValid = await checkSchema();

  if (isValid) {
    console.log('🎉 Database schema is ready to use!\n');
    console.log('Next steps:');
    console.log('  1. Test Railway deployment: node test-railway-e2e.js');
    console.log('  2. If worker is running, bookmarks should process');
    console.log('  3. Then configure and test extension\n');
  } else {
    console.log('⚠️  Please fix the schema issues above first.\n');
    console.log('After fixing:');
    console.log('  1. Run this script again to verify');
    console.log('  2. Then test Railway deployment\n');
  }
}

main();
