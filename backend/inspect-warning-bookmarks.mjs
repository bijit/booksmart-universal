import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);
const userId = 'f6e5f973-c712-45ad-a5a8-8407fb38e03c';

// URLs for Govt/Defense Opportunities > Texas State Gov.
// URL: in Chrome it has 1 bookmark.
// Let's query bookmarks for this user where url or folder_path is related.
async function inspect() {
  const { data: bms, error } = await supabase
    .from('bookmarks')
    .select('id, url, title, folder_path, folder_id')
    .eq('user_id', userId);

  // Let's filter bookmarks whose folder_path is different from the expected folder paths
  // Govt/Defense Opportunities > Texas State Gov.
  // Let's print out the bookmarks with Govt/Defense in folder_path in DB
  const govtBms = bms.filter(b => b.folder_path && b.folder_path.includes('Govt'));
  console.log('--- Govt/Defense Bookmarks in DB ---');
  console.log(govtBms);

  const diffusionBms = bms.filter(b => b.folder_path && b.folder_path.includes('Diffusion'));
  console.log('--- Diffusion Bookmarks in DB ---');
  console.log(diffusionBms);
}

inspect().catch(console.error);
