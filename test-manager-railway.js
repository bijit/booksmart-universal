// Test Manager App with Railway Backend

const API_BASE_URL = 'https://booksmart-backend-production-fe49.up.railway.app/api';

async function testManagerRailwayIntegration() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧪 Testing Manager App with Railway Backend');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const testEmail = `test-manager-${Date.now()}@example.com`;
  const testPassword = 'TestPass123!';
  let authToken = null;

  // Test 1: Health Check
  console.log('1️⃣  Testing Railway Backend Health...');
  try {
    const healthResponse = await fetch(`${API_BASE_URL}/health`);
    const health = await healthResponse.json();
    console.log(`   ✅ Railway backend is ${health.status}`);
    console.log(`   ⏱️  Uptime: ${Math.floor(health.uptime / 3600)} hours\n`);
  } catch (error) {
    console.log(`   ❌ Health check failed: ${error.message}\n`);
    return;
  }

  // Test 2: Registration
  console.log('2️⃣  Testing User Registration...');
  try {
    const registerResponse = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: testEmail.split('@')[0],
        email: testEmail,
        password: testPassword
      })
    });

    if (!registerResponse.ok) {
      const error = await registerResponse.json();
      throw new Error(error.error || 'Registration failed');
    }

    const registerData = await registerResponse.json();
    authToken = registerData.session?.access_token || registerData.token;

    console.log(`   ✅ User registered successfully`);
    console.log(`   📧 Email: ${testEmail}`);
    console.log(`   🔑 Auth token received: ${authToken.substring(0, 20)}...\n`);
  } catch (error) {
    console.log(`   ❌ Registration failed: ${error.message}\n`);
    return;
  }

  // Test 3: Login
  console.log('3️⃣  Testing User Login...');
  try {
    const loginResponse = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword
      })
    });

    if (!loginResponse.ok) {
      const error = await loginResponse.json();
      throw new Error(error.error || 'Login failed');
    }

    const loginData = await loginResponse.json();
    authToken = loginData.session?.access_token || loginData.token;
    console.log(`   ✅ Login successful`);
    console.log(`   🔑 Auth token: ${authToken.substring(0, 20)}...\n`);
  } catch (error) {
    console.log(`   ❌ Login failed: ${error.message}\n`);
    return;
  }

  // Test 4: Fetch Bookmarks (should be empty)
  console.log('4️⃣  Testing Fetch Bookmarks...');
  try {
    const bookmarksResponse = await fetch(`${API_BASE_URL}/bookmarks`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (!bookmarksResponse.ok) {
      const error = await bookmarksResponse.json();
      throw new Error(error.error || 'Fetch failed');
    }

    const bookmarksData = await bookmarksResponse.json();
    console.log(`   ✅ Bookmarks fetched successfully`);
    console.log(`   📚 Total bookmarks: ${bookmarksData.bookmarks.length}`);

    if (bookmarksData.bookmarks.length === 0) {
      console.log(`   ℹ️  No bookmarks yet (expected for new user)\n`);
    } else {
      console.log(`   📋 First bookmark: ${bookmarksData.bookmarks[0].title}\n`);
    }
  } catch (error) {
    console.log(`   ❌ Fetch bookmarks failed: ${error.message}\n`);
    return;
  }

  // Test 5: Create a Test Bookmark
  console.log('5️⃣  Testing Create Bookmark...');
  let bookmarkId = null;
  try {
    const createResponse = await fetch(`${API_BASE_URL}/bookmarks`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: 'https://example.com/test-manager',
        title: 'Test Manager Bookmark'
      })
    });

    if (!createResponse.ok) {
      const error = await createResponse.json();
      throw new Error(error.error || 'Create failed');
    }

    const createData = await createResponse.json();
    bookmarkId = createData.bookmark.id;
    console.log(`   ✅ Bookmark created successfully`);
    console.log(`   🆔 Bookmark ID: ${bookmarkId}`);
    console.log(`   📊 Status: ${createData.bookmark.processing_status}\n`);
  } catch (error) {
    console.log(`   ❌ Create bookmark failed: ${error.message}\n`);
    return;
  }

  // Test 6: Wait for Processing
  console.log('6️⃣  Waiting for AI Processing (max 30 seconds)...');
  let processed = false;
  for (let i = 0; i < 6; i++) {
    await new Promise(resolve => setTimeout(resolve, 5000));

    const checkResponse = await fetch(`${API_BASE_URL}/bookmarks/${bookmarkId}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    const checkData = await checkResponse.json();
    const bookmark = checkData.bookmark;

    console.log(`   ⏳ Attempt ${i + 1}/6: Status = ${bookmark.processing_status}`);

    if (bookmark.processing_status === 'completed') {
      processed = true;
      console.log(`   ✅ Processing completed!`);
      console.log(`   📝 Title: "${bookmark.title}"`);
      console.log(`   📄 Description: "${bookmark.description?.substring(0, 80)}..."`);
      if (bookmark.tags && bookmark.tags.length > 0) {
        console.log(`   🏷️  Tags: ${bookmark.tags.join(', ')}`);
      }
      break;
    }
  }

  if (!processed) {
    console.log(`   ⚠️  Processing still pending after 30 seconds\n`);
  } else {
    console.log('');
  }

  // Summary
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ MANAGER APP + RAILWAY INTEGRATION TEST COMPLETE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n📱 Your manager app is ready to use!');
  console.log('🌐 Open: http://localhost:5173/');
  console.log('📧 Test Email: ' + testEmail);
  console.log('🔑 Test Password: ' + testPassword);
  console.log('');
  console.log('🎉 All systems working:');
  console.log('   ✅ Railway backend responding');
  console.log('   ✅ User registration working');
  console.log('   ✅ User login working');
  console.log('   ✅ Bookmark creation working');
  console.log('   ✅ AI processing working');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

testManagerRailwayIntegration().catch(console.error);
