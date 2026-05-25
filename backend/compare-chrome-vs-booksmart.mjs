// Compare Chrome bookmark folders vs BookSmart database folders
// Usage: node compare-chrome-vs-booksmart.mjs <email> <password>

const API = 'https://booksmart-backend-920600341451.us-central1.run.app';
const [,, email, password] = process.argv;

if (!email || !password) {
  console.error('Usage: node compare-chrome-vs-booksmart.mjs <email> <password>');
  process.exit(1);
}

import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

// ── 1. Extract Chrome folders ──────────────────────────────────────────
function getChromeBookmarks() {
  const profilePath = join(
    homedir(),
    'Library/Application Support/Google/Chrome/Profile 1/Bookmarks'
  );
  const data = JSON.parse(readFileSync(profilePath, 'utf-8'));

  const folders = new Map(); // path -> count of URLs directly inside
  let totalBookmarks = 0;

  function traverse(node, path = '') {
    if (node.type === 'folder') {
      const name = node.name || '';
      let currentPath;
      const rootNames = ['Bookmarks bar', 'Other bookmarks', 'Mobile bookmarks', 'Managed bookmarks'];
      if (rootNames.includes(name)) {
        // Map Chrome's display names to BookSmart equivalents
        if (name === 'Bookmarks bar') currentPath = 'Bookmarks Bar';
        else if (name === 'Other bookmarks') currentPath = 'Other Bookmarks';
        else if (name === 'Mobile bookmarks') currentPath = 'Mobile Bookmarks';
        else currentPath = name;
      } else if (path) {
        currentPath = `${path} > ${name}`;
      } else {
        currentPath = name;
      }

      let urlCount = 0;
      for (const child of node.children || []) {
        if (child.type === 'url') {
          urlCount++;
          totalBookmarks++;
        }
      }

      // Register folder if it has URLs or subfolders
      const hasSubfolders = (node.children || []).some(c => c.type === 'folder');
      if (urlCount > 0 || hasSubfolders) {
        folders.set(currentPath, (folders.get(currentPath) || 0) + urlCount);
      }

      for (const child of node.children || []) {
        if (child.type === 'folder') {
          traverse(child, currentPath);
        }
      }
    }
  }

  for (const rootKey of ['bookmark_bar', 'other', 'synced', 'mobile']) {
    const root = data.roots?.[rootKey];
    if (root) traverse(root);
  }

  return { folders, totalBookmarks };
}

// ── 2. Query BookSmart API ─────────────────────────────────────────────
async function getBookSmartData(token) {
  // Get all folders
  const foldersRes = await fetch(`${API}/api/bookmarks/folders`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const foldersData = await foldersRes.json();

  // Get total count
  const totalRes = await fetch(`${API}/api/bookmarks?limit=0`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const totalData = await totalRes.json();

  // Get status breakdown
  const statuses = ['pending', 'processing', 'completed', 'failed'];
  const statusCounts = {};
  for (const s of statuses) {
    const r = await fetch(`${API}/api/bookmarks?limit=0&status=${s}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const d = await r.json();
    statusCounts[s] = d.pagination?.total ?? 0;
  }

  return {
    folders: foldersData.folders || [],
    totalBookmarks: totalData.pagination?.total ?? 0,
    statusCounts
  };
}

// ── 3. Compare ─────────────────────────────────────────────────────────
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

  // Get both datasets
  const chrome = getChromeBookmarks();
  const booksmart = await getBookSmartData(token);

  const chromeFolderPaths = new Set(chrome.folders.keys());
  const booksmartFolderPaths = new Set(booksmart.folders.map(f => f.path || f.name || f));

  // ── Summary ──
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║        CHROME vs BOOKSMART COMPARISON            ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║  Chrome total bookmarks   : ${String(chrome.totalBookmarks).padStart(6)}              ║`);
  console.log(`║  BookSmart total bookmarks: ${String(booksmart.totalBookmarks).padStart(6)}              ║`);
  console.log(`║  Chrome folders           : ${String(chromeFolderPaths.size).padStart(6)}              ║`);
  console.log(`║  BookSmart folders        : ${String(booksmartFolderPaths.size).padStart(6)}              ║`);
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║  Pending    : ${String(booksmart.statusCounts.pending).padStart(6)}                        ║`);
  console.log(`║  Processing : ${String(booksmart.statusCounts.processing).padStart(6)}                        ║`);
  console.log(`║  Completed  : ${String(booksmart.statusCounts.completed).padStart(6)}                        ║`);
  console.log(`║  Failed     : ${String(booksmart.statusCounts.failed).padStart(6)}                        ║`);
  console.log('╚══════════════════════════════════════════════════╝');

  // ── Folders in Chrome but NOT in BookSmart ──
  const missingFromBooksmart = [];
  for (const cp of chromeFolderPaths) {
    // Check exact match or close match (case-insensitive)
    const found = booksmartFolderPaths.has(cp) || 
                  [...booksmartFolderPaths].some(bp => bp.toLowerCase() === cp.toLowerCase());
    if (!found) {
      missingFromBooksmart.push(cp);
    }
  }

  // ── Folders in BookSmart but NOT in Chrome ──
  const extraInBooksmart = [];
  for (const bp of booksmartFolderPaths) {
    const found = chromeFolderPaths.has(bp) ||
                  [...chromeFolderPaths].some(cp => cp.toLowerCase() === bp.toLowerCase());
    if (!found) {
      extraInBooksmart.push(bp);
    }
  }

  if (missingFromBooksmart.length === 0) {
    console.log('\n✅ All Chrome folders are present in BookSmart!');
  } else {
    console.log(`\n⚠️  ${missingFromBooksmart.length} Chrome folder(s) NOT found in BookSmart:`);
    console.log('─'.repeat(60));
    for (const f of missingFromBooksmart.sort()) {
      const count = chrome.folders.get(f) || 0;
      console.log(`  ❌ ${f}  (${count} bookmark${count !== 1 ? 's' : ''})`);
    }
  }

  if (extraInBooksmart.length > 0) {
    console.log(`\n📌 ${extraInBooksmart.length} folder(s) in BookSmart but NOT in Chrome (possibly renamed/deleted in Chrome):`);
    console.log('─'.repeat(60));
    for (const f of extraInBooksmart.sort()) {
      console.log(`  📁 ${f}`);
    }
  }

  // Bookmark count delta
  const delta = chrome.totalBookmarks - booksmart.totalBookmarks;
  if (delta > 0) {
    console.log(`\n📊 BookSmart is ${delta} bookmark(s) behind Chrome.`);
  } else if (delta < 0) {
    console.log(`\n📊 BookSmart has ${Math.abs(delta)} more bookmark(s) than Chrome (possibly deleted from Chrome since import).`);
  } else {
    console.log('\n📊 Bookmark counts match exactly!');
  }
}

main().catch(console.error);
