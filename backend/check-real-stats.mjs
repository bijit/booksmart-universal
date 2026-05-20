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

async function check() {
  console.log('📊 Querying Real Bookmarks Stats (Over All Rows)...');

  // Total completed
  const { count: completed, error: e1 } = await supabase
    .from('bookmarks')
    .select('id', { count: 'exact', head: true })
    .eq('processing_status', 'completed');

  // Readability completed
  const { count: readability, error: e2 } = await supabase
    .from('bookmarks')
    .select('id', { count: 'exact', head: true })
    .eq('processing_status', 'completed')
    .eq('extraction_method', 'readability');

  // Metadata completed
  const { count: metadata, error: e3 } = await supabase
    .from('bookmarks')
    .select('id', { count: 'exact', head: true })
    .eq('processing_status', 'completed')
    .eq('extraction_method', 'metadata-only');

  // Document completed
  const { count: doc, error: e4 } = await supabase
    .from('bookmarks')
    .select('id', { count: 'exact', head: true })
    .eq('processing_status', 'completed')
    .eq('extraction_method', 'document-service');

  // Total with cover image
  const { count: withCover, error: e5 } = await supabase
    .from('bookmarks')
    .select('id', { count: 'exact', head: true })
    .eq('processing_status', 'completed')
    .not('cover_image', 'is', null);

  // Total with extracted images
  // To count arrays that are not empty in Supabase, we can check not.filter(extracted_images, 'eq', '{}') or similar,
  // or we can just fetch those with cover image as a proxy, or query it. Let's do a select for extraction counts.
  
  console.log('\n=============================================');
  console.log(`📈 REAL INGESTION STATS (Completed: ${completed})`);
  console.log('=============================================');
  console.log(`  - Readability Scraped : ${readability} (${((readability / completed) * 100).toFixed(1)}%)`);
  console.log(`  - Metadata Fallback   : ${metadata} (${((metadata / completed) * 100).toFixed(1)}%)`);
  console.log(`  - Document Service    : ${doc} (${((doc / completed) * 100).toFixed(1)}%)`);
  console.log('---------------------------------------------');
  console.log(`🖼️  Bookmarks with Cover Image: ${withCover} (${((withCover / completed) * 100).toFixed(1)}%)`);
  console.log('=============================================');
}

check();
