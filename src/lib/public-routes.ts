import type { Tables } from '@/types/database';

import { getSupabase } from '@/lib/supabase';

export type PublicRoute = Pick<
  Tables<'routes'>,
  | 'id'
  | 'name'
  | 'description'
  | 'difficulty'
  | 'estimated_duration_minutes'
  | 'main_image_path'
  | 'total_distance_m'
  | 'updated_at'
>;

const ROUTE_IMAGES_BUCKET = 'route-images';

/** Lists only routes that the public RLS policy makes visible. */
export async function listPublicRoutes(): Promise<PublicRoute[]> {
  const { data, error } = await getSupabase()
    .from('routes')
    .select(
      'id, name, description, difficulty, estimated_duration_minutes, main_image_path, total_distance_m, updated_at',
    )
    .eq('visibility', 'public')
    .eq('status', 'published')
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data;
}

/** A short-lived URL preserves the private bucket's RLS rules. */
export async function getPublicRouteImageUrl(path: string): Promise<string> {
  const { data, error } = await getSupabase().storage
    .from(ROUTE_IMAGES_BUCKET)
    .createSignedUrl(path, 5 * 60);
  if (error || !data?.signedUrl) throw error ?? new Error('No se pudo cargar la fotografía.');
  return data.signedUrl;
}
