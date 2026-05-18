import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { QdrantClient } from '@qdrant/js-client-rest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env
config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const qdrantUrl = process.env.QDRANT_URL;
const qdrantApiKey = process.env.QDRANT_API_KEY;

if (!supabaseUrl || !supabaseAnonKey || !qdrantUrl || !qdrantApiKey) {
  console.error('❌ Missing environment variables. Please check .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const qdrant = new QdrantClient({ url: qdrantUrl, apiKey: qdrantApiKey });
const COLLECTION_NAME = 'bookmarks';

async function migrate() {
  console.log('🚀 Starting Folder Sync from Supabase to Qdrant...');

  let offset = 0;
  const limit = 500;
  let hasMore = true;
  let totalProcessed = 0;
  let totalUpdatedPoints = 0;

  while (hasMore) {
    console.log(`\nFetching bookmarks from Supabase (offset: ${offset}, limit: ${limit})...`);
    
    // Fetch bookmarks that have a folder path
    const { data: bookmarks, error } = await supabase
      .from('bookmarks')
      .select('id, folder_path, folder_id')
      .not('folder_path', 'is', null)
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('❌ Supabase fetch failed:', error.message);
      break;
    }

    if (!bookmarks || bookmarks.length === 0) {
      hasMore = false;
      break;
    }

    console.log(`Processing ${bookmarks.length} bookmarks...`);

    for (const bookmark of bookmarks) {
      const { id: bookmarkId, folder_path, folder_id } = bookmark;

      try {
        // Find all Qdrant points with this bookmark_id
        // Both the legacy single-point bookmark AND the chunks store bookmark_id in payload
        const scrollResult = await qdrant.scroll(COLLECTION_NAME, {
          filter: {
            must: [
              {
                key: 'bookmark_id',
                match: { value: bookmarkId }
              }
            ]
          },
          limit: 100, // Max chunks per bookmark is usually < 100
          with_payload: true,
          with_vector: false
        });

        const points = scrollResult.points;

        if (points.length === 0) {
          // If no points matched by bookmark_id, check if there's a legacy point keyed by the Supabase ID directly
          const directPoint = await qdrant.retrieve(COLLECTION_NAME, {
            ids: [bookmarkId],
            with_payload: true
          });
          
          if (directPoint && directPoint.length > 0) {
            points.push(directPoint[0]);
          }
        }

        if (points.length > 0) {
          const pointIds = points.map(p => p.id);
          
          // Update payload for all points/chunks
          await qdrant.setPayload(COLLECTION_NAME, {
            payload: {
              folder_path,
              folder_id
            },
            points: pointIds
          });

          totalUpdatedPoints += pointIds.length;
        }

      } catch (err) {
        console.warn(`⚠️ Failed to update Qdrant points for bookmark ${bookmarkId}:`, err.message);
      }

      totalProcessed++;
      if (totalProcessed % 50 === 0) {
        process.stdout.write(`Processed ${totalProcessed} bookmarks...\r`);
      }
    }

    offset += limit;
  }

  console.log(`\n\n🎉 Sync Completed!`);
  console.log(`- Bookmarks processed: ${totalProcessed}`);
  console.log(`- Qdrant points/chunks updated with folders: ${totalUpdatedPoints}`);
  process.exit(0);
}

migrate().catch(err => {
  console.error('❌ Critical migration error:', err);
  process.exit(1);
});
