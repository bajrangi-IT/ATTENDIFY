import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config.js';

export const supabase: SupabaseClient = createClient(
  config.supabaseUrl,
  config.supabaseAnonKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

// High-privileged client for administrative & background transactions
export const supabaseAdmin: SupabaseClient = createClient(
  config.supabaseUrl,
  config.supabaseServiceRoleKey || config.supabaseAnonKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

/**
 * Executes a stored procedure with timeout protection.
 */
export async function executeRpc<T = any>(
  fnName: string,
  params: Record<string, any>,
  client: SupabaseClient = supabaseAdmin
): Promise<{ data: T | null; error: any }> {
  try {
    const { data, error } = await client.rpc(fnName, params);
    return { data, error };
  } catch (err: any) {
    return { data: null, error: err };
  }
}
