import type { PublicRoute } from '@/lib/public-routes';
import { getSupabase } from '@/lib/supabase';
import type { Tables } from '@/types/database';

export type UserRoute = PublicRoute & Pick<
  Tables<'routes'>,
  'visibility' | 'status'
>;

/** Fetches the verified session user before querying only that user's routes. */
export async function listCurrentUserRoutes(): Promise<UserRoute[]> {
  const supabase = getSupabase();
  const { data: userResult, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userResult.user) return [];

  const { data, error } = await supabase
    .from('routes')
    .select(
      'id, name, description, difficulty, estimated_duration_minutes, main_image_path, total_distance_m, updated_at, visibility, status',
    )
    .eq('owner_id', userResult.user.id)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data;
}
