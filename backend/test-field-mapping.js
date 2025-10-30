/**
 * Test Field Mapping
 * Check if processing_status is being returned correctly
 */

const RAILWAY_URL = 'https://booksmart-backend-production-fe49.up.railway.app';

async function test() {
  console.log('\n🔍 Testing Field Mapping\n');

  // Register
  const timestamp = Date.now();
  const registerRes = await fetch(`${RAILWAY_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Field Test',
      email: `field+${timestamp}@test.local`,
      password: 'TestPass123!'
    })
  });

  const registerData = await registerRes.json();
  const token = registerData.session.access_token;

  // Create bookmark
  const createRes = await fetch(`${RAILWAY_URL}/api/bookmarks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      url: 'https://example.com',
      title: 'Field Test'
    })
  });

  const createData = await createRes.json();
  console.log('1. CREATE Response:');
  console.log(JSON.stringify(createData, null, 2));

  const bookmarkId = createData.bookmark.id;

  // Get bookmark
  const getRes = await fetch(`${RAILWAY_URL}/api/bookmarks/${bookmarkId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  const getData = await getRes.json();
  console.log('\n2. GET Response:');
  console.log(JSON.stringify(getData, null, 2));

  // Check field
  console.log('\n3. Field Analysis:');
  console.log(`   CREATE returns: "status" = "${createData.bookmark.status}"`);
  console.log(`   GET returns: "processing_status" = "${getData.bookmark?.processing_status}"`);

  if (getData.bookmark?.processing_status) {
    console.log('\n✅ Field is present in GET response');
  } else {
    console.log('\n❌ Field is MISSING in GET response');
    console.log('\nAll fields in GET response:');
    Object.keys(getData.bookmark || {}).forEach(key => {
      console.log(`   • ${key}: ${getData.bookmark[key]}`);
    });
  }

  // Cleanup
  await fetch(`${RAILWAY_URL}/api/bookmarks/${bookmarkId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
}

test().catch(console.error);
