import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://gibeljemxpogvqgdjipt.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpYmVsamVteHBvZ3ZxZ2RqaXB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwMjI1NzUsImV4cCI6MjEwNTU5ODU3NX0.tIUGU_BDTYu7W656YZWqx4enTpMhOwrFS-H9QqkDw9o';

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export const DEFAULT_INSTITUTION_ID = import.meta.env.VITE_DEFAULT_INSTITUTION_ID || '00000000-0000-0000-0000-000000000001';
