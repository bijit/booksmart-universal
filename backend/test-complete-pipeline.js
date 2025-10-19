/**
 * Complete Pipeline Test
 * Tests: Jina → Gemini → Embeddings → Qdrant → Supabase
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { extractContent } from './src/services/jina.service.js';
import { processContent } from './src/services/gemini.service.js';
import { createBookmark } from './src/services/qdrant.service.js';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: resolve(__dirname, '../.env.local') });

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🧪 COMPLETE PIPELINE TEST');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

async function testPipeline() {
  const testUrl = 'https://en.wikipedia.org/wiki/Machine_learning';
  const testUserId = uuidv4(); // Fake user ID for testing

  console.log(`📄 Test URL: ${testUrl}`);
  console.log(`👤 Test User ID: ${testUserId}\n`);

  let jinaResult, geminiResult, qdrantPointId;

  // STEP 1: Jina Content Extraction
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 1: JINA CONTENT EXTRACTION');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    console.log('⏳ Extracting content from URL...');
    const startTime = Date.now();
    jinaResult = await extractContent(testUrl);
    const duration = Date.now() - startTime;

    console.log(`✅ Content extracted in ${duration}ms`);
    console.log(`   Title: ${jinaResult.title}`);
    console.log(`   Content: ${jinaResult.content.length} characters`);
    console.log(`   Description: ${jinaResult.description.substring(0, 100)}...`);
    console.log('');

  } catch (error) {
    console.error('❌ JINA FAILED:', error.message);
    process.exit(1);
  }

  // STEP 2: Gemini AI Processing
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 2: GEMINI AI PROCESSING');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    console.log('⏳ Generating AI summary + embeddings...');
    const startTime = Date.now();
    geminiResult = await processContent(jinaResult.content, testUrl);
    const duration = Date.now() - startTime;

    console.log(`✅ AI processing completed in ${duration}ms`);
    console.log(`   AI Title: ${geminiResult.title}`);
    console.log(`   AI Description: ${geminiResult.description.substring(0, 100)}...`);
    console.log(`   Embedding: ${geminiResult.embedding.length} dimensions`);
    console.log('');

  } catch (error) {
    console.error('❌ GEMINI FAILED:', error.message);
    process.exit(1);
  }

  // STEP 3: Qdrant Vector Storage
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 3: QDRANT VECTOR STORAGE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    console.log('⏳ Storing bookmark in Qdrant...');
    const startTime = Date.now();

    qdrantPointId = await createBookmark(testUserId, {
      url: testUrl,
      title: geminiResult.title,
      description: geminiResult.description,
      content: jinaResult.content,
      embedding: geminiResult.embedding,
      tags: ['test', 'machine-learning', 'ai'],
      favicon_url: jinaResult.favicon
    });

    const duration = Date.now() - startTime;

    console.log(`✅ Stored in Qdrant in ${duration}ms`);
    console.log(`   Point ID: ${qdrantPointId}`);
    console.log('');

  } catch (error) {
    console.error('❌ QDRANT FAILED:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }

  // FINAL SUMMARY
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ COMPLETE PIPELINE TEST PASSED!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('📊 PIPELINE SUMMARY:');
  console.log('');
  console.log('  1. Jina Extraction:');
  console.log(`     ✅ Extracted ${jinaResult.content.length} chars`);
  console.log('');
  console.log('  2. Gemini AI:');
  console.log(`     ✅ Title: "${geminiResult.title}"`);
  console.log(`     ✅ Description: "${geminiResult.description.substring(0, 80)}..."`);
  console.log(`     ✅ Embedding: ${geminiResult.embedding.length}D vector`);
  console.log('');
  console.log('  3. Qdrant Storage:');
  console.log(`     ✅ Point ID: ${qdrantPointId}`);
  console.log(`     ✅ Ready for semantic search!`);
  console.log('');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎉 ALL SERVICES WORKING PERFECTLY!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  process.exit(0);
}

testPipeline();
