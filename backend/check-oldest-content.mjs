import { supabaseAdmin } from './src/config/supabase.js';
import dotenv from 'dotenv';
dotenv.config();

async function checkOldestContent() {
  try {
    const { data: userData } = await supabaseAdmin.from('bookmarks').select('user_id').limit(1);
    const userId = userData[0]?.user_id;
    if (!userId) {
      console.log('No user found.');
      return;
    }

    // Fetch the 15 oldest COMPLETED bookmarks
    const { data: bookmarks, error } = await supabaseAdmin
      .from('bookmarks')
      .select('id, title, url, created_at, processing_status, extracted_content, qdrant_point_id')
      .eq('user_id', userId)
      .eq('processing_status', 'completed')
      .order('created_at', { ascending: true })
      .limit(15);

    if (error) throw error;

    // Let's audit one specific Qdrant point from the list we got
    const { getBookmarkById } = await import('./src/services/qdrant.service.js');
    const pointId = '2529b80d-2320-40a4-9232-9101e3f68b0a';
    console.log(`\nFetching Qdrant point: ${pointId}`);
    const qdrantData = await getBookmarkById(pointId);
    console.log('Qdrant payload properties:', Object.keys(qdrantData || {}));
    if (qdrantData) {
      console.log('content length:', qdrantData.content ? qdrantData.content.length : 0);
      console.log('content preview:', qdrantData.content ? qdrantData.content.slice(0, 300) : 'none');
    }
  } catch (error) {
    console.error('Audit failed:', error);
  }
}

checkOldestContent();
