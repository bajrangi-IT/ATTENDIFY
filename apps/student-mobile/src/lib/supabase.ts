import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gibeljemxpogvqgdjipt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpYmVsamVteHBvZ3ZxZ2RqaXB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwMjI1NzUsImV4cCI6MjEwNTU5ODU3NX0.tIUGU_BDTYu7W656YZWqx4enTpMhOwrFS-H9QqkDw9o';

// Reliable in-memory & session storage adapter for React Native Expo
class MemoryStorage {
  private store: Map<string, string> = new Map();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: new MemoryStorage(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export const DEFAULT_INSTITUTION_ID = '00000000-0000-0000-0000-000000000001';
