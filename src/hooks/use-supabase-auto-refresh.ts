import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';

/** Mount once at the app root; cleanup also prevents Fast Refresh listeners. */
export function useSupabaseAutoRefresh() {
  useEffect(() => {
    if (!isSupabaseConfigured || Platform.OS === 'web') return;

    const { auth } = getSupabase();
    const refresh = (state: string) => {
      if (state === 'active') void auth.startAutoRefresh();
      else void auth.stopAutoRefresh();
    };

    refresh(AppState.currentState);
    const subscription = AppState.addEventListener('change', refresh);
    return () => {
      subscription.remove();
      void auth.stopAutoRefresh();
    };
  }, []);
}
