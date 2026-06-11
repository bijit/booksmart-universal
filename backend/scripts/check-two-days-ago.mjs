import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

config({ path: resolve('/Users/bijithore/Application Programming/booksmart/.env.local'), override: true });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const startDate = '2026-06-05T00:00:00.000Z';
  const endDate = '2026-06-07T23:59:59.999Z';

  console.log(`Checking status of bookmarks imported between ${startDate} and ${endDate}...\n`);

  const { data, error } = await supabase
    .from('bookmarks')
    .select('id, url, title, processing_status, extraction_method, created_at')
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  if (error) {
    console.error('Error fetching bookmarks:', error);
    process.exit(1);
  }

  console.log(`Total bookmarks imported in range: ${data.length}\n`);

  const breakdown = {};
  data.forEach(b => {
    const dateStr = b.created_at.split('T')[0];
    const statusKey = `Status: ${b.processing_status} | Method: ${b.extraction_method}`;
    if (!breakdown[dateStr]) breakdown[dateStr] = {};
    breakdown[dateStr][statusKey] = (breakdown[dateStr][statusKey] || 0) + 1;
  });

  console.log('Breakdown by Date, Status & Extraction Method:');
  console.log('────────────────────────────────────────');
  Object.keys(breakdown).sort().forEach(date => {
    console.log(`📅 Date: ${date}`);
    Object.entries(breakdown[date]).forEach(([key, count]) => {
      console.log(`  - ${key}: ${count} bookmark(s)`);
    });
  });
  console.log('────────────────────────────────────────\n');

  process.exit(0);
}

main().catch(console.error);
