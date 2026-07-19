import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const userId = 'f6e5f973-c712-45ad-a5a8-8407fb38e03c';

async function check() {
  console.log(`📊 Checking folders for user: ${userId}`);

  // Count bookmarks
  const { count: total, error: e1 } = await supabase
    .from('bookmarks')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  // Count bookmarks with non-null folder paths
  const { count: withPath, error: e2 } = await supabase
    .from('bookmarks')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .not('folder_path', 'is', null);

  // Count bookmarks with null folder paths
  const { count: nullPath, error: e3 } = await supabase
    .from('bookmarks')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('folder_path', null);

  // Get distinct folder paths
  const { data: paths, error: e4 } = await supabase
    .from('bookmarks')
    .select('folder_path')
    .eq('user_id', userId)
    .not('folder_path', 'is', null);

  const uniquePaths = [...new Set((paths || []).map(p => p.folder_path))].filter(Boolean).sort();

  console.log(`- Total Bookmarks: ${total}`);
  console.log(`- With folder_path: ${withPath}`);
  console.log(`- With null folder_path: ${nullPath}`);
  console.log(`- Unique Folder Paths count: ${uniquePaths.length}`);
  console.log('\n--- Folder Paths List ---');
  uniquePaths.forEach((p, idx) => console.log(`  [${idx+1}] ${p}`));
}

check().catch(console.error);
