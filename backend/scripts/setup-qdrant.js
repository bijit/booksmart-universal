#!/usr/bin/env node

/**
 * Qdrant Collection Setup Script
 *
 * This script creates the 'bookmarks' collection in Qdrant Cloud
 * with proper vector configuration (768 dimensions for Google embeddings)
 *
 * Run with: node backend/scripts/setup-qdrant.js
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

async function setupQdrant() {
  console.log('🔧 Starting Qdrant setup...\n');

  validateEnv();

  const client = new QdrantClient({
    url: process.env.QDRANT_URL,
    apiKey: process.env.QDRANT_API_KEY,
  });

  const collectionName = process.env.QDRANT_COLLECTION_NAME;
  const vectorSize = parseInt(process.env.VECTOR_DIMENSIONS || '768');

  try {
    // Test connection
    console.log('🔗 Testing Qdrant connection...');
    const collections = await client.getCollections();
    console.log('✅ Connected to Qdrant successfully\n');

    // Check if collection already exists
    console.log(`🔍 Checking if collection '${collectionName}' exists...`);
    const collectionExists = collections.collections.some(
      col => col.name === collectionName
    );

    if (collectionExists) {
      console.log(`⚠️  Collection '${collectionName}' already exists`);
      console.log('   Skipping creation (idempotent operation)\n');

      // Show collection info
      const collectionInfo = await client.getCollection(collectionName);
      console.log('📊 Collection Info:');
      console.log(`   - Vectors count: ${collectionInfo.vectors_count || 0}`);
      console.log(`   - Points count: ${collectionInfo.points_count || 0}`);
      console.log(`   - Vector size: ${collectionInfo.config?.params?.vectors?.size || 'N/A'}`);

      return;
    }

    // Create collection
    console.log(`📦 Creating collection '${collectionName}'...`);
    await client.createCollection(collectionName, {
      vectors: {
        size: vectorSize,
        distance: 'Cosine', // For semantic similarity
      },
      optimizers_config: {
        default_segment_number: 2,
      },
      replication_factor: 1,
    });

    console.log(`✅ Collection '${collectionName}' created successfully!\n`);

    // Create payload indexes for better query performance
    console.log('📇 Creating payload indexes...');

    await client.createPayloadIndex(collectionName, {
      field_name: 'user_id',
      field_schema: 'keyword',
    });
    console.log('   ✅ Index on user_id created');

    await client.createPayloadIndex(collectionName, {
      field_name: 'url',
      field_schema: 'keyword',
    });
    console.log('   ✅ Index on url created');

    await client.createPayloadIndex(collectionName, {
      field_name: 'tags',
      field_schema: 'keyword',
    });
    console.log('   ✅ Index on tags created');

    await client.createPayloadIndex(collectionName, {
      field_name: 'created_at',
      field_schema: 'datetime',
    });
    console.log('   ✅ Index on created_at created');

    // Indexes for chunking support
    await client.createPayloadIndex(collectionName, {
      field_name: 'is_chunk',
      field_schema: 'bool',
    });
    console.log('   ✅ Index on is_chunk created');

    await client.createPayloadIndex(collectionName, {
      field_name: 'bookmark_id',
      field_schema: 'keyword',
    });
    console.log('   ✅ Index on bookmark_id created\n');

    // Verify setup
    console.log('🔍 Verifying collection setup...');
    const collectionInfo = await client.getCollection(collectionName);

    console.log('\n✅ Qdrant setup complete!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Collection Details:');
    console.log(`   Name: ${collectionName}`);
    console.log(`   Vector Size: ${vectorSize} dimensions`);
    console.log(`   Distance Metric: Cosine`);
    console.log(`   Status: Ready`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('❌ Error setting up Qdrant:');
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

// Run setup
setupQdrant().catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
