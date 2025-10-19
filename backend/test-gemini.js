/**
 * Test Google Gemini Service
 * Tests AI summarization and embeddings generation
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { summarizeContent, generateEmbedding, processContent } from './src/services/gemini.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: resolve(__dirname, '../.env.local') });

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🧪 TESTING GOOGLE GEMINI SERVICE');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

async function testGemini() {
  const testContent = `Artificial intelligence (AI) is intelligence demonstrated by machines,
  in contrast to the natural intelligence displayed by humans and animals. Leading AI textbooks
  define the field as the study of "intelligent agents": any device that perceives its environment
  and takes actions that maximize its chance of successfully achieving its goals. Colloquially,
  the term "artificial intelligence" is often used to describe machines (or computers) that mimic
  "cognitive" functions that humans associate with the human mind, such as "learning" and
  "problem solving". As machines become increasingly capable, tasks considered to require
  "intelligence" are often removed from the definition of AI, a phenomenon known as the AI effect.
  A quip in Tesler's Theorem says "AI is whatever hasn't been done yet." For instance, optical
  character recognition is frequently excluded from things considered to be AI, having become a
  routine technology.`;

  const testUrl = 'https://en.wikipedia.org/wiki/Artificial_intelligence';

  console.log('📝 Test Content Length:', testContent.length, 'characters\n');

  // Test 1: Summarization
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 1: AI Summarization');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    console.log('⏳ Generating AI summary with Gemini...');
    const summary = await summarizeContent(testContent, testUrl);

    console.log('\n✅ SUCCESS! Summary generated:\n');
    console.log('Title:', summary.title);
    console.log('Title Length:', summary.title.length, '/ 80 chars');
    console.log('\nDescription:', summary.description);
    console.log('Description Length:', summary.description.length, '/ 200 chars');
    console.log('\n✅ SUMMARIZATION TEST PASSED\n');

  } catch (error) {
    console.error('\n❌ SUMMARIZATION TEST FAILED');
    console.error('Error:', error.message);
    process.exit(1);
  }

  // Test 2: Embeddings
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 2: Embedding Generation');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    console.log('⏳ Generating 768D embedding vector...');
    const embedding = await generateEmbedding(testContent);

    console.log('\n✅ SUCCESS! Embedding generated:\n');
    console.log('Vector Dimensions:', embedding.length);
    console.log('First 10 values:', embedding.slice(0, 10).map(v => v.toFixed(4)));
    console.log('Vector type:', typeof embedding[0]);
    console.log('\n✅ EMBEDDINGS TEST PASSED\n');

  } catch (error) {
    console.error('\n❌ EMBEDDINGS TEST FAILED');
    console.error('Error:', error.message);
    process.exit(1);
  }

  // Test 3: Combined Processing (Parallel)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 3: Combined Processing (Parallel)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    console.log('⏳ Running summarization + embeddings in parallel...');
    const startTime = Date.now();
    const result = await processContent(testContent, testUrl);
    const duration = Date.now() - startTime;

    console.log('\n✅ SUCCESS! Combined processing complete:\n');
    console.log('Title:', result.title);
    console.log('Description:', result.description);
    console.log('Embedding Dimensions:', result.embedding.length);
    console.log('Processing Time:', duration, 'ms');
    console.log('\n✅ COMBINED PROCESSING TEST PASSED\n');

  } catch (error) {
    console.error('\n❌ COMBINED PROCESSING TEST FAILED');
    console.error('Error:', error.message);
    process.exit(1);
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ ALL GEMINI TESTS PASSED');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(0);
}

testGemini();
