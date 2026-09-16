import type { TrackPoint } from './recording';
export type Place = { id: string; name: string; description: string; type: string; services: string[]; latitude: number; longitude: number; accuracy: number | null; timestamp: number };
export type RouteData = {
  id: string; ownerId: string | null; name: string; description: string;
  difficulty: string; visibility: 'private' | 'public'; equipment: string[]; photo?: string; imagePath?: string;
  started: number; ended?: number; elapsed: number; distance: number; pauseCount: number;
  points: TrackPoint[]; places: Place[]; status: 'recording' | 'paused' | 'finished';
  updatedAt: number; syncedAt?: number;
};
export function validateRoute(route: RouteData) {
  if (!route.name.trim()) throw new Error('Escribe el nombre de la ruta.');
  if (!route.points.length) throw new Error('Espera una ubicacion con precision de 150 m o mejor antes de guardar el recorrido.');
  if (route.name.length > 100 || route.description.length > 500) throw new Error('El nombre o la descripcion superan el limite.');
}
