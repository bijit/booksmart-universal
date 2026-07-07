/**
 * backfill-content-type.mjs
 *
 * Scans all bookmarks in Supabase, runs detectContentType on their URL & extraction method,
 * updates the content_type column in Supabase, and updates their respective points in Qdrant.
 *
 * Run:
 *   set -a && source .env.local && set +a && node backend/scripts/backfill-content-type.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { detectContentType } from '../src/utils/contentType.js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../../.env.local'), override: false });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const QDRANT_URL = process.env.QDRANT_URL;
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;
const COLLECTION_NAME = 'bookmarks';
const PAGE_SIZE = 100;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function qdrantPost(path, body) {
  const res = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}${path}`, {
    method: 'POST',
    headers: { 'api-key': QDRANT_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`Qdrant POST ${path} ${res.status}: ${await res.text()}`);
  return res.json();
}

async function run() {
  console.log('🔍 BookSmart — Content Type Classification Backfill');
  console.log('━'.repeat(60));

  let page = 0;
  let totalScanned = 0;
  let totalUpdated = 0;

  while (true) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data: bookmarks, error } = await supabase
      .from('bookmarks')
      .select('id, url, extraction_method, qdrant_point_id, user_id')
      .range(from, to);

    if (error) {
      console.error('❌ Supabase error:', error.message);
      break;
    }

    if (!bookmarks || bookmarks.length === 0) {
      break;
    }

    console.log(`📄 Page ${page + 1}: Processing ${bookmarks.length} bookmarks...`);

    for (const b of bookmarks) {
      totalScanned++;
      const detectedType = detectContentType(b.url, b.extraction_method);

      // 1. Update Supabase
      const { error: updateErr } = await supabase
        .from('bookmarks')
        .update({ content_type: detectedType })
        .eq('id', b.id);

      if (updateErr) {
        console.error(`  [${totalScanned}] Supabase update failed for ${b.id}:`, updateErr.message);
        continue;
      }

      // 2. Update Qdrant points (parent + chunks)
      try {
        // Query Qdrant to find all points linked to this bookmark (either by point ID or payload match)
        const scrollData = await qdrantPost('/points/scroll', {
          filter: {
            must: [
              { key: 'bookmark_id', match: { value: b.id } }
            ]
          },
          limit: 100,
          with_payload: true,
          with_vector: false
        });

        const points = scrollData.result?.points || [];
        
        // Also check if the legacy main point exists (if it doesn't match bookmark_id filter)
        if (b.qdrant_point_id) {
          const legacyMatch = points.find(p => p.id === b.qdrant_point_id);
          if (!legacyMatch) {
            try {
              const retrieveRes = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points`, {
                method: 'POST',
                headers: { 'api-key': QDRANT_API_KEY, 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: [b.qdrant_point_id] })
              });
              if (retrieveRes.ok) {
                const retData = await retrieveRes.json();
                if (retData.result && retData.result[0]) {
                  points.push(retData.result[0]);
                }
              }
            } catch (retrieveErr) {
              // Ignore retrieve issues for legacy point
            }
          }
        }

        if (points.length > 0) {
          const pointIds = points.map(p => p.id);
          const updateRes = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points/payload?wait=true`, {
            method: 'POST',
            headers: { 'api-key': QDRANT_API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              payload: {
                content_type: detectedType
              },
              points: pointIds
            })
          });

          if (!updateRes.ok) {
            console.warn(`  [${totalScanned}] Failed to update payload in Qdrant:`, await updateRes.text());
          }
        }

        totalUpdated++;
      } catch (qdrantErr) {
        console.warn(`  [${totalScanned}] Qdrant update warning for ${b.id}:`, qdrantErr.message);
      }
    }

    page++;
    if (bookmarks.length < PAGE_SIZE) break;
  }

  console.log('━'.repeat(60));
  console.log('📊 Classification backfill complete:');
  console.log(`   Scanned: ${totalScanned}`);
  console.log(`   Updated: ${totalUpdated}`);
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
