import { getPublicRouteDetail, type PublicRouteDetail } from '@/lib/public-routes';
import { getSupabase } from '@/lib/supabase';

export type RouteDetail = PublicRouteDetail;

/**
 * Reuses the public catalogue contract. It supports published Supabase routes
 * and the local demo routes used when the app is offline.
 */
export function getRouteById(routeId: string): Promise<RouteDetail | null> {
  return getPublicRouteDetail(routeId);
}

/** Resolves the private Storage path from HU-20 into a short-lived display URL. */
export async function getRouteMainImageUrl(path: string | null): Promise<string | null> {
  if (!path) return null;

  const { data, error } = await getSupabase()
    .storage
    .from('route-images')
    .createSignedUrl(path, 15 * 60);

  if (error) throw error;
  return data.signedUrl;
}
