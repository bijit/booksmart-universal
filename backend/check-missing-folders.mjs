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
const userId = 'f6e5f973-c712-45ad-a5a8-8407fb38e03c';

function getChromeFolders() {
  const profiles = ['Default', 'Profile 1', 'Profile 2', 'Profile 3'];
  let data = null;
  for (const p of profiles) {
    const path = join(homedir(), 'Library/Application Support/Google/Chrome', p, 'Bookmarks');
    if (existsSync(path)) {
      try { data = JSON.parse(readFileSync(path, 'utf-8')); break; } catch(e) {}
    }
  }
  if (!data) {
    console.error('❌ No Chrome Bookmarks file found');
    process.exit(1);
  }

  const chromeFolders = new Map(); // path -> Array of bookmark URLs

  function traverse(node, currentPath = '') {
    if (node.type === 'folder') {
      const name = node.name || '';
      let folderPath = currentPath;
      
      // Mirror the getFolderPath formatting from extension
      // Bookmarks Bar prefix is skipped
      if (node.id === '1') {
        folderPath = '';
      } else if (node.id === '2') {
        folderPath = 'Other Bookmarks';
      } else if (node.id !== '0') {
        folderPath = currentPath ? `${currentPath} > ${name}` : name;
      }
      
      const urls = [];
      for (const child of node.children || []) {
        if (child.type === 'url') {
          urls.push(child.url);
        } else if (child.type === 'folder') {
          traverse(child, folderPath);
        }
      }
      
      if (folderPath) {
        if (!chromeFolders.has(folderPath)) {
          chromeFolders.set(folderPath, []);
        }
        chromeFolders.get(folderPath).push(...urls);
      }
    }
  }

  for (const rootKey of ['bookmark_bar', 'other', 'synced', 'mobile']) {
    const root = data.roots?.[rootKey];
    if (root) traverse(root);
  }

  return chromeFolders;
}

async function run() {
  console.log('🔍 Comparing local Chrome Folders against Supabase DB Bookmarks...');
  
  const chromeFolders = getChromeFolders();
  console.log(`- Local Chrome has ${chromeFolders.size} unique folder paths`);

  // Paginated fetch of all database bookmarks for this user
  const dbBookmarks = [];
  let from = 0;
  const limit = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('bookmarks')
      .select('url, folder_path')
      .eq('user_id', userId)
      .range(from, from + limit - 1);

    if (error) {
      console.error('❌ Supabase fetch error:', error);
      process.exit(1);
    }
    
    if (!data || data.length === 0) break;
    dbBookmarks.push(...data);
    if (data.length < limit) break;
    from += limit;
  }

  console.log(`- Database has ${dbBookmarks.length} bookmarks for this user`);

  const dbFolders = new Set();
  const dbUrls = new Set();
  for (const bm of dbBookmarks) {
    dbUrls.add(bm.url);
    if (bm.folder_path) {
      dbFolders.add(bm.folder_path);
    }
  }
  console.log(`- Database has ${dbFolders.size} unique folder paths for this user`);

  let countEmptyMissing = 0;
  let countUnimportedMissing = 0;
  let countUnsyncedMissing = 0;
  
  const unsyncedFoldersList = [];
  const unimportedFoldersList = [];

  for (const [folderPath, urls] of chromeFolders.entries()) {
    if (!dbFolders.has(folderPath)) {
      if (urls.length === 0) {
        countEmptyMissing++;
      } else {
        const savedCount = urls.filter(url => dbUrls.has(url)).length;
        if (savedCount === 0) {
          countUnimportedMissing++;
          unimportedFoldersList.push({ folderPath, count: urls.length });
        } else {
          countUnsyncedMissing++;
          unsyncedFoldersList.push({ folderPath, savedCount, totalCount: urls.length });
        }
      }
    }
  }

  console.log('\n=============================================');
  console.log('📊 ANALYSIS OF MISSING FOLDERS');
  console.log('=============================================');
  console.log(`Total Chrome Folders not in BookSmart: ${countEmptyMissing + countUnimportedMissing + countUnsyncedMissing}`);
  console.log(`  - Empty Chrome folders (no bookmarks): ${countEmptyMissing}`);
  console.log(`  - Folders with 0 bookmarks imported into BookSmart: ${countUnimportedMissing}`);
  console.log(`  - Folders with some bookmarks imported but path not updated (warning): ${countUnsyncedMissing}`);
  console.log('=============================================');

  if (unsyncedFoldersList.length > 0) {
    console.log('\n⚠️ DETAILED WARNING FOLDERS (Saved in DB but path is not updated):');
    unsyncedFoldersList.forEach(x => {
      console.log(`  - "${x.folderPath}" (${x.savedCount}/${x.totalCount} saved bookmarks)`);
    });
  }
  
  if (unimportedFoldersList.length > 0) {
    console.log('\n📂 TOP 10 UNIMPORTED FOLDERS (0 bookmarks imported):');
    unimportedFoldersList.slice(0, 10).forEach(x => {
      console.log(`  - "${x.folderPath}" (contains ${x.count} bookmarks in Chrome)`);
    });
  }
}

run().catch(console.error);
