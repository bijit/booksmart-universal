/**
 * Railway Diagnostics
 * Quick check of Railway deployment
 */

const RAILWAY_URL = 'https://booksmart-backend-production-fe49.up.railway.app';

async function diagnose() {
  console.log('\n🔍 Railway Deployment Diagnostics\n');
  console.log(`URL: ${RAILWAY_URL}\n`);

  try {
    // 1. Health check
    console.log('1. Health Check:');
    const healthRes = await fetch(`${RAILWAY_URL}/api/health`);
    const health = await healthRes.json();
    console.log(`   ✅ Status: ${health.status}`);
    console.log(`   ⏱️  Uptime: ${Math.floor(health.uptime / 60)} minutes`);
    console.log(`   🌍 Environment: ${health.environment}\n`);

    // 2. Root endpoint (shows API info)
    console.log('2. API Info:');
    const rootRes = await fetch(`${RAILWAY_URL}/`);
    const root = await rootRes.json();
    console.log(`   📦 Name: ${root.name}`);
    console.log(`   🔢 Version: ${root.version}`);
    console.log(`   ✅ Status: ${root.status}\n`);

    // 3. Check if worker is mentioned in logs (we can't access logs directly)
    console.log('3. Worker Status:');
    console.log('   ⚠️  Cannot check directly from API');
    console.log('   ✅ Worker should auto-start with server');
    console.log('   📝 Check Railway logs to verify worker startup\n');

    // 4. Create a test bookmark and see what happens
    console.log('4. Test Bookmark Creation:');

    // First register a test user
    const timestamp = Date.now();
    const email = `diag+${timestamp}@test.local`;
    const registerRes = await fetch(`${RAILWAY_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Diagnostic User',
        email,
        password: 'TestPass123!'
      })
    });

    if (!registerRes.ok) {
      console.log(`   ❌ Registration failed: ${registerRes.status}`);
      return;
    }

    const registerData = await registerRes.json();
    const token = registerData.session.access_token;
    console.log(`   ✅ User created: ${registerData.user.email}`);

    // Create a bookmark
    const bookmarkRes = await fetch(`${RAILWAY_URL}/api/bookmarks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        url: 'https://example.com',
        title: 'Test Bookmark'
      })
    });

    const bookmarkData = await bookmarkRes.json();
    console.log(`   📋 Bookmark created:`, bookmarkData.bookmark);

    const bookmarkId = bookmarkData.bookmark.id;

    // Wait 10 seconds and check status
    console.log(`\n   ⏳ Waiting 10 seconds for worker to process...`);
    await new Promise(resolve => setTimeout(resolve, 10000));

    const checkRes = await fetch(`${RAILWAY_URL}/api/bookmarks/${bookmarkId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const bookmark = await checkRes.json();
    console.log(`\n   📊 After 10 seconds:`);
    console.log(`      Status: ${bookmark.processing_status || 'undefined'}`);
    console.log(`      Title: ${bookmark.title || 'none'}`);
    console.log(`      Tags: ${bookmark.tags || 'none'}`);

    if (bookmark.processing_status === 'pending') {
      console.log(`\n   ⚠️  ISSUE FOUND: Worker is not processing bookmarks!`);
      console.log(`      - Bookmark stayed in 'pending' status`);
      console.log(`      - Worker may not be running`);
      console.log(`      - Check Railway logs for worker startup messages`);
    } else if (bookmark.processing_status === 'completed') {
      console.log(`\n   ✅ Worker is functioning correctly!`);
    } else if (!bookmark.processing_status) {
      console.log(`\n   ❌ CRITICAL: processing_status field is missing!`);
      console.log(`      - Database schema may be incorrect`);
      console.log(`      - Check Supabase table structure`);
    }

    // Cleanup
    await fetch(`${RAILWAY_URL}/api/bookmarks/${bookmarkId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    console.log(`\n✅ Diagnostics complete\n`);

  } catch (error) {
    console.error(`\n❌ Error:`, error.message);
  }
}

diagnose();
