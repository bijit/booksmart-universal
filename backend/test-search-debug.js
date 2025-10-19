/**
 * Debug Search Test
 * Investigates why certain queries return no results
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { generateEmbedding } from './src/services/gemini.service.js';
import { searchBookmarks } from './src/services/qdrant.service.js';
import { getBookmarksByUser } from './src/services/qdrant.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: resolve(__dirname, '../.env.local') });

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔍 SEARCH DEBUG TEST');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

async function debugSearch() {
  // Use a test user ID from our recent test
  // In real scenario, we'd query Supabase to find a user with bookmarks
  const testUserId = '45f07599-1e42-45d7-8283-73fddad67eed'; // From earlier test

  console.log(`📊 Testing with user: ${testUserId}\n`);

  // First, let's see what bookmarks exist
  console.log('STEP 1: List all bookmarks for user');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    const allBookmarks = await getBookmarksByUser(testUserId, { limit: 10 });
    console.log(`Found ${allBookmarks.length} bookmarks:\n`);

    allBookmarks.forEach((b, i) => {
      console.log(`${i + 1}. ${b.title}`);
      console.log(`   URL: ${b.url}`);
      console.log(`   Description: ${(b.description || '').substring(0, 100)}...`);
      console.log('');
    });
  } catch (error) {
    console.log('⚠️  Could not fetch bookmarks (user may not exist)');
    console.log('   This is expected if running fresh tests\n');
  }

  // Now test the problematic query with different thresholds
  console.log('\nSTEP 2: Test "learning to code" query with different thresholds');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const query = 'learning to code';
  console.log(`Query: "${query}"\n`);
  console.log('Generating query embedding...');

  const queryEmbedding = await generateEmbedding(query);
  console.log(`✅ Embedding generated: ${queryEmbedding.length}D\n`);

  // Test with different thresholds
  const thresholds = [0.3, 0.4, 0.5, 0.6, 0.7];

  for (const threshold of thresholds) {
    console.log(`\nTesting with threshold: ${threshold}`);
    console.log('─────────────────────────────────────');

    try {
      const results = await searchBookmarks(testUserId, queryEmbedding, {
        limit: 5,
        scoreThreshold: threshold
      });

      if (results.length === 0) {
        console.log(`  ❌ No results (threshold ${threshold} too high)`);
      } else {
        console.log(`  ✅ Found ${results.length} results:`);
        results.forEach((r, i) => {
          console.log(`     ${i + 1}. ${r.title?.substring(0, 50)}...`);
          console.log(`        Score: ${r.score.toFixed(4)} (${threshold} threshold)`);
        });
      }
    } catch (error) {
      console.log(`  ⚠️  Error: ${error.message}`);
    }
  }

  // Test with a very low threshold to see all matches
  console.log('\n\nSTEP 3: Test with very low threshold (0.0) to see ALL matches');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    const allResults = await searchBookmarks(testUserId, queryEmbedding, {
      limit: 10,
      scoreThreshold: 0.0  // Accept everything
    });

    console.log(`Found ${allResults.length} total matches (any score):\n`);

    allResults.forEach((r, i) => {
      console.log(`${i + 1}. ${r.title}`);
      console.log(`   Score: ${r.score.toFixed(4)}`);
      console.log(`   ${r.score >= 0.5 ? '✅ Would show (≥0.5)' : '❌ Filtered out (<0.5)'}`);
      console.log('');
    });

  } catch (error) {
    console.log(`Error: ${error.message}`);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('CONCLUSION');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('The query "learning to code" likely returns 0 results because:');
  console.log('');
  console.log('1. Score threshold (0.5) is too high for this query');
  console.log('2. The bookmarks are about ML/Python/JavaScript');
  console.log('3. "learning to code" is semantically distant from');
  console.log('   "machine learning algorithms" (more specific)');
  console.log('');
  console.log('RECOMMENDATION:');
  console.log('- Use threshold 0.3-0.4 for broader searches');
  console.log('- Use threshold 0.5-0.7 for precise searches');
  console.log('- Let users adjust threshold in UI');
  console.log('');

  process.exit(0);
}

debugSearch();
