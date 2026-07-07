/**
 * backfill-deep-summary-chunks.mjs
 *
 * RE-INDEX script: scans ALL Supabase bookmarks with a `detailed_summary`
 * and ensures each has a clean deep_summary chunk in Qdrant.
 *
 * Behaviour per bookmark:
 *  - No existing chunk       → create it (new index)
 *  - Chunk has clean string  → skip (already correct)
 *  - Chunk has JSON object   → delete old + insert new (fix bad format)
 *
 * Run from repo root:
 *   set -a && source .env.local && set +a && node backend/scripts/backfill-deep-summary-chunks.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { v4 as uuidv4 } from 'uuid';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../../.env.local'), override: false });

// ── Config ────────────────────────────────────────────────────────────────────
const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const QDRANT_URL           = process.env.QDRANT_URL;
const QDRANT_API_KEY       = process.env.QDRANT_API_KEY;
const GOOGLE_AI_API_KEY    = process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_API_KEY;
const COLLECTION_NAME      = 'bookmarks';
const EMBEDDING_MODEL      = 'models/gemini-embedding-001';
const PAGE_SIZE            = 100;
const EMBED_DELAY_MS       = 300;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const genAI    = new GoogleGenerativeAI(GOOGLE_AI_API_KEY);

// ── Qdrant helpers (raw fetch — confirmed working from local) ─────────────────

async function qdrantPost(path, body) {
  const res = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}${path}`, {
    method: 'POST',
    headers: { 'api-key': QDRANT_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`Qdrant POST ${path} ${res.status}: ${await res.text()}`);
  return res.json();
}

async function qdrantDelete(pointIds) {
  const res = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points/delete?wait=true`, {
    method: 'POST',
    headers: { 'api-key': QDRANT_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ points: pointIds })
  });
  if (!res.ok) throw new Error(`Qdrant delete ${res.status}: ${await res.text()}`);
  return res.json();
}

async function qdrantUpsert(point) {
  const res = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points?wait=true`, {
    method: 'PUT',
    headers: { 'api-key': QDRANT_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ points: [point] })
  });
  if (!res.ok) throw new Error(`Qdrant upsert ${res.status}: ${await res.text()}`);
  return res.json();
}

// ── Text/embedding helpers ────────────────────────────────────────────────────

function summaryToText(summary) {
  if (typeof summary === 'string') return summary;
  if (typeof summary !== 'object' || !summary) return JSON.stringify(summary);
  const parts = [];
  if (summary.tldr)     parts.push(summary.tldr);
  if (summary.analysis) parts.push(summary.analysis);
  if (summary.category) parts.push(`Category: ${summary.category}`);
  if (Array.isArray(summary.key_takeaways) && summary.key_takeaways.length) {
    parts.push('Key takeaways: ' + summary.key_takeaways.join('. '));
  } else if (typeof summary.key_takeaways === 'string') {
    parts.push('Key takeaways: ' + summary.key_takeaways);
  }
  return parts.join('\n\n') || JSON.stringify(summary);
}

async function generateEmbedding(text) {
  const model  = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
  const result = await model.embedContent(text);
  return result.embedding.values;
}

/**
 * Find existing deep_summary chunks for a bookmark.
 * Returns { exists, needsReindex, pointIds }
 *   needsReindex = true when any chunk has a non-string chunk_text (bad JSON format)
 */
async function checkExistingChunk(bookmarkId) {
  const data = await qdrantPost('/points/scroll', {
    filter: {
      must: [
        { key: 'bookmark_id', match: { value: bookmarkId } },
        { key: 'chunk_type',  match: { value: 'deep_summary' } }
      ]
    },
    limit: 10,
    with_payload: ['chunk_text'],
    with_vector: false
  });

  const points = data.result?.points || [];
  if (points.length === 0) return { exists: false, needsReindex: false, pointIds: [] };

  const needsReindex = points.some(p => typeof p.payload?.chunk_text !== 'string');
  return { exists: true, needsReindex, pointIds: points.map(p => p.id) };
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  console.log('🔍 BookSmart — Deep Summary Qdrant Re-index');
  console.log('━'.repeat(50));
  console.log('Mode: fix any chunk whose chunk_text is a JSON object\n');

  let page = 0, totalScanned = 0, totalSkipped = 0,
      totalIndexed = 0, totalReindexed = 0, totalFailed = 0;

  while (true) {
    const from = page * PAGE_SIZE;
    const to   = from + PAGE_SIZE - 1;

    const { data: bookmarks, error } = await supabase
      .from('bookmarks')
      .select('id, user_id, url, title, description, tags, favicon_url, folder_id, folder_path, cover_image, extracted_images, created_at, detailed_summary')
      .not('detailed_summary', 'is', null)
      .range(from, to);

    if (error) { console.error('❌ Supabase error:', error.message); break; }
    if (!bookmarks || bookmarks.length === 0) { console.log('✅ All pages processed.'); break; }

    console.log(`📄 Page ${page + 1}: ${bookmarks.length} bookmarks`);

    for (const bookmark of bookmarks) {
      totalScanned++;
      const label = (bookmark.title || bookmark.url || 'Untitled').substring(0, 55);
      process.stdout.write(`  [${totalScanned}] ${label}... `);

      try {
        const { exists, needsReindex, pointIds } = await checkExistingChunk(bookmark.id);

        // Skip if the existing chunk is already a clean string
        if (exists && !needsReindex) {
          totalSkipped++;
          console.log('⏭  clean (skipped)');
          continue;
        }

        // Serialize summary JSON → plain prose
        const summaryText = summaryToText(bookmark.detailed_summary);

        // Embed the clean text
        const embedding = await generateEmbedding(summaryText);

        // Delete the bad old chunk(s) if they exist
        if (exists && pointIds.length > 0) {
          await qdrantDelete(pointIds);
        }

        // Insert new clean chunk
        await qdrantUpsert({
          id: uuidv4(),
          vector: embedding,
          payload: {
            user_id:          bookmark.user_id,
            bookmark_id:      bookmark.id,
            url:              bookmark.url,
            title:            bookmark.title,
            description:      bookmark.description   || null,
            tags:             bookmark.tags           || [],
            favicon_url:      bookmark.favicon_url    || null,
            folder_id:        bookmark.folder_id      || null,
            folder_path:      bookmark.folder_path    || null,
            cover_image:      bookmark.cover_image    || null,
            extracted_images: bookmark.extracted_images || [],
            chunk_index:  -1,
            chunk_text:   summaryText,   // always a clean plain string now
            chunk_type:   'deep_summary',
            is_chunk:     true,
            created_at:   bookmark.created_at || new Date().toISOString(),
            updated_at:   new Date().toISOString()
          }
        });

        if (exists) {
          totalReindexed++;
          console.log('🔄 re-indexed (JSON→text fixed)');
        } else {
          totalIndexed++;
          console.log('✅ indexed (new)');
        }

        await sleep(EMBED_DELAY_MS);

      } catch (err) {
        totalFailed++;
        console.log(`❌ FAILED: ${err.message}`);
      }
    }

    page++;
    if (bookmarks.length < PAGE_SIZE) break;
  }

  console.log('\n' + '━'.repeat(50));
  console.log('📊 Re-index complete:');
  console.log(`   Scanned:    ${totalScanned}`);
  console.log(`   Re-indexed: ${totalReindexed}  ← fixed JSON→text`);
  console.log(`   New:        ${totalIndexed}  ← freshly created`);
  console.log(`   Skipped:    ${totalSkipped}  ← already clean`);
  console.log(`   Failed:     ${totalFailed}`);
}

run().catch(err => { console.error('Fatal error:', err); process.exit(1); });
