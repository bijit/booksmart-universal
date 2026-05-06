import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables immediately
config({ path: resolve(__dirname, '../../.env.local') });
config(); // Also load from process.env (for Cloud Run)

console.log('🌍 Environment variables check:');
console.log('   - SUPABASE_URL:', !!process.env.SUPABASE_URL);
console.log('   - SUPABASE_ANON_KEY:', !!process.env.SUPABASE_ANON_KEY);
console.log('   - SUPABASE_SERVICE_ROLE_KEY:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
console.log('   - QDRANT_URL:', !!process.env.QDRANT_URL);
console.log('   - QDRANT_API_KEY:', !!process.env.QDRANT_API_KEY);
console.log('   - GOOGLE_AI_API_KEY:', !!process.env.GOOGLE_AI_API_KEY);

if (process.env.SUPABASE_URL) {
  console.log('   - SUPABASE_URL starts with:', process.env.SUPABASE_URL.substring(0, 10) + '...');
}
