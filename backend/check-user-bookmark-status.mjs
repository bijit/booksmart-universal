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

async function check() {
  console.log(`📊 Processing status distribution for user: ${userId}`);

  const { data, error } = await supabase
    .from('bookmarks')
    .select('processing_status')
    .eq('user_id', userId);

  if (error) {
    console.error('❌ Error querying status:', error);
    process.exit(1);
  }

  const counts = {};
  for (const row of data || []) {
    const status = row.processing_status || 'unknown';
    counts[status] = (counts[status] || 0) + 1;
  }

  console.log('\n--- Processing Status Counts ---');
  for (const [status, count] of Object.entries(counts)) {
    console.log(`  - ${status}: ${count}`);
  }
}

check().catch(console.error);
