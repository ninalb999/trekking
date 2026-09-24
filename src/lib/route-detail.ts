import { getPublicRouteDetail, type PublicRouteDetail } from '@/lib/public-routes';
import { getRouteImageUrl } from '@/lib/route-images';

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
  return getRouteImageUrl(path);
}
