import { getSupabase } from '@/lib/supabase';
import type { Tables } from '@/types/database';

export type RouteMapData = {
  trackPoints: Tables<'route_track_points'>[];
  routePoints: Tables<'route_points'>[];
};

const TRACK_PAGE_SIZE = 1000;

async function getAllTrackPoints(routeId: string) {
  const supabase = getSupabase();
  const points: Tables<'route_track_points'>[] = [];
  for (let from = 0; ; from += TRACK_PAGE_SIZE) {
    const { data, error } = await supabase
      .from('route_track_points')
      .select('*')
      .eq('route_id', routeId)
      .order('sequence_no', { ascending: true })
      .range(from, from + TRACK_PAGE_SIZE - 1);
    if (error) throw error;
    points.push(...data);
    if (data.length < TRACK_PAGE_SIZE) return points;
  }
}

export async function getRouteMapData(routeId: string): Promise<RouteMapData> {
  const supabase = getSupabase();
  const [trackResult, routePointsResult] = await Promise.all([
    getAllTrackPoints(routeId),
    supabase
      .from('route_points')
      .select('*')
      .eq('route_id', routeId)
      .order('sequence_no', { ascending: true, nullsFirst: false }),
  ]);

  if (routePointsResult.error) throw routePointsResult.error;
  return { trackPoints: trackResult, routePoints: routePointsResult.data };
}
