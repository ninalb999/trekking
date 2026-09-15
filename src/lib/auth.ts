import { getSupabase } from '@/lib/supabase';

export function signUp(email: string, password: string, fullName: string, phone?: string) {
  return getSupabase().auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, ...(phone ? { phone } : {}) } },
  });
}

export function signInWithPassword(email: string, password: string) {
  return getSupabase().auth.signInWithPassword({ email, password });
}

export function signOut() {
  return getSupabase().auth.signOut();
}

export function getSession() {
  return getSupabase().auth.getSession();
}
