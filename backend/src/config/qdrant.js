/**
 * Qdrant Client Configuration
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Note: Environment variables are loaded in index.js
const qdrantUrl = process.env.QDRANT_URL || '';
const qdrantApiKey = process.env.QDRANT_API_KEY || '';

// Create Qdrant client safely
export let qdrantClient;

if (qdrantUrl && qdrantApiKey) {
  try {
    qdrantClient = new QdrantClient({
      url: qdrantUrl,
      apiKey: qdrantApiKey,
    });
    console.log('✅ Qdrant client initialized');
  } catch (err) {
    console.error('❌ Qdrant client failed:', err.message);
  }
} else {
  console.warn('⚠️ QDRANT_URL or QDRANT_API_KEY not found');
}

// Collection name
export const COLLECTION_NAME = 'bookmarks';
