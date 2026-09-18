import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, processLock, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import type { Database } from '@/types/database';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

let client: SupabaseClient<Database> | undefined;

/** A single typed client; the starter also works before .env is configured. */
export function getSupabase(): SupabaseClient<Database> {
  if (client) return client;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Configura EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY en .env.local.',
    );
  }

  client = createClient<Database>(supabaseUrl, supabaseKey, {
    auth: {
      ...(Platform.OS !== 'web' ? { storage: AsyncStorage } : {}),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      lock: processLock,
    },
    global: { fetch: async (input, init) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      try { return await fetch(input, { ...init, signal: init?.signal ?? controller.signal }); }
      finally { clearTimeout(timeout); }
    } },
  });
  return client;
}
