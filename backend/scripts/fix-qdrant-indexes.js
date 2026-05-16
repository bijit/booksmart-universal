import { QdrantClient } from '@qdrant/js-client-rest';
import dotenv from 'dotenv';
dotenv.config();

const qdrantUrl = process.env.QDRANT_URL;
const qdrantApiKey = process.env.QDRANT_API_KEY;
const COLLECTION_NAME = 'bookmarks';

async function fixIndexes() {
  if (!qdrantUrl || !qdrantApiKey) {
    console.error('❌ QDRANT_URL or QDRANT_API_KEY missing from environment');
    process.exit(1);
  }

  const client = new QdrantClient({
    url: qdrantUrl,
    apiKey: qdrantApiKey,
  });

  console.log('🚀 Connecting to Qdrant at:', qdrantUrl);

  try {
    console.log('📦 Creating "tags" keyword index...');
    await client.createPayloadIndex(COLLECTION_NAME, {
      field_name: 'tags',
      field_schema: 'keyword',
      wait: true
    });
    console.log('✅ "tags" index created');

    console.log('📦 Creating "folder_path" keyword index...');
    await client.createPayloadIndex(COLLECTION_NAME, {
      field_name: 'folder_path',
      field_schema: 'keyword',
      wait: true
    });
    console.log('✅ "folder_path" index created');

    console.log('📦 Creating "folder_id" keyword index...');
    await client.createPayloadIndex(COLLECTION_NAME, {
      field_name: 'folder_id',
      field_schema: 'keyword',
      wait: true
    });
    console.log('✅ "folder_id" index created');

    console.log('\n✨ All necessary indexes are now active in production!');
  } catch (err) {
    console.error('❌ Failed to create indexes:', err.message);
  }
}

fixIndexes();
