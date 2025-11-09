/**
 * Apply Migration 006: Add extracted_content column
 *
 * This script adds support for locally extracted content from the browser extension.
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: resolve(__dirname, '../.env.local') });

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔧 Applying Migration 006: Add extracted_content');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function applyMigration() {
  try {
    // Read the migration SQL
    const migrationSQL = readFileSync(
      resolve(__dirname, 'migrations/006_add_extracted_content.sql'),
      'utf-8'
    );

    console.log('📄 Migration SQL:');
    console.log('─'.repeat(60));
    console.log(migrationSQL);
    console.log('─'.repeat(60));
    console.log('');

    console.log('⚠️  Please apply this migration manually in Supabase SQL Editor:');
    console.log(`   ${process.env.SUPABASE_URL.replace('//', '//app.')}/sql\n`);

    console.log('After applying the migration:');
    console.log('  1. Run: node backend/verify-migration-006.js');
    console.log('  2. Build extension: cd extension && npm run build');
    console.log('  3. Deploy backend to Railway (will auto-deploy on git push)');
    console.log('  4. Test with auth-required pages (Reddit, LinkedIn, etc.)\n');

  } catch (error) {
    console.error('❌ Error reading migration file:', error.message);
    process.exit(1);
  }
}

applyMigration();
