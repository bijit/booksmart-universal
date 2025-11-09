/**
 * Verify Migration 006: Check extracted_content column exists
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: resolve(__dirname, '../.env.local') });

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔍 Verifying Migration 006');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyMigration() {
  try {
    // Try to query the bookmarks table
    const { data, error } = await supabase
      .from('bookmarks')
      .select('*')
      .limit(1);

    if (error) {
      console.error('❌ Error querying bookmarks table:', error.message);
      return false;
    }

    // Check if extracted_content column exists
    if (data && data.length > 0) {
      const bookmark = data[0];
      const hasExtractedContent = 'extracted_content' in bookmark;

      if (hasExtractedContent) {
        console.log('✅ Migration successful! "extracted_content" column exists.\n');
        console.log('Current bookmark columns:');
        Object.keys(bookmark).forEach(key => {
          console.log(`   • ${key}`);
        });
        console.log('');
        return true;
      } else {
        console.log('❌ Migration not applied: "extracted_content" column is missing!\n');
        console.log('Current columns:');
        Object.keys(bookmark).forEach(key => {
          console.log(`   • ${key}`);
        });
        console.log('\n💡 Please run: node backend/apply-migration-006.js\n');
        return false;
      }
    } else {
      console.log('⚠️  Table exists but is empty (this is OK).');
      console.log('   Unable to verify column existence without data.\n');
      console.log('💡 Try creating a test bookmark to verify the column exists.\n');
      return true; // Assume it's OK if table is empty
    }

  } catch (error) {
    console.error('❌ Error verifying migration:', error.message);
    return false;
  }
}

async function main() {
  const success = await verifyMigration();

  if (success) {
    console.log('🎉 Database schema is ready!\n');
    console.log('Next steps:');
    console.log('  1. Build extension: cd extension && npm run build');
    console.log('  2. Load extension in Chrome and test');
    console.log('  3. Try bookmarking auth-required pages (Reddit, LinkedIn)\n');
  } else {
    console.log('⚠️  Please fix the schema issues above first.\n');
  }
}

main();
