/**
 * Test Jina AI Service
 * Tests content extraction from a real URL
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { extractContent } from './src/services/jina.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: resolve(__dirname, '../.env.local') });

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🧪 TESTING JINA AI SERVICE');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

async function testJina() {
  const testUrl = 'https://en.wikipedia.org/wiki/Artificial_intelligence';

  console.log(`📄 Test URL: ${testUrl}\n`);

  try {
    console.log('⏳ Extracting content with Jina...');
    const result = await extractContent(testUrl);

    console.log('\n✅ SUCCESS! Content extracted:\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Title: ${result.title}`);
    console.log(`Description: ${result.description.substring(0, 150)}...`);
    console.log(`Content Length: ${result.content.length} characters`);
    console.log(`URL: ${result.url}`);
    console.log(`Favicon: ${result.favicon || 'N/A'}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('📝 Content Preview (first 500 chars):\n');
    console.log(result.content.substring(0, 500));
    console.log('\n...\n');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ JINA TEST PASSED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ JINA TEST FAILED');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    process.exit(1);
  }
}

testJina();
