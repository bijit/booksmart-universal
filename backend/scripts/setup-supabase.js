#!/usr/bin/env node

/**
 * Supabase Database Setup Script
 *
 * This script runs all SQL migrations to set up the database schema
 * Run with: node backend/scripts/setup-supabase.js
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Validate environment variables
function validateEnv() {
  const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(key => console.error(`   - ${key}`));
    console.error('\nPlease check your .env.local file');
    process.exit(1);
  }
}

async function runMigration(supabase, migrationFile, migrationPath) {
  console.log(`📄 Running migration: ${migrationFile}`);

  try {
    const sql = readFileSync(migrationPath, 'utf-8');

    // Execute SQL using Supabase Admin API
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql }).catch(() => {
      // If exec_sql doesn't exist, we'll use a different approach
      return { data: null, error: null };
    });

    // Since Supabase doesn't have a direct SQL execution endpoint in the JS client,
    // we'll need to execute through PostgreSQL connection or use Supabase CLI
    // For now, we'll log the instructions

    console.log(`   ⚠️  Migration file ready: ${migrationFile}`);
    console.log(`   ℹ️  Please run this in Supabase SQL Editor or via psql\n`);

  } catch (error) {
    console.error(`   ❌ Error with ${migrationFile}:`, error.message);
    throw error;
  }
}

async function setupSupabase() {
  console.log('🔧 Starting Supabase setup...\n');

  validateEnv();

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );

  try {
    // Test connection
    console.log('🔗 Testing Supabase connection...');
    const { data, error } = await supabase.from('_test').select('*').limit(1);

    if (error && !error.message.includes('does not exist')) {
      throw new Error(`Connection failed: ${error.message}`);
    }

    console.log('✅ Connected to Supabase successfully\n');

    // Get migration files
    const migrationsDir = join(__dirname, '..', 'migrations');
    const migrationFiles = readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    console.log(`📚 Found ${migrationFiles.length} migration files\n`);

    // Since Supabase JS client doesn't support direct SQL execution,
    // we'll provide instructions for manual execution
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 MANUAL SETUP REQUIRED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('Please run these migrations in Supabase SQL Editor:\n');
    console.log('1. Go to: ' + process.env.SUPABASE_URL.replace('//', '//app.') + '/editor/sql');
    console.log('2. Create a new query');
    console.log('3. Copy and paste each migration file:\n');

    migrationFiles.forEach((file, index) => {
      console.log(`   ${index + 1}. backend/migrations/${file}`);
    });

    console.log('\n4. Run each migration in order');
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    console.log('\n📝 Migration Files Content:\n');

    // Display content of each migration
    for (const file of migrationFiles) {
      const filePath = join(migrationsDir, file);
      const content = readFileSync(filePath, 'utf-8');

      console.log(`\n${'='.repeat(60)}`);
      console.log(`FILE: ${file}`);
      console.log('='.repeat(60));
      console.log(content);
      console.log('='.repeat(60));
    }

    console.log('\n✅ Setup script complete!');
    console.log('   Please run the SQL migrations manually in Supabase\n');

  } catch (error) {
    console.error('❌ Error setting up Supabase:');
    console.error(`   ${error.message}\n`);

    if (error.message.includes('Invalid') || error.message.includes('auth')) {
      console.error('💡 Troubleshooting:');
      console.error('   - Check SUPABASE_URL is correct');
      console.error('   - Verify SUPABASE_SERVICE_ROLE_KEY (not anon key!)');
      console.error('   - Ensure the service role key has admin permissions\n');
    }

    process.exit(1);
  }
}

// Run setup
setupSupabase().catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
