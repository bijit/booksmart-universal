import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

// Load env variables with override
config({ path: resolve('/Users/bijithore/Application Programming/booksmart/.env.local'), override: true });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase URL or Key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('🔍 Querying Bookmark queues...');

  // Phase 1 Queue (Pending)
  const { count: pendingCount, error: err1 } = await supabase
    .from('bookmarks')
    .select('id', { count: 'exact', head: true })
    .eq('processing_status', 'pending');

  if (err1) console.error('Error getting Phase 1 count:', err1);

  // Phase 2 Queue (Fast-processed, waiting for full scrape)
  const { count: phase2Count, error: err2 } = await supabase
    .from('bookmarks')
    .select('id', { count: 'exact', head: true })
    .eq('processing_status', 'completed')
    .eq('extraction_method', 'metadata');

  if (err2) console.error('Error getting Phase 2 count:', err2);

  // Phase 2 currently processing (locked)
  const { count: phase2ScrapingCount, error: err3 } = await supabase
    .from('bookmarks')
    .select('id', { count: 'exact', head: true })
    .eq('extraction_method', 'scraping');

  if (err3) console.error('Error getting Phase 2 scraping count:', err3);

  // Fully completed (readability or document service)
  const { count: fullyCompletedCount, error: err4 } = await supabase
    .from('bookmarks')
    .select('id', { count: 'exact', head: true })
    .eq('processing_status', 'completed')
    .in('extraction_method', ['readability', 'document-service']);

  if (err4) console.error('Error getting fully completed count:', err4);

  // Metadata fallbacks (failed full scraping)
  const { count: metadataOnlyCount, error: err5 } = await supabase
    .from('bookmarks')
    .select('id', { count: 'exact', head: true })
    .eq('processing_status', 'completed')
    .eq('extraction_method', 'metadata-only');

  if (err5) console.error('Error getting metadata-only count:', err5);

  // Failed lazy scraping
  const { count: metadataFailedCount, error: err6 } = await supabase
    .from('bookmarks')
    .select('id', { count: 'exact', head: true })
    .eq('extraction_method', 'metadata-failed');

  if (err6) console.error('Error getting metadata-failed count:', err6);

  console.log('\n📊 Queue & Status Breakdown:');
  console.log('────────────────────────────────────────');
  console.log(`  Phase 1 Pending Queue (Not started)  : ${pendingCount}`);
  console.log(`  Phase 2 Queue (Waiting for lazy scrape): ${phase2Count}`);
  console.log(`  Phase 2 Processing (Currently scraping): ${phase2ScrapingCount}`);
  console.log(`  Phase 2 Failed (Metadata fallback)     : ${metadataFailedCount}`);
  console.log(`  Fully Processed (Readability/Doc)      : ${fullyCompletedCount}`);
  console.log(`  Metadata-Only Completed (Fallback)     : ${metadataOnlyCount}`);
  console.log('────────────────────────────────────────');

  // Let's check bookmarks imported specifically 2 days ago
  const { data: dateGroups, error: err7 } = await supabase
    .from('bookmarks')
    .select('created_at')
    .eq('processing_status', 'completed')
    .eq('extraction_method', 'metadata');

  if (err7) {
    console.error('Error getting date grouping:', err7);
  } else if (dateGroups) {
    const countsByDate = {};
    dateGroups.forEach(b => {
      if (b.created_at) {
        const dateStr = b.created_at.split('T')[0];
        countsByDate[dateStr] = (countsByDate[dateStr] || 0) + 1;
      }
    });

    console.log('\n📅 Phase 2 Queue breakdown by Import Date:');
    console.log('────────────────────────────────────────');
    Object.entries(countsByDate).sort().forEach(([date, count]) => {
      console.log(`  ${date} : ${count} bookmark(s)`);
    });
    console.log('────────────────────────────────────────');
  }

  process.exit(0);
}

main().catch(console.error);
