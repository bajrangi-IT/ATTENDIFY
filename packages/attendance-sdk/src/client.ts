import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

let supabaseInstance: SupabaseClient | null = null;

/**
 * Resolves Supabase credentials from either explicit parameters, Vite import.meta.env, or Node process.env.
 */
export function getSupabaseCredentials(): SupabaseConfig {
  let url = '';
  let anonKey = '';

  // Vite / ESM environment variables
  try {
    const meta = (new Function('return typeof import.meta !== "undefined" ? import.meta : undefined'))();
    if (meta && meta.env) {
      url = meta.env.VITE_SUPABASE_URL || '';
      anonKey = meta.env.VITE_SUPABASE_ANON_KEY || '';
    }
  } catch {
    // Ignore in non-ESM environments
  }

  // Node or React Native process.env fallback
  if (!url && typeof process !== 'undefined' && process.env) {
    url =
      process.env.VITE_SUPABASE_URL ||
      process.env.EXPO_PUBLIC_SUPABASE_URL ||
      process.env.SUPABASE_URL ||
      '';
    anonKey =
      process.env.VITE_SUPABASE_ANON_KEY ||
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      '';
  }

  return { supabaseUrl: url, supabaseAnonKey: anonKey };
}

/**
 * Creates or returns the initialized Supabase client singleton.
 */
export function getSupabaseClient(config?: Partial<SupabaseConfig>): SupabaseClient {
  if (supabaseInstance && !config) {
    return supabaseInstance;
  }

  const defaultCreds = getSupabaseCredentials();
  const supabaseUrl = config?.supabaseUrl || defaultCreds.supabaseUrl || 'https://placeholder.supabase.co';
  const supabaseAnonKey = config?.supabaseAnonKey || defaultCreds.supabaseAnonKey || 'placeholder-anon-key';

  const client = createClient(supabaseUrl, supabaseAnonKey, {
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

  if (!config) {
    supabaseInstance = client;
  }

  return client;
}
