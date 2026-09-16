import { supabase } from './supabase';
import { loadLocalRoutes, saveLocalRoute } from './local-routes';
import type { RouteData } from './route-data';
import { File } from 'expo-file-system';
let cloudQueue: Promise<unknown> = Promise.resolve();

export function syncRoute(route: RouteData) {
  const task = cloudQueue.catch(() => {}).then(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || session.user.id !== route.ownerId) throw new Error('Inicia sesion con la cuenta de esta ruta para sincronizar.');
    const { photo, syncedAt, ...payload } = route;
    const { error } = await supabase.rpc('save_recorded_route_v1', { payload });
    if (error) throw new Error(error.message);
    let imagePath = route.imagePath;
    if (photo && !imagePath && !photo.startsWith('http')) {
      imagePath = `${route.id}/${route.id}.jpg`;
      const bytes = process.env.EXPO_OS === 'web' ? await (await fetch(photo)).arrayBuffer() : await new File(photo).arrayBuffer();
      const uploaded = await supabase.storage.from('route-images').upload(imagePath, bytes, { contentType: 'image/jpeg', upsert: true });
      if (uploaded.error) throw new Error(uploaded.error.message);
      const saved = await supabase.rpc('save_recorded_route_v1', { payload: { ...payload, imagePath } });
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
  for (const route of local.filter(item => item.syncedAt !== item.updatedAt && (item.status !== 'finished' || item.name.trim()))) await syncRoute(route);
  const { data, error } = await supabase.from('routes').select('client_snapshot').eq('owner_id', ownerId).not('client_snapshot', 'is', null);
  if (error) throw new Error(error.message);
  const current = await loadLocalRoutes(ownerId);
  for (const row of data ?? []) {
    const route = row.client_snapshot as RouteData;
    const existing = current.find(item => item.id === route.id);
    if (!existing || route.updatedAt > existing.updatedAt) await saveLocalRoute({ ...route, syncedAt: route.updatedAt });
  }
  return loadLocalRoutes(ownerId);
}
