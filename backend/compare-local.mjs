import { config } from 'dotenv';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { homedir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables in .env.local.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 1. Get Chrome Bookmarks
function getChromeBookmarks() {
  const profiles = ['Default', 'Profile 1', 'Profile 2', 'Profile 3'];
  let data = null;
  let chosenProfilePath = '';
  
  for (const p of profiles) {
    const profilePath = join(
      homedir(),
      'Library/Application Support/Google/Chrome',
      p,
      'Bookmarks'
    );
    if (existsSync(profilePath)) {
      try {
        data = JSON.parse(readFileSync(profilePath, 'utf-8'));
        chosenProfilePath = profilePath;
        break;
      } catch (e) {
        console.warn(`Could not parse ${profilePath}: ${e.message}`);
      }
    }
  }

  if (!data) {
    console.error('❌ Could not find Chrome bookmarks file under default profiles.');
    process.exit(1);
  }

  console.log(`📖 Read Chrome bookmarks from: ${chosenProfilePath}`);

  const folders = new Map(); // path -> count of URLs directly inside
  let totalBookmarks = 0;

  function traverse(node, path = '') {
    if (node.type === 'folder') {
      const name = node.name || '';
      let currentPath;
      const rootNames = ['Bookmarks bar', 'Other bookmarks', 'Mobile bookmarks', 'Managed bookmarks'];
      if (rootNames.includes(name)) {
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

async function main() {
  const chrome = getChromeBookmarks();
  
  // 2. Get ALL BookSmart database bookmarks via pagination (Supabase caps at 1000/request)
  console.log('🔄 Fetching all bookmarks from database...');
  let allDbBookmarks = [];
  const PAGE_SIZE = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('bookmarks')
      .select('folder_path, processing_status')
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      console.error('❌ Error fetching from Supabase:', error.message);
      process.exit(1);
    }
    if (!data || data.length === 0) break;
    allDbBookmarks = allDbBookmarks.concat(data);
    if (data.length < PAGE_SIZE) break; // last page
    from += PAGE_SIZE;
  }
  console.log(`✅ Fetched ${allDbBookmarks.length} total bookmarks from database.\n`);

  const booksmartFolderPaths = new Set(
    allDbBookmarks.map(b => b.folder_path).filter(Boolean)
  );

  const chromeFolderPaths = new Set(chrome.folders.keys());

  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║        CHROME vs BOOKSMART COMPARISON            ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║  Chrome folders in local file : ${String(chromeFolderPaths.size).padStart(6)}             ║`);
  console.log(`║  BookSmart folders in database: ${String(booksmartFolderPaths.size).padStart(6)}             ║`);
  console.log(`║  Total bookmarks in Chrome file: ${String(chrome.totalBookmarks).padStart(6)}             ║`);
  console.log(`║  Total bookmarks in database  : ${String(allDbBookmarks.length).padStart(6)}             ║`);
  
  const statusCounts = { pending: 0, processing: 0, completed: 0, failed: 0 };
  allDbBookmarks.forEach(b => {
    const status = b.processing_status || 'completed';
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });
  
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║  Pending in database   : ${String(statusCounts.pending).padStart(6)}                     ║`);
  console.log(`║  Processing in database: ${String(statusCounts.processing).padStart(6)}                     ║`);
  console.log(`║  Completed in database : ${String(statusCounts.completed).padStart(6)}                     ║`);
  console.log(`║  Failed in database    : ${String(statusCounts.failed).padStart(6)}                     ║`);
  console.log('╚══════════════════════════════════════════════════╝');

  // Folders in Chrome but NOT in BookSmart
  const missingFromBooksmart = [];
  for (const cp of chromeFolderPaths) {
    const found = booksmartFolderPaths.has(cp) || 
                  [...booksmartFolderPaths].some(bp => bp.toLowerCase() === cp.toLowerCase());
    if (!found) {
      missingFromBooksmart.push(cp);
    }
  }

  // Folders in BookSmart but NOT in Chrome
  const extraInBooksmart = [];
  for (const bp of booksmartFolderPaths) {
    const found = chromeFolderPaths.has(bp) ||
                  [...chromeFolderPaths].some(cp => cp.toLowerCase() === bp.toLowerCase());
    if (!found) {
      extraInBooksmart.push(bp);
    }
  }

  console.log('\n=== COMPARISON RESULTS ===');
  if (missingFromBooksmart.length === 0) {
    console.log('\n✅ All Chrome folders are successfully synced in BookSmart!');
  } else {
    console.log(`\n⚠️  ${missingFromBooksmart.length} Chrome folder(s) are MISSING from BookSmart (not synced):`);
    console.log('─'.repeat(80));
    // Print first 50 missing folders
    const displayList = missingFromBooksmart.sort();
    displayList.slice(0, 50).forEach(f => {
      const count = chrome.folders.get(f) || 0;
      console.log(`  ❌ ${f} (${count} bookmark${count !== 1 ? 's' : ''})`);
    });
    if (displayList.length > 50) {
      console.log(`  ... and ${displayList.length - 50} more folders.`);
    }
  }

  if (extraInBooksmart.length > 0) {
    console.log(`\n📌 ${extraInBooksmart.length} folder(s) exist in BookSmart database but are NOT in Chrome:`);
    console.log('─'.repeat(80));
    extraInBooksmart.slice(0, 20).sort().forEach(f => {
      console.log(`  📁 ${f}`);
    });
    if (extraInBooksmart.length > 20) {
      console.log(`  ... and ${extraInBooksmart.length - 20} more folders.`);
    }
  }
}

main().catch(console.error);
