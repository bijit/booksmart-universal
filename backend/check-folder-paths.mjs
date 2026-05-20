import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  const { data, error } = await supabase
    .from('bookmarks')
    .select('folder_path');

  if (error) {
    console.error('Error fetching bookmarks:', error);
    process.exit(1);
  }

  const paths = [...new Set(data.map(d => d.folder_path))].filter(Boolean);
  console.log('--- Folder Paths in Database ---');
  paths.forEach(p => console.log(p));
  console.log('--------------------------------');
}

check();
