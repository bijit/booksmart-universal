/**
 * Apply Migration 009: Add visual features (images)
 *
 * This script provides the SQL to add support for cover images and extracted images.
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// We try to load production env if local doesn't exist
config({ path: resolve(__dirname, '.env.production') });
config({ path: resolve(__dirname, '../.env.local') });

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔧 Applying Migration 009: Add Visual Features');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

async function applyMigration() {
  try {
    // Read the migration SQL
    const migrationSQL = readFileSync(
      resolve(__dirname, 'migrations/009_add_visual_features.sql'),
      'utf-8'
    );

    console.log('📄 Migration SQL:');
    console.log('─'.repeat(60));
    console.log(migrationSQL);
    console.log('─'.repeat(60));
    console.log('');

    const supabaseUrl = process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL';
    console.log('⚠️  Please apply this migration manually in Supabase SQL Editor:');
    console.log(`   ${supabaseUrl.replace('//', '//app.')}/sql\n`);

    console.log('After applying the migration:');
    console.log('  1. Deploy the backend (to enable image extraction)');
    console.log('  2. Deploy the manager (to enable Pinterest layout)');
    console.log('  3. Add a new bookmark to test the visual features\n');

  } catch (error) {
    console.error('❌ Error reading migration file:', error.message);
    process.exit(1);
  }
}

applyMigration();
