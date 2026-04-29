import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Defensive initialization
export const supabase = (supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('http')) 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : { 
      auth: { 
        getUser: async () => ({ data: { user: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
      },
      from: () => ({ 
        select: () => ({ 
          eq: () => ({ 
            single: async () => ({ data: null, error: null }),
            order: () => ({ limit: async () => ({ data: [], error: null }) })
          }) 
        }),
        upsert: async () => ({ data: null, error: { message: 'Supabase keys missing or invalid' } }),
        insert: async () => ({ data: null, error: { message: 'Supabase keys missing or invalid' } })
      })
    };

if (!supabaseUrl || !supabaseAnonKey || !supabaseUrl.startsWith('http')) {
  console.warn('⚠️ Supabase credentials missing or invalid in client/.env. Persistence is disabled.');
} else {
  console.log('✅ Supabase Client Initialized');
}
