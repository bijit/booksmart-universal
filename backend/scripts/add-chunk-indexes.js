#!/usr/bin/env node

/**
 * Add Chunk Indexes Migration Script
 *
 * This script adds the missing payload indexes required for chunking functionality:
 * - is_chunk (bool): Used to filter chunk points vs legacy bookmark points
 * - bookmark_id (keyword): Used to find all chunks for a specific bookmark
 *
 * Run with: node backend/scripts/add-chunk-indexes.js
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { QdrantClient } from '@qdrant/js-client-rest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.local from project root (two levels up from scripts/)
config({ path: resolve(__dirname, '../../.env.local') });

// Validate environment variables
function validateEnv() {
  const required = ['QDRANT_URL', 'QDRANT_API_KEY', 'QDRANT_COLLECTION_NAME'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(key => console.error(`   - ${key}`));
    console.error('\nPlease check your .env.local file');
    process.exit(1);
  }
}

async function addChunkIndexes() {
  console.log('🔧 Adding chunk indexes to Qdrant collection...\n');

  validateEnv();

  const client = new QdrantClient({
    url: process.env.QDRANT_URL,
    apiKey: process.env.QDRANT_API_KEY,
  });

  const collectionName = process.env.QDRANT_COLLECTION_NAME;

  try {
    // Test connection
    console.log('🔗 Testing Qdrant connection...');
    const collections = await client.getCollections();
    console.log('✅ Connected to Qdrant successfully\n');

    // Check if collection exists
    console.log(`🔍 Checking if collection '${collectionName}' exists...`);
    const collectionExists = collections.collections.some(
      col => col.name === collectionName
    );

    if (!collectionExists) {
      console.error(`❌ Collection '${collectionName}' does not exist`);
      console.error('   Run setup-qdrant.js first to create the collection\n');
      process.exit(1);
    }

    console.log(`✅ Collection '${collectionName}' found\n`);

    // Create payload indexes for chunking
    console.log('📇 Creating chunk payload indexes...\n');

    // Index 1: is_chunk (bool)
    console.log('   Creating index on is_chunk (bool)...');
    try {
      await client.createPayloadIndex(collectionName, {
        field_name: 'is_chunk',
        field_schema: 'bool',
      });
      console.log('   ✅ Index on is_chunk created');
    } catch (error) {
      if (error.message && error.message.includes('already exists')) {
        console.log('   ℹ️  Index on is_chunk already exists (skipping)');
      } else {
        throw error;
      }
    }

    // Index 2: bookmark_id (keyword)
    console.log('   Creating index on bookmark_id (keyword)...');
    try {
      await client.createPayloadIndex(collectionName, {
        field_name: 'bookmark_id',
        field_schema: 'keyword',
      });
      console.log('   ✅ Index on bookmark_id created\n');
    } catch (error) {
      if (error.message && error.message.includes('already exists')) {
        console.log('   ℹ️  Index on bookmark_id already exists (skipping)\n');
      } else {
        throw error;
      }
    }

    // Verify setup
    console.log('🔍 Verifying collection setup...');
    const collectionInfo = await client.getCollection(collectionName);

    console.log('\n✅ Chunk indexes added successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Collection Details:');
    console.log(`   Name: ${collectionName}`);
    console.log(`   Points count: ${collectionInfo.points_count || 0}`);
    console.log(`   Status: Ready for chunked search`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('❌ Error adding chunk indexes:');
    console.error(`   ${error.message}\n`);

    if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
      console.error('💡 Troubleshooting:');
      console.error('   - Check QDRANT_URL is correct');
      console.error('   - Ensure your Qdrant cluster is running');
      console.error('   - Verify you have internet connection\n');
    } else if (error.message.includes('Unauthorized') || error.message.includes('403')) {
      console.error('💡 Troubleshooting:');
      console.error('   - Check QDRANT_API_KEY is correct');
      console.error('   - Verify the API key has proper permissions\n');
    }

    process.exit(1);
  }
}

// Run migration
addChunkIndexes().catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
