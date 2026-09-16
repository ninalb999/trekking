import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, processLock } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!, process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { storage: AsyncStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, lock: processLock },
    global: { fetch: async (input, init) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      try { return await fetch(input, { ...init, signal: init?.signal ?? controller.signal }); }
      finally { clearTimeout(timeout); }
    } },
  });
