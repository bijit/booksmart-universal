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

function getChromeUrlMap() {
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

  const urlMap = new Map(); // url -> { parentId, folderPath }
  const idMap = new Map(); // id -> node

  // First map all nodes by ID to construct paths easily
  function mapNodes(node) {
    idMap.set(node.id, node);
    if (node.children) {
      node.children.forEach(mapNodes);
    }
  }
  for (const rootKey of ['bookmark_bar', 'other', 'synced', 'mobile']) {
    const root = data.roots?.[rootKey];
    if (root) mapNodes(root);
  }

  function getFolderPath(folderId) {
    if (!folderId || folderId === '0' || folderId === '1') return '';
    const folder = idMap.get(folderId);
    if (!folder) return '';
    const parentPath = getFolderPath(folder.parentId);
    if (!folder.parentId || folder.parentId === '0' || folder.parentId === '1') {
      return folder.name;
    }
    return parentPath ? `${parentPath} > ${folder.name}` : folder.name;
  }

  function traverse(node) {
    if (node.type === 'url') {
      const folderPath = getFolderPath(node.parentId);
      urlMap.set(node.url, { parentId: node.parentId, folderPath });
    } else if (node.children) {
      node.children.forEach(traverse);
    }
  }

  for (const rootKey of ['bookmark_bar', 'other', 'synced', 'mobile']) {
    const root = data.roots?.[rootKey];
    if (root) traverse(root);
  }

  return urlMap;
}

async function debugCompare() {
  const chromeUrlMap = getChromeUrlMap();
  
  // Fetch user bookmarks from DB
  const { data: dbBookmarks } = await supabase
    .from('bookmarks')
    .select('id, url, folder_path, folder_id')
    .eq('user_id', userId);

  console.log(`Analyzing comparison for Govt/Defense NSA URLs...`);
  
  const nsaUrls = [
    'https://www.nsa.gov/Resources/Commercial-Solutions-for-Classified-Program/',
    'https://www.nsa.gov/About/Cybersecurity-Collaboration-Center/Collaborative-Partnerships/'
  ];

  for (const url of nsaUrls) {
    const chromeItem = chromeUrlMap.get(url);
    const dbItem = dbBookmarks.find(b => b.url === url);

    console.log(`\nURL: ${url}`);
    if (chromeItem) {
      console.log(`- Chrome Folder Path: "${chromeItem.folderPath}"`);
      console.log(`- Chrome Parent ID: "${chromeItem.parentId}"`);
    } else {
      console.log(`- NOT FOUND in Chrome map!`);
    }

    if (dbItem) {
      console.log(`- Database ID: "${dbItem.id}"`);
      console.log(`- Database Folder Path: "${dbItem.folder_path}"`);
      console.log(`- Database Folder ID: "${dbItem.folder_id}"`);
      
      if (chromeItem) {
        const normalizedDbPath = dbItem.folder_path || '';
        const normalizedFolderPath = chromeItem.folderPath || '';
        const pathsMismatch = normalizedDbPath !== normalizedFolderPath;
        const idsMismatch = dbItem.folder_id !== chromeItem.parentId;
        
        console.log(`- Paths Mismatch: ${pathsMismatch}`);
        console.log(`- IDs Mismatch: ${idsMismatch}`);
        console.log(`- Update Needed: ${pathsMismatch || idsMismatch}`);
      }
    } else {
      console.log(`- NOT FOUND in user database bookmarks!`);
    }
  }
}

debugCompare().catch(console.error);
