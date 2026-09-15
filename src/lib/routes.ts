import { getSupabase } from '@/lib/supabase';
import type { Tables } from '@/types/database';

export type RouteMapData = {
  trackPoints: Tables<'route_track_points'>[];
  routePoints: Tables<'route_points'>[];
};

export async function getRouteMapData(routeId: string): Promise<RouteMapData> {
  const supabase = getSupabase();
  const [trackResult, routePointsResult] = await Promise.all([
    supabase
      .from('route_track_points')
      .select('*')
      .eq('route_id', routeId)
      .order('sequence_no', { ascending: true }),
    supabase
      .from('route_points')
      .select('*')
      .eq('route_id', routeId)
      .order('sequence_no', { ascending: true, nullsFirst: false }),
  ]);

  if (trackResult.error) throw trackResult.error;
  if (routePointsResult.error) throw routePointsResult.error;
  return { trackPoints: trackResult.data, routePoints: routePointsResult.data };
}
