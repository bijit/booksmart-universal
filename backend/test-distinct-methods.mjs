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
  const { data, error } = await supabase
    .from('bookmarks')
    .select('extraction_method, cover_image, processing_status');

  if (error) {
    console.error(error);
    process.exit(1);
  }

  const counts = {};
  data.forEach(d => {
    const key = `${d.processing_status || 'null'} / ${d.extraction_method || 'null'}`;
    counts[key] = (counts[key] || 0) + 1;
  });

  console.log('Distinct processing_status / extraction_method combinations:');
  console.log(counts);
}

check();
