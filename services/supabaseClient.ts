import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Simple Supabase client wrapper for the frontend.
// Expects env vars:
// - VITE_SUPABASE_URL
// - VITE_SUPABASE_ANON_KEY

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fallback to throwing early to make misconfiguration obvious in dev
  // (in production this will surface in the console).
  // eslint-disable-next-line no-console
  console.error(
    'Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env.local file.'
  );
}

let supabase: SupabaseClient | null = null;

export const getSupabaseClient = (): SupabaseClient => {
  if (!supabase) {
    supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');
  }
  return supabase;
};

