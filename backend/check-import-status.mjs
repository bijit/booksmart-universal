// Check import progress via the live production API
// Run with: node check-import-status.mjs <your-email> <your-password>

const API = 'https://booksmart-backend-920600341451.us-central1.run.app';
const [,, email, password] = process.argv;

if (!email || !password) {
  console.error('Usage: node check-import-status.mjs <email> <password>');
  process.exit(1);
}

async function getCount(token, status) {
  const url = status
    ? `${API}/api/bookmarks?limit=0&status=${status}`
    : `${API}/api/bookmarks?limit=0`;
  const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
  if (!res.ok) return '?';
  const data = await res.json();
  return data.pagination?.total ?? '?';
}

async function main() {
  // Authenticate
  const loginRes = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  if (!loginRes.ok) {
    console.error('Login failed:', await loginRes.text());
    process.exit(1);
  }

  const loginData = await loginRes.json();
  const token = loginData.session?.access_token;
  if (!token) { console.error('No token returned'); process.exit(1); }
  console.log('✅ Authenticated\n');

  console.log('📊 Import Status Breakdown:');
  console.log('────────────────────────────');

  const [pending, processing, completed, failed, total] = await Promise.all([
    getCount(token, 'pending'),
    getCount(token, 'processing'),
    getCount(token, 'completed'),
    getCount(token, 'failed'),
    getCount(token, null),
  ]);

  console.log(`  ${'pending'.padEnd(12)}: ${pending}`);
  console.log(`  ${'processing'.padEnd(12)}: ${processing}`);
  console.log(`  ${'completed'.padEnd(12)}: ${completed}`);
  console.log(`  ${'failed'.padEnd(12)}: ${failed}`);
  console.log('────────────────────────────');
  console.log(`  TOTAL         : ${total}`);

  if (typeof pending === 'number' && typeof completed === 'number') {
    const done = completed;
    const remaining = pending;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    console.log(`\n  Progress      : ${pct}% complete (${done} done, ${remaining} still queued)`);
  }

  // Most recent bookmarks
  const recentRes = await fetch(`${API}/api/bookmarks?limit=5`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const recentData = await recentRes.json();

  console.log('\n🕐 5 Most Recently Saved (newest first):');
  console.log('──────────────────────────────────────────────────────────');
  for (const b of recentData.bookmarks || []) {
    const status = (b.processing_status || 'null').padEnd(10);
    const title = (b.title || b.url || 'No title').substring(0, 52);
    console.log(`  [${status}] ${title}`);
    console.log(`               saved: ${b.created_at}`);
  }

  // Oldest pending (next to be processed)
  const pendingRes = await fetch(`${API}/api/bookmarks?limit=3&status=pending`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const pendingData = await pendingRes.json();

  if ((pendingData.bookmarks || []).length > 0) {
    console.log(`\n⏳ Oldest items still in queue (processed first):`);
    console.log('──────────────────────────────────────────────────────────');
    for (const b of pendingData.bookmarks) {
      console.log(`  ${(b.title || b.url || 'No title').substring(0, 65)}`);
      console.log(`               queued: ${b.created_at}`);
    }
  }

  // Failed items
  const failedRes = await fetch(`${API}/api/bookmarks?limit=3&status=failed`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const failedData = await failedRes.json();

  if ((failedData.bookmarks || []).length > 0) {
    console.log(`\n❌ Sample of Failed Bookmarks:`);
    console.log('──────────────────────────────────────────────────────────');
    for (const b of failedData.bookmarks) {
      console.log(`  ${(b.url || 'unknown').substring(0, 60)}`);
      console.log(`    reason: ${(b.error_message || 'unknown').substring(0, 80)}`);
    }
  }
}

main().catch(console.error);
