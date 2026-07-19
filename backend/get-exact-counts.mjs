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
  const { count: total } = await supabase
    .from('bookmarks')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  const { count: completed } = await supabase
    .from('bookmarks')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('processing_status', 'completed');

  const { count: failed } = await supabase
    .from('bookmarks')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('processing_status', 'failed');

  const { count: pending } = await supabase
    .from('bookmarks')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('processing_status', 'pending');

  const { count: nonFailed } = await supabase
    .from('bookmarks')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .neq('processing_status', 'failed');

  console.log(`User: ${userId}`);
  console.log(`- Total: ${total}`);
  console.log(`- Completed: ${completed}`);
  console.log(`- Failed: ${failed}`);
  console.log(`- Pending: ${pending}`);
  console.log(`- Non-Failed: ${nonFailed}`);
}

check().catch(console.error);
