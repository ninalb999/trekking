import type { TrackPoint } from './recording';
import type { RouteImageMime } from './route-image-validation';
export type Place = { id: string; name: string; description: string; type: string; services: string[]; latitude: number; longitude: number; accuracy: number | null; timestamp: number };
export type RouteData = {
  id: string; ownerId: string | null; name: string; description: string;
  difficulty: string; visibility: 'private' | 'public'; equipment: string[]; photo?: string; imagePath?: string; photoType?: RouteImageMime;
  started: number; ended?: number; elapsed: number; distance: number; pauseCount: number;
  points: TrackPoint[]; places: Place[]; status: 'recording' | 'paused' | 'finished';
  updatedAt: number; syncedAt?: number;
};
export const emptyRoute: RouteData = { id: '', ownerId: null, name: '', description: '', difficulty: 'Novato', visibility: 'private', equipment: [], started: 0, elapsed: 0, distance: 0, pauseCount: 0, points: [], places: [], status: 'paused', updatedAt: 0 };
export function validateRoute(route: RouteData) {
  if (!route.name.trim()) throw new Error('Escribe el nombre de la ruta.');
  if (!route.points.length) throw new Error('Espera una ubicacion con precision de 150 m o mejor antes de guardar el recorrido.');
  if (route.name.length > 100 || route.description.length > 500) throw new Error('El nombre o la descripcion superan el limite.');
}
