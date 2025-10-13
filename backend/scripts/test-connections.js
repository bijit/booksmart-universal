#!/usr/bin/env node

/**
 * Connection Test Script
 *
 * Tests connections to all external services:
 * - Qdrant Cloud
 * - Supabase
 * - Google AI (Gemini)
 * - Google Embeddings
 * - Jina AI (optional)
 *
 * Run with: node backend/scripts/test-connections.js
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.local from project root
config({ path: resolve(__dirname, '../../.env.local') });

console.log('🧪 Testing connections to all services...\n');

// Test results
const results = {
  qdrant: { status: 'pending', message: '' },
  supabase: { status: 'pending', message: '' },
  gemini: { status: 'pending', message: '' },
  embeddings: { status: 'pending', message: '' },
  jina: { status: 'pending', message: '' },
};

// Test Qdrant
async function testQdrant() {
  try {
    const { QdrantClient } = await import('@qdrant/js-client-rest');

    if (!process.env.QDRANT_URL || !process.env.QDRANT_API_KEY) {
      throw new Error('QDRANT_URL or QDRANT_API_KEY not set');
    }

    const client = new QdrantClient({
      url: process.env.QDRANT_URL,
      apiKey: process.env.QDRANT_API_KEY,
    });

    const collections = await client.getCollections();
    results.qdrant.status = 'success';
    results.qdrant.message = `Connected! Found ${collections.collections.length} collections`;

  } catch (error) {
    results.qdrant.status = 'error';
    results.qdrant.message = error.message;
  }
}

// Test Supabase
async function testSupabase() {
  try {
    const { createClient } = await import('@supabase/supabase-js');

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      throw new Error('SUPABASE_URL or SUPABASE_ANON_KEY not set');
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    // Test with a simple query (will fail gracefully if tables don't exist)
    const { error } = await supabase.from('bookmarks').select('id').limit(1);

    if (error && !error.message.includes('does not exist')) {
      throw new Error(error.message);
    }

    results.supabase.status = 'success';
    results.supabase.message = 'Connected! Database accessible';

  } catch (error) {
    results.supabase.status = 'error';
    results.supabase.message = error.message;
  }
}

// Test Google AI (Gemini)
async function testGemini() {
  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');

    if (!process.env.GOOGLE_AI_API_KEY) {
      throw new Error('GOOGLE_AI_API_KEY not set');
    }

    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const result = await model.generateContent('Say "Hello"');
    const response = await result.response;
    const text = response.text();

    results.gemini.status = 'success';
    results.gemini.message = `Connected! Response: "${text.substring(0, 50)}..."`;

  } catch (error) {
    results.gemini.status = 'error';
    results.gemini.message = error.message;
  }
}

// Test Google Embeddings
async function testEmbeddings() {
  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');

    if (!process.env.GOOGLE_AI_API_KEY) {
      throw new Error('GOOGLE_AI_API_KEY not set');
    }

    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: process.env.GOOGLE_EMBEDDING_MODEL || 'text-embedding-004'
    });

    const result = await model.embedContent('test');
    const embedding = result.embedding;

    results.embeddings.status = 'success';
    results.embeddings.message = `Connected! Generated ${embedding.values.length}d vector`;

  } catch (error) {
    results.embeddings.status = 'error';
    results.embeddings.message = error.message;
  }
}

// Test Jina AI (optional)
async function testJina() {
  try {
    const axios = (await import('axios')).default;

    const testUrl = 'https://example.com';
    const response = await axios.get(`https://r.jina.ai/${testUrl}`, {
      timeout: 10000,
      headers: process.env.JINA_API_KEY
        ? { 'Authorization': `Bearer ${process.env.JINA_API_KEY}` }
        : {}
    });

    results.jina.status = 'success';
    const keyStatus = process.env.JINA_API_KEY ? 'with API key' : 'without API key (free tier)';
    results.jina.message = `Connected ${keyStatus}! Extracted ${response.data.length || 0} characters`;

  } catch (error) {
    results.jina.status = 'error';
    results.jina.message = error.message;
  }
}

// Run all tests
async function runTests() {
  const tests = [
    { name: 'Qdrant Cloud', fn: testQdrant },
    { name: 'Supabase', fn: testSupabase },
    { name: 'Google Gemini', fn: testGemini },
    { name: 'Google Embeddings', fn: testEmbeddings },
    { name: 'Jina AI', fn: testJina },
  ];

  for (const test of tests) {
    process.stdout.write(`Testing ${test.name}... `);
    await test.fn();

    const resultKey = test.name.toLowerCase().replace(/\s+/g, '').replace('cloud', '');
    const result = results[resultKey];
    if (result && result.status === 'success') {
      console.log(`✅ ${result.message}`);
    } else if (result && result.status === 'error') {
      console.log(`❌ ${result.message}`);
    }
  }

  // Summary
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Connection Test Summary');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const allTests = Object.values(results);
  const successCount = allTests.filter(r => r.status === 'success').length;
  const errorCount = allTests.filter(r => r.status === 'error').length;

  console.log(`✅ Successful: ${successCount}/${allTests.length}`);
  console.log(`❌ Failed: ${errorCount}/${allTests.length}\n`);

  if (errorCount > 0) {
    console.log('💡 Fix the failed connections before proceeding\n');
    process.exit(1);
  } else {
    console.log('🎉 All connections successful! Ready to start development.\n');
  }
}

runTests().catch(error => {
  console.error('\n❌ Unexpected error:', error);
  process.exit(1);
});
