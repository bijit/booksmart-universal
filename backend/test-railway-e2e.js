/**
 * Railway E2E Test
 *
 * Tests the complete flow:
 * 1. Register user
 * 2. Login
 * 3. Create bookmark
 * 4. Wait for processing (worker polls every 5s)
 * 5. Verify bookmark has tags and AI summary
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment
config({ path: resolve(__dirname, '../.env.local') });

// Configuration
const RAILWAY_URL = process.env.RAILWAY_URL || 'https://booksmart-backend-production-fe49.up.railway.app';
const API_BASE_URL = `${RAILWAY_URL}/api`;

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📡 Railway E2E Test');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`🌐 Testing: ${API_BASE_URL}\n`);

// Generate unique test email
const timestamp = Date.now();
const testEmail = `test+${timestamp}@booksmart.test`;
const testPassword = 'TestPassword123!';
const testName = 'E2E Test User';

let authToken = null;
let bookmarkId = null;

// Helper: Make API request
async function apiRequest(method, endpoint, body = null, requiresAuth = false) {
  const headers = {
    'Content-Type': 'application/json'
  };

  if (requiresAuth && authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const options = {
    method,
    headers
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const url = `${API_BASE_URL}${endpoint}`;
  console.log(`\n  ${method} ${endpoint}`);

  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok) {
    console.log(`  ❌ ${response.status} ${response.statusText}`);
    console.log(`  Error:`, data);
    throw new Error(`API Error: ${response.status} - ${JSON.stringify(data)}`);
  }

  console.log(`  ✅ ${response.status} ${response.statusText}`);
  return data;
}

// Helper: Wait with progress indicator
function sleep(ms, message = '') {
  return new Promise(resolve => {
    if (message) {
      console.log(`\n  ⏳ ${message}`);
    }
    setTimeout(resolve, ms);
  });
}

async function runTest() {
  try {
    // Step 1: Health Check
    console.log('\n1️⃣  Health Check');
    console.log('─'.repeat(50));
    const health = await apiRequest('GET', '/health');
    console.log(`  Status: ${health.status}`);
    console.log(`  Uptime: ${Math.floor(health.uptime)}s`);
    console.log(`  Environment: ${health.environment}`);

    // Step 2: Register User
    console.log('\n2️⃣  Register New User');
    console.log('─'.repeat(50));
    const registerData = await apiRequest('POST', '/auth/register', {
      name: testName,
      email: testEmail,
      password: testPassword
    });

    if (!registerData.session || !registerData.session.access_token) {
      throw new Error('Registration did not return access token');
    }

    authToken = registerData.session.access_token;
    console.log(`  User ID: ${registerData.user.id}`);
    console.log(`  Email: ${registerData.user.email}`);
    console.log(`  Token: ${authToken.substring(0, 20)}...`);

    // Step 3: Create Bookmark
    console.log('\n3️⃣  Create Bookmark');
    console.log('─'.repeat(50));
    const testUrl = 'https://en.wikipedia.org/wiki/Artificial_intelligence';
    const bookmarkData = await apiRequest('POST', '/bookmarks', {
      url: testUrl,
      title: 'Test Bookmark - AI Article'
    }, true);

    bookmarkId = bookmarkData.bookmark.id;
    console.log(`  Bookmark ID: ${bookmarkId}`);
    console.log(`  URL: ${bookmarkData.bookmark.url}`);
    console.log(`  Status: ${bookmarkData.bookmark.processing_status}`);

    // Step 4: Wait for Processing
    console.log('\n4️⃣  Wait for Background Processing');
    console.log('─'.repeat(50));
    console.log('  Worker polls every 5 seconds...');
    console.log('  Expecting: 10-15 seconds total');

    let processed = false;
    let attempts = 0;
    const maxAttempts = 24; // 2 minutes max (24 * 5s)

    while (!processed && attempts < maxAttempts) {
      attempts++;
      await sleep(5000, `Checking status (attempt ${attempts}/${maxAttempts})...`);

      const response = await apiRequest('GET', `/bookmarks/${bookmarkId}`, null, true);
      const bookmark = response.bookmark; // Extract bookmark from response

      console.log(`  Status: ${bookmark.processing_status}`);

      if (bookmark.processing_status === 'completed') {
        processed = true;
        console.log(`  ✅ Processing completed in ~${attempts * 5} seconds!`);
        console.log(`\n  📋 AI Summary:`);
        console.log(`     Title: "${bookmark.title}"`);
        console.log(`     Description: "${bookmark.description}"`);
        if (bookmark.tags && bookmark.tags.length > 0) {
          console.log(`     Tags: ${bookmark.tags.join(', ')}`);
        }
        if (bookmark.content) {
          console.log(`     Content: ${bookmark.content.length} characters`);
        }
      } else if (bookmark.processing_status === 'failed') {
        throw new Error(`Processing failed: ${bookmark.error_message}`);
      }
    }

    if (!processed) {
      throw new Error('Processing timeout after 2 minutes');
    }

    // Step 5: Test Search
    console.log('\n5️⃣  Test Semantic Search');
    console.log('─'.repeat(50));
    const searchData = await apiRequest('POST', '/search', {
      query: 'machine learning and artificial intelligence',
      searchType: 'hybrid',
      limit: 5
    }, true);

    console.log(`  Found ${searchData.results.length} result(s)`);
    searchData.results.forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.title} (score: ${result.score.toFixed(3)})`);
    });

    // Step 6: Verify full bookmark data
    console.log('\n6️⃣  Verify Complete Data');
    console.log('─'.repeat(50));
    const fullResponse = await apiRequest('GET', `/bookmarks/${bookmarkId}`, null, true);
    const fullBookmark = fullResponse.bookmark; // Extract bookmark from response

    const checks = [
      { name: 'Title generated', value: !!fullBookmark.title },
      { name: 'Description exists', value: !!fullBookmark.description },
      { name: 'Tags created', value: fullBookmark.tags && fullBookmark.tags.length > 0 },
      { name: 'Content extracted', value: fullBookmark.content && fullBookmark.content.length > 1000 },
      { name: 'Processing completed', value: fullBookmark.processing_status === 'completed' },
      { name: 'Qdrant ID set', value: !!fullBookmark.qdrant_point_id }
    ];

    checks.forEach(check => {
      const icon = check.value ? '✅' : '❌';
      console.log(`  ${icon} ${check.name}`);
    });

    const allPassed = checks.every(check => check.value);
    if (!allPassed) {
      throw new Error('Some checks failed');
    }

    // Step 7: Cleanup
    console.log('\n7️⃣  Cleanup');
    console.log('─'.repeat(50));
    await apiRequest('DELETE', `/bookmarks/${bookmarkId}`, null, true);
    console.log(`  ✅ Test bookmark deleted`);

    // Success!
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ ALL TESTS PASSED!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n✨ Railway deployment is working correctly!\n');
    console.log('Next steps:');
    console.log('  1. Verify extension config points to Railway');
    console.log('  2. Rebuild extension: cd extension && ./build.sh');
    console.log('  3. Reload extension in Chrome');
    console.log('  4. Test bookmarking from browser\n');

    process.exit(0);

  } catch (error) {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('❌ TEST FAILED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('\nError:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    console.log('\n');
    process.exit(1);
  }
}

// Run the test
runTest();
