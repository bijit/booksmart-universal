// Diagnostic: Analyze the folder path mismatch pattern
// Checks if 'Bookmarks Bar > X' in Chrome corresponds to 'X' already in BookSmart DB

import { config } from 'dotenv';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { homedir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

// Get Chrome bookmarks as a URL -> folderPath map
function getChromeUrlMap() {
  const profiles = ['Default', 'Profile 1', 'Profile 2', 'Profile 3'];
  let data = null;
  for (const p of profiles) {
    const path = join(homedir(), 'Library/Application Support/Google/Chrome', p, 'Bookmarks');
    if (existsSync(path)) {
      try { data = JSON.parse(readFileSync(path, 'utf-8')); break; } catch(e) {}
    }
  }
  if (!data) { console.error('❌ No Chrome Bookmarks file found'); process.exit(1); }

  const urlToFolderPath = new Map(); // url -> chrome folder path

  function traverse(node, path = '') {
    if (node.type === 'folder') {
      const name = node.name || '';
      let currentPath;
      const rootNames = ['Bookmarks bar', 'Other bookmarks', 'Mobile bookmarks'];
      if (rootNames.includes(name)) {
        if (name === 'Bookmarks bar') currentPath = 'Bookmarks Bar';
        else if (name === 'Other bookmarks') currentPath = 'Other Bookmarks';
        else currentPath = name;
      } else {
        currentPath = path ? `${path} > ${name}` : name;
      }
      for (const child of node.children || []) {
        if (child.type === 'url') {
          urlToFolderPath.set(child.url, currentPath);
        } else if (child.type === 'folder') {
          traverse(child, currentPath);
        }
      }
    }
  }
  for (const rootKey of ['bookmark_bar', 'other', 'synced', 'mobile']) {
    const root = data.roots?.[rootKey];
    if (root) traverse(root);
  }
  return urlToFolderPath;
}

async function main() {
  const chromeUrlMap = getChromeUrlMap();
  console.log(`📖 Chrome has ${chromeUrlMap.size} bookmarkable URLs\n`);

  // Paginate all DB bookmarks
  let allDbBookmarks = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase.from('bookmarks').select('id, url, folder_path').range(from, from + 999);
    if (error || !data || data.length === 0) break;
    allDbBookmarks = allDbBookmarks.concat(data);
    if (data.length < 1000) break;
    from += 1000;
  }
  console.log(`🗄️  Database has ${allDbBookmarks.length} bookmarks\n`);

  // Analyze mismatches for the 'Bookmarks Bar >' prefix pattern
  let exactMatch = 0;
  let prefixMismatch = 0; // DB path = Chrome path minus 'Bookmarks Bar > ' prefix
  let trulyMissing = 0;   // in DB but Chrome path is completely different
  let notInChrome = 0;    // URL doesn't exist in Chrome at all

  const prefixMismatchSamples = [];
  const trulyMissingSamples = [];
  const notInChromeSamples = [];

  for (const dbBm of allDbBookmarks) {
    const chromePath = chromeUrlMap.get(dbBm.url);
    if (!chromePath) {
      notInChrome++;
      if (notInChromeSamples.length < 5) notInChromeSamples.push({ url: dbBm.url, dbPath: dbBm.folder_path });
      continue;
    }

    const dbPath = dbBm.folder_path || '';
    if (chromePath === dbPath) {
      exactMatch++;
    } else if (chromePath === `Bookmarks Bar > ${dbPath}`) {
      // Classic case: DB has 'AI / ML > ...' but Chrome has 'Bookmarks Bar > AI / ML > ...'
      prefixMismatch++;
      if (prefixMismatchSamples.length < 5) prefixMismatchSamples.push({ url: dbBm.url, chromePath, dbPath });
    } else {
      trulyMissing++;
      if (trulyMissingSamples.length < 5) trulyMissingSamples.push({ url: dbBm.url, chromePath, dbPath });
    }
  }

  // Also: find Chrome bookmarks not in the DB at all
  const dbUrls = new Set(allDbBookmarks.map(b => b.url));
  const newInChrome = [];
  for (const [url, path] of chromeUrlMap) {
    if (!dbUrls.has(url)) {
      newInChrome.push({ url, path });
    }
  }

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║             URL-LEVEL PATH MISMATCH ANALYSIS                ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  DB bookmarks with EXACT matching Chrome path : ${String(exactMatch).padStart(5)}         ║`);
  console.log(`║  DB bookmarks with ONLY prefix mismatch       : ${String(prefixMismatch).padStart(5)}         ║`);
  console.log(`║  DB bookmarks with COMPLETELY different paths : ${String(trulyMissing).padStart(5)}         ║`);
  console.log(`║  DB bookmarks whose URL is NOT in Chrome now  : ${String(notInChrome).padStart(5)}         ║`);
  console.log(`║  Chrome bookmarks NOT yet in DB (truly new)   : ${String(newInChrome.length).padStart(5)}         ║`);
  console.log('╚══════════════════════════════════════════════════════════════╝');

  if (prefixMismatchSamples.length > 0) {
    console.log('\n📋 Sample PREFIX MISMATCH entries (Bookmarks Bar > prefix):');
    prefixMismatchSamples.forEach(s => {
      console.log(`  Chrome: ${s.chromePath}`);
      console.log(`  DB:     ${s.dbPath}`);
      console.log(`  URL:    ${s.url.substring(0, 80)}`);
      console.log();
    });
  }

  if (trulyMissingSamples.length > 0) {
    console.log('📋 Sample TRULY DIFFERENT path entries:');
    trulyMissingSamples.forEach(s => {
      console.log(`  Chrome: ${s.chromePath}`);
      console.log(`  DB:     ${s.dbPath}`);
      console.log(`  URL:    ${s.url.substring(0, 80)}`);
      console.log();
    });
  }

  if (newInChrome.length > 0) {
    console.log(`\n🆕 ${newInChrome.length} Chrome bookmark(s) NOT yet in BookSmart DB (samples):`);
    console.log('─'.repeat(80));
    newInChrome.slice(0, 20).forEach(b => {
      console.log(`  📌 [${b.path}]  ${b.url.substring(0, 70)}`);
    });
    if (newInChrome.length > 20) {
      console.log(`  ... and ${newInChrome.length - 20} more.`);
    }
  }
}

main().catch(console.error);
