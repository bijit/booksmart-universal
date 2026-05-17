import '../config/env.js';
import { supabaseAdmin } from '../config/supabase.js';

async function checkPending() {
  try {
    console.log('--- DB PENDING CHECK ---');
    
    const { count, error } = await supabaseAdmin
      .from('bookmarks')
      .select('*', { count: 'exact', head: true })
      .eq('processing_status', 'pending');

    if (error) throw error;
    
    console.log(`Pending bookmarks count: ${count}`);

    const { data: latest, error: err2 } = await supabaseAdmin
      .from('bookmarks')
      .select('id, url, processing_status, created_at')
      .order('created_at', { ascending: false })
      .limit(5);
      
    if (err2) throw err2;
    
    console.log('Latest 5 bookmarks:');
    latest.forEach(b => console.log(`- [${b.processing_status}] ${b.url} (Created: ${b.created_at})`));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit();
  }
}

checkPending();
