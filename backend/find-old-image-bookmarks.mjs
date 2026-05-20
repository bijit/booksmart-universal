import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env
config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function findSamples() {
  console.log('🔍 Looking for older bookmarks with cover images and folders...');

  // Query completed bookmarks with cover_image and folder_path
  const { data: bookmarks, error } = await supabase
    .from('bookmarks')
    .select('title, folder_path, cover_image, url, created_at')
    .eq('processing_status', 'completed')
    .not('cover_image', 'is', null)
    .not('folder_path', 'is', null)
    .order('created_at', { ascending: true }) // Oldest first
    .limit(10);

  if (error) {
    console.error('Error querying Supabase:', error.message);
    process.exit(1);
  }

  if (!bookmarks || bookmarks.length === 0) {
    console.log('❌ No older bookmarks found with cover images and folder paths.');
    process.exit(0);
  }

  console.log(`\n🎉 Found ${bookmarks.length} older bookmarks with images!\n`);
  bookmarks.forEach((b, idx) => {
    console.log(`Sample #${idx + 1}`);
    console.log(`- Title      : ${b.title}`);
    console.log(`- Folder Path: ${b.folder_path}`);
    console.log(`- Saved Date : ${new Date(b.created_at).toLocaleDateString()}`);
    console.log(`- URL        : ${b.url}`);
    console.log(`- Cover Image: ${b.cover_image}`);
    console.log('--------------------------------------------------');
  });

  process.exit(0);
}

findSamples();
