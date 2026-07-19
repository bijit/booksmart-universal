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

async function findUsers() {
  console.log('👥 Querying all Auth users and their bookmark counts...');

  // Get users
  const { data: { users }, error: uError } = await supabase.auth.admin.listUsers();
  if (uError) {
    console.error('❌ Error listing users:', uError);
    process.exit(1);
  }

  console.log(`\nFound ${users.length} user accounts in Supabase Auth:\n`);

  for (const user of users) {
    const { count, error } = await supabase
      .from('bookmarks')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);

    console.log(`👤 User: ${user.email}`);
    console.log(`   - ID: ${user.id}`);
    console.log(`   - Bookmarks Count in DB: ${count || 0}`);
    console.log('');
  }
}

findUsers().catch(console.error);
