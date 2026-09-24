import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RouteData } from './route-data';
const prefix = 'trekking:route:v1:';
const offlinePrefix = 'trekking:offline-route:v1:';
let queue: Promise<unknown> = Promise.resolve();
export function saveLocalRoute(route: RouteData) {
  const value = JSON.stringify(route);
  const operation = queue.catch(() => {}).then(() => AsyncStorage.setItem(prefix + route.id, value));
  queue = operation;
  return operation;
}
export async function loadLocalRoutes(ownerId: string | null): Promise<RouteData[]> {
  await queue.catch(() => {});
  const keys = (await AsyncStorage.getAllKeys()).filter(key => key.startsWith(prefix));
  const entries = await AsyncStorage.multiGet(keys);
  return entries.flatMap(([, value]) => {
    if (!value) return [];
    const data = JSON.parse(value) as RouteData;
    return data.ownerId === ownerId ? [data] : [];
  }).sort((a, b) => b.updatedAt - a.updatedAt);
}

// Separate snapshots: removing a download must not remove an autosave or affect sync.
export function saveOfflineRoute(route: RouteData) {
  const value = JSON.stringify(route);
  const operation = queue.catch(() => {}).then(() => AsyncStorage.setItem(offlinePrefix + route.id, value));
  queue = operation;
  return operation;
}
export function removeOfflineRoute(id: string) {
  const operation = queue.catch(() => {}).then(() => AsyncStorage.removeItem(offlinePrefix + id));
  queue = operation;
  return operation;
}
export async function loadOfflineRoutes(ownerId: string | null): Promise<RouteData[]> {
  await queue.catch(() => {});
  const keys = (await AsyncStorage.getAllKeys()).filter(key => key.startsWith(offlinePrefix));
  const entries = await AsyncStorage.multiGet(keys);
  return entries.flatMap(([, value]) => {
    if (!value) return [];
    const route = JSON.parse(value) as RouteData;
    return route.ownerId === ownerId ? [route] : [];
  }).sort((a, b) => b.updatedAt - a.updatedAt);
}
