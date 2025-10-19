/**
 * Qdrant Client Configuration
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.local if not already loaded
if (!process.env.QDRANT_URL) {
  config({ path: resolve(__dirname, '../../../.env.local') });
}

// Validate environment variables
if (!process.env.QDRANT_URL || !process.env.QDRANT_API_KEY) {
  throw new Error('Missing Qdrant environment variables');
}

// Create Qdrant client
export const qdrantClient = new QdrantClient({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY,
});

// Collection name
export const COLLECTION_NAME = 'bookmarks';

console.log('✅ Qdrant client initialized');
