// Check bookmark data including tags and summary
// Using native fetch (Node 18+)

async function checkBookmarks() {
  // Login
  const loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'test@booksmart.local',
      password: 'testpass123'
    })
  });

  const loginData = await loginRes.json();
  const token = loginData.session.access_token;

  // Get bookmarks
  const bookmarksRes = await fetch('http://localhost:3000/api/bookmarks', {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  const bookmarksData = await bookmarksRes.json();

  console.log('\n📚 BOOKMARKS DATA:\n');
  console.log(JSON.stringify(bookmarksData, null, 2));

  if (bookmarksData.bookmarks && bookmarksData.bookmarks.length > 0) {
    const bookmark = bookmarksData.bookmarks[0];

    console.log('\n🔍 FIRST BOOKMARK DETAILS:\n');
    console.log(`ID: ${bookmark.id}`);
    console.log(`URL: ${bookmark.url}`);
    console.log(`Title: ${bookmark.title}`);
    console.log(`AI Title: ${bookmark.ai_title || 'N/A'}`);
    console.log(`Description: ${bookmark.ai_description || 'N/A'}`);
    console.log(`Tags: ${bookmark.tags ? JSON.stringify(bookmark.tags) : 'N/A'}`);
    console.log(`Status: ${bookmark.processing_status}`);
    console.log(`Qdrant Point ID: ${bookmark.qdrant_point_id || 'N/A'}`);

    // Get full bookmark details
    const detailRes = await fetch(`http://localhost:3000/api/bookmarks/${bookmark.id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const detailData = await detailRes.json();

    console.log('\n📄 FULL BOOKMARK DETAILS:\n');
    console.log(JSON.stringify(detailData, null, 2));
  }
}

checkBookmarks().catch(console.error);
