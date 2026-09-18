import type { Json } from '@/types/database';

import { getSupabase } from '@/lib/supabase';

export type RecordedRoutePayload = {
  id: string;
  ownerId: string;
  status: 'finished';
  name: string;
  description: string;
  difficulty: string;
  visibility: 'public' | 'private';
  started: number;
  ended: number;
  distance: number;
  elapsed: number;
  pauseCount: number;
  updatedAt: number;
  points: Array<{
    latitude: number;
    longitude: number;
    accuracy: number | null;
    timestamp: number;
    segment: number;
  }>;
  places: Array<{
    id: string;
    type: 'campamento' | 'descanso' | 'agua' | 'tienda' | 'otro';
    name: string;
    description: string;
    latitude: number;
    longitude: number;
    services: string[];
  }>;
  equipment: string[];
};

export async function saveRecordedRoute(payload: RecordedRoutePayload) {
  const { data, error } = await getSupabase().rpc('save_recorded_route_v1', {
    payload: payload as unknown as Json,
  });
  if (error) throw error;
  if (!data) throw new Error('La ruta no devolvió un identificador después de guardarse.');
  return data;
}
