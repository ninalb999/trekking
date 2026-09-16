import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => { if (active) setSession(data.session); }).catch(() => {});
    const { data } = supabase.auth.onAuthStateChange((_, next) => setSession(next));
    const listener = AppState.addEventListener('change', state => {
      if (state === 'active') supabase.auth.startAutoRefresh(); else supabase.auth.stopAutoRefresh();
    });
    return () => { active = false; data.subscription.unsubscribe(); listener.remove(); };
  }, []);
  return session;
}
