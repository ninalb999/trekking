import { getSupabase, isSupabaseConfigured } from './supabase';
import type { Json } from '../types/database';
import type { Place } from './route-data';
import type { TrackPoint } from './recording';
import { getRouteImageUrl } from './route-images';

export type PublicRouteSummary = {
  id: string;
  name: string;
  description: string;
  difficulty: string;
  ownerName: string;
  distanceMeters: number;
  durationSeconds: number;
  pauseCount: number;
  publishedAt: string | null;
  imagePath: string | null;
  equipment: string[];
  pointCount: number;
};

export type PublicRouteDetail = PublicRouteSummary & {
  points: TrackPoint[];
  places: Place[];
};

const FALLBACK_ROUTES: PublicRouteSummary[] = [
  { id: 'demo-laguna-escondida', name: 'Laguna Escondida', description: 'Ruta panoramica de laguna y montana.', difficulty: 'Novato', ownerName: 'Andes Explorer', distanceMeters: 12400, durationSeconds: 19800, pauseCount: 3, publishedAt: null, imagePath: null, equipment: ['Mochila', 'Agua', 'Botas'], pointCount: 3 },
  { id: 'demo-cerro-mirador', name: 'Cerro Mirador', description: 'Ascenso moderado con vista abierta del valle.', difficulty: 'Intermedio', ownerName: 'RutaLibre', distanceMeters: 8700, durationSeconds: 12000, pauseCount: 2, publishedAt: null, imagePath: null, equipment: ['Agua', 'Mapa/GPS'], pointCount: 2 },
  { id: 'demo-pico-del-sol', name: 'Pico del Sol', description: 'Tramo exigente para caminantes con experiencia.', difficulty: 'Experto', ownerName: 'Montana Viva', distanceMeters: 15200, durationSeconds: 25800, pauseCount: 4, publishedAt: null, imagePath: null, equipment: ['Bastones', 'Proteccion solar'], pointCount: 2 },
  { id: 'demo-bosque-del-rio', name: 'Bosque del Rio', description: 'Sendero corto por bosque humedo y pasarelas.', difficulty: 'Novato', ownerName: 'CaminaMas', distanceMeters: 6100, durationSeconds: 9900, pauseCount: 1, publishedAt: null, imagePath: null, equipment: ['Impermeable', 'Agua'], pointCount: 1 },
];

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function asSummary(row: Record<string, unknown>): PublicRouteSummary {
  return {
    id: String(row.id),
    name: String(row.name ?? 'Ruta sin nombre'),
    description: String(row.description ?? ''),
    difficulty: String(row.difficulty ?? 'Novato'),
    ownerName: String(row.owner_name ?? row.ownerName ?? 'Explorador'),
    distanceMeters: Number(row.total_distance_m ?? row.distanceMeters ?? 0),
    durationSeconds: Number(row.active_duration_seconds ?? row.durationSeconds ?? 0),
    pauseCount: Number(row.pause_count ?? row.pauseCount ?? 0),
    publishedAt: typeof row.published_at === 'string' ? row.published_at : null,
    imagePath: typeof row.main_image_path === 'string' ? row.main_image_path : null,
    equipment: asStringArray(row.equipment),
    pointCount: Number(row.point_count ?? row.pointCount ?? 0),
  };
}

export function formatDistance(meters: number) {
  return `${(meters / 1000).toFixed(meters >= 10000 ? 1 : 2)} km`;
}

export function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.max(0, Math.round((seconds % 3600) / 60));
  return hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`;
}

export async function listPublicRoutes(search = '', difficulty = ''): Promise<PublicRouteSummary[]> {
  if (!isSupabaseConfigured) return filterFallback(search, difficulty);
  try {
    const { data, error } = await getSupabase().rpc('public_route_catalog', {
      search_text: search.trim(),
      ...(difficulty ? { difficulty_filter: difficulty } : {}),
      limit_count: 30,
    });
    if (error) throw error;
    const routes = ((data ?? []) as unknown as Record<string, unknown>[]).map(asSummary);
    return routes.length ? routes : filterFallback(search, difficulty);
  } catch {
    return filterFallback(search, difficulty);
  }
}

export async function getPublicRouteDetail(id: string): Promise<PublicRouteDetail | null> {
  const fallback = FALLBACK_ROUTES.find(route => route.id === id);
  if (!isSupabaseConfigured || id.startsWith('demo-')) return fallback ? fallbackDetail(fallback) : null;
  const { data, error } = await getSupabase().rpc('public_route_detail', { route_id: id });
  if (error) throw new Error(error.message);
  if (!data) return null;
  const payload = data as Json as {
    route?: Record<string, unknown>;
    equipment?: unknown;
    track?: unknown;
    places?: unknown;
  };
  if (!payload.route) return null;
  const summary = asSummary({
    id,
    ...payload.route,
    ownerName: payload.route.ownerName,
    total_distance_m: payload.route.totalDistanceM,
    active_duration_seconds: payload.route.activeDurationSeconds,
    pause_count: payload.route.pauseCount,
    main_image_path: payload.route.mainImagePath,
    equipment: payload.equipment,
  });
  const points = Array.isArray(payload.track) ? payload.track.map((point, index) => {
    const raw = point as Record<string, unknown>;
    return {
      latitude: Number(raw.latitude),
      longitude: Number(raw.longitude),
      accuracy: raw.accuracy === null ? null : Number(raw.accuracy ?? 0),
      timestamp: Number(raw.timestamp ?? Date.now() + index),
      segment: Number(raw.segment ?? 0),
    };
  }).filter(point => Number.isFinite(point.latitude) && Number.isFinite(point.longitude)) : [];
  const places = Array.isArray(payload.places) ? payload.places.map((place, index) => {
    const raw = place as Record<string, unknown>;
    return {
      id: String(raw.id ?? `${id}-place-${index}`),
      name: String(raw.name ?? 'Punto de ruta'),
      description: String(raw.description ?? ''),
      type: String(raw.type ?? 'otro'),
      services: asStringArray(raw.services),
      latitude: Number(raw.latitude),
      longitude: Number(raw.longitude),
      accuracy: null,
      timestamp: Date.now() + index,
      photoPath: typeof raw.imagePath === 'string' ? raw.imagePath : undefined,
    };
  }).filter(place => Number.isFinite(place.latitude) && Number.isFinite(place.longitude)) : [];
  const placesWithImages = await Promise.all(places.map(async place => {
    if (!place.photoPath) return place;
    try { return { ...place, photo: await getRouteImageUrl(place.photoPath) ?? undefined }; }
    catch { return place; }
  }));
  return { ...summary, points, places: placesWithImages };
}

function filterFallback(search: string, difficulty: string) {
  const term = search.trim().toLowerCase();
  return FALLBACK_ROUTES.filter(route =>
    (!difficulty || route.difficulty === difficulty)
    && (!term || `${route.name} ${route.ownerName} ${route.description}`.toLowerCase().includes(term)));
}

function fallbackDetail(route: PublicRouteSummary): PublicRouteDetail {
  const now = Date.now();
  const points = [
    { latitude: -16.5, longitude: -68.18, accuracy: 12, timestamp: now, segment: 0 },
    { latitude: -16.495, longitude: -68.16, accuracy: 10, timestamp: now + 300000, segment: 0 },
    { latitude: -16.488, longitude: -68.14, accuracy: 10, timestamp: now + 600000, segment: 0 },
  ];
  return {
    ...route,
    points,
    places: [
      { id: `${route.id}-start`, name: 'Inicio', description: 'Punto de partida', type: 'otro', services: [], latitude: points[0].latitude, longitude: points[0].longitude, accuracy: 12, timestamp: now },
      { id: `${route.id}-camp`, name: 'Campamento base', description: 'Zona de descanso con vista abierta.', type: 'campamento', services: ['water', 'lodging'], latitude: points[1].latitude, longitude: points[1].longitude, accuracy: 12, timestamp: now + 300000 },
    ],
  };
}
