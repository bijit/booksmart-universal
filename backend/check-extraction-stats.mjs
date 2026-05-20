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

async function checkStats() {
  console.log('📊 Querying Bookmarks Ingestion Stats...');

  // 1. Total completed bookmarks
  const { count: totalCount, error: err1 } = await supabase
    .from('bookmarks')
    .select('*', { count: 'exact', head: true })
    .eq('processing_status', 'completed');

  if (err1) {
    console.error('Error fetching total:', err1.message);
    process.exit(1);
  }

  // 2. Count by extraction method
  const { data: methods, error: err2 } = await supabase
    .from('bookmarks')
    .select('extraction_method');

  if (err2) {
    console.error('Error fetching methods:', err2.message);
    process.exit(1);
  }

  const methodCounts = {};
  let totalWithCoverImage = 0;
  let totalWithExtractedImages = 0;

  // Let's get counts of bookmarks with cover images or extracted images
  const { data: imageStats, error: err3 } = await supabase
    .from('bookmarks')
    .select('cover_image, extracted_images, extraction_method')
    .eq('processing_status', 'completed');

  if (err3) {
    console.error('Error fetching image stats:', err3.message);
    process.exit(1);
  }

  imageStats.forEach(b => {
    const method = b.extraction_method || 'unknown';
    methodCounts[method] = (methodCounts[method] || 0) + 1;

    if (b.cover_image) {
      totalWithCoverImage++;
    }
    if (b.extracted_images && b.extracted_images.length > 0) {
      totalWithExtractedImages++;
    }
  });

  console.log('\n=============================================');
  console.log(`📈 INGESTION SUMMARY (Completed: ${totalCount})`);
  console.log('=============================================');
  console.log('Extraction Methods:');
  Object.entries(methodCounts).forEach(([method, count]) => {
    const percentage = ((count / totalCount) * 100).toFixed(1);
    console.log(`  - ${method}: ${count} (${percentage}%)`);
  });
  console.log('---------------------------------------------');
  console.log(`🖼️ Bookmarks with Cover Image: ${totalWithCoverImage} (${((totalWithCoverImage / totalCount) * 100).toFixed(1)}%)`);
  console.log(`📷 Bookmarks with Content Images: ${totalWithExtractedImages} (${((totalWithExtractedImages / totalCount) * 100).toFixed(1)}%)`);
  console.log('=============================================');

  process.exit(0);
}

checkStats();
