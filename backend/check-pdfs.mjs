// Run with: node check-pdfs.mjs <your-email> <your-password>

const API = 'https://booksmart-backend-920600341451.us-central1.run.app';
const [,, email, password] = process.argv;

if (!email || !password) {
  console.error('Usage: node check-pdfs.mjs <email> <password>');
  process.exit(1);
}

async function main() {
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
  
  // Search for the specific arxiv URL or 'chrome-extension'
  const recentRes = await fetch(`${API}/api/search`, {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: 'arxiv or pdf',
      limit: 10
    })
  });
  
  if (!recentRes.ok) {
    console.error('Failed to fetch bookmarks via search');
    process.exit(1);
  }
  
  const recentData = await recentRes.json();
  // Filter for arxiv or chrome-extension in URL
  const pdfs = (recentData.results || []).filter(b => 
    b.url && (b.url.toLowerCase().includes('arxiv') || b.url.toLowerCase().includes('chrome-extension'))
  );
  
  console.log('\n📄 Relevant Bookmarks (Arxiv or Chrome-Extension):');
  console.log('────────────────────────────────────────────────────');
  
  if (pdfs.length === 0) {
    console.log('No relevant bookmarks found.');
    return;
  }
  
  for (const b of pdfs) {
    console.log(`URL: ${b.url}`);
    console.log(`Title: ${b.title || 'N/A'}`);
    console.log(`Summary preview: ${b.description ? b.description.substring(0, 150) + '...' : 'N/A'}`);
    console.log('────────────────────────────────────────────────────');
  }
}

main().catch(console.error);
