import { getSupabase } from './supabase';
import { loadLocalRoutes, saveLocalRoute } from './local-routes';
import type { RouteData } from './route-data';
import { uploadRouteMainImage, uploadRoutePointImage } from './route-images';
import { routeImageExtension } from './route-image-validation';
import type { Json } from '../types/database';
let cloudQueue: Promise<unknown> = Promise.resolve();

export function syncRoute(route: RouteData) {
  const task = cloudQueue.catch(() => {}).then(async () => {
    const supabase = getSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || session.user.id !== route.ownerId) throw new Error('Inicia sesion con la cuenta de esta ruta para sincronizar.');
    const { photo, syncedAt, ...payload } = route;
    const places = route.places.map(({ photo: localPhoto, ...place }) => ({ ...place, ...(place.photoPath ? { photoPath: place.photoPath } : {}) }));
    const payloadWithPlaces = { ...payload, places };
    const { error } = await supabase.rpc('save_recorded_route_v1', { payload: payloadWithPlaces as Json });
    if (error) throw new Error(error.message);
    let imagePath = route.imagePath;
    let syncedPlaces = places;
    for (const [index, place] of route.places.entries()) {
      if (!place.photo || place.photo.startsWith('http') || place.photoPath) continue;
      const contentType = 'image/jpeg';
      const uploaded = await uploadRoutePointImage(route.id, { uri: place.photo, contentType, extension: routeImageExtension(contentType) });
      syncedPlaces = syncedPlaces.map((item, itemIndex) => itemIndex === index ? { ...item, photoPath: uploaded.path } : item);
    }
    if (photo && !imagePath && !photo.startsWith('http')) {
      const contentType = route.photoType ?? 'image/jpeg';
      imagePath = (await uploadRouteMainImage(route.id, { uri: photo, contentType, extension: routeImageExtension(contentType) })).path;
    }
    if (imagePath !== route.imagePath || syncedPlaces.some((place, index) => place.photoPath !== places[index].photoPath)) {
      const saved = await supabase.rpc('save_recorded_route_v1', { payload: { ...payloadWithPlaces, places: syncedPlaces, imagePath } as Json });
      if (saved.error) throw new Error(saved.error.message);
    }
    // Do not overwrite a newer local autosave after a slow network response.
    const current = (await loadLocalRoutes(route.ownerId)).find(item => item.id === route.id);
    if (current && current.updatedAt === route.updatedAt) await saveLocalRoute({ ...current, imagePath, places: current.places.map((place, index) => ({ ...place, photoPath: syncedPlaces[index]?.photoPath ?? place.photoPath })), syncedAt: route.updatedAt });
  });
  cloudQueue = task;
  return task;
}
export async function refreshRoutes(ownerId: string | null): Promise<RouteData[]> {
  const local = await loadLocalRoutes(ownerId);
  if (!ownerId) return local;
  const supabase = getSupabase();
  for (const route of local.filter(item => item.syncedAt !== item.updatedAt && (item.status !== 'finished' || item.name.trim()))) await syncRoute(route);
  const { data, error } = await supabase.from('routes').select('client_snapshot').eq('owner_id', ownerId).not('client_snapshot', 'is', null);
  if (error) throw new Error(error.message);
  const current = await loadLocalRoutes(ownerId);
  for (const row of data ?? []) {
    const route = row.client_snapshot as unknown as RouteData;
    const existing = current.find(item => item.id === route.id);
    if (!existing || route.updatedAt > existing.updatedAt) await saveLocalRoute({ ...route, photo: existing?.photo, syncedAt: route.updatedAt });
  }
  return loadLocalRoutes(ownerId);
}
