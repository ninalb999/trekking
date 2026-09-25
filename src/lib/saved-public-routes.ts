import type { PublicRouteDetail } from './public-routes';
import type { RouteData } from './route-data';

/** Converts a public route snapshot into the existing local-download model. */
export function toSavedPublicRoute(detail: PublicRouteDetail, ownerId: string, now = Date.now()): RouteData {
  const publishedAt = detail.publishedAt ? Date.parse(detail.publishedAt) : Number.NaN;
  return {
    id: detail.id,
    ownerId,
    name: detail.name,
    description: detail.description,
    difficulty: detail.difficulty,
    visibility: 'public',
    equipment: detail.equipment,
    started: Number.isFinite(publishedAt) ? publishedAt : now,
    elapsed: detail.durationSeconds * 1000,
    distance: detail.distanceMeters,
    pauseCount: detail.pauseCount,
    points: detail.points,
    // Remote photos are URLs/storage paths and are intentionally not claimed to be offline files.
    places: detail.places.map(({ photo, photoPath, ...place }) => place),
    status: 'finished',
    updatedAt: now,
  };
}
