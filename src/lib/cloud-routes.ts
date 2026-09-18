import { getSupabase } from './supabase';
import { loadLocalRoutes, saveLocalRoute } from './local-routes';
import type { RouteData } from './route-data';
import { uploadRouteMainImage } from './route-images';
import { routeImageExtension } from './route-image-validation';
import type { Json } from '../types/database';
let cloudQueue: Promise<unknown> = Promise.resolve();

export function syncRoute(route: RouteData) {
  const task = cloudQueue.catch(() => {}).then(async () => {
    const supabase = getSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || session.user.id !== route.ownerId) throw new Error('Inicia sesion con la cuenta de esta ruta para sincronizar.');
    const { photo, syncedAt, ...payload } = route;
    const { error } = await supabase.rpc('save_recorded_route_v1', { payload: payload as Json });
    if (error) throw new Error(error.message);
    let imagePath = route.imagePath;
    if (photo && !imagePath && !photo.startsWith('http')) {
      const contentType = route.photoType ?? 'image/jpeg';
      imagePath = (await uploadRouteMainImage(route.id, { uri: photo, contentType, extension: routeImageExtension(contentType) })).path;
      const saved = await supabase.rpc('save_recorded_route_v1', { payload: { ...payload, imagePath } as Json });
      if (saved.error) throw new Error(saved.error.message);
    }
    // Do not overwrite a newer local autosave after a slow network response.
    const current = (await loadLocalRoutes(route.ownerId)).find(item => item.id === route.id);
    if (current && current.updatedAt === route.updatedAt) await saveLocalRoute({ ...current, imagePath, syncedAt: route.updatedAt });
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
