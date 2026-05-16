/**
 * Supabase Client Configuration
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config();
config({ path: resolve(__dirname, '../../.env.local') });

// Polyfill WebSocket for Supabase in Node 20
if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = class {};
}

// Note: Environment variables are also loaded in index.js
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

console.log('[Supabase Config] URL present:', !!supabaseUrl);
console.log('[Supabase Config] Anon Key present:', !!supabaseAnonKey);

// Create Supabase clients safely
export let supabase;
export let supabaseAdmin;

if (supabaseUrl && supabaseAnonKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: true, persistSession: false },
      realtime: { enabled: false }
    });
    console.log('✅ Supabase client initialized');
  } catch (err) {
    console.error('❌ Supabase client failed:', err.message);
  }
}

if (supabaseUrl && supabaseServiceKey) {
  try {
    supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      realtime: { enabled: false }
    });
    console.log('✅ Supabase admin initialized');
  } catch (err) {
    console.error('❌ Supabase admin failed:', err.message);
  }
}

console.log('✅ Supabase clients initialized');
