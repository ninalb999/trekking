import type { TrackPoint } from './recording';

export type LocationReading = Omit<TrackPoint, 'segment'>;

type Position = {
  coords: { latitude: number; longitude: number; accuracy: number | null };
  timestamp: number;
};

/** Reject stale or invalid coordinates while allowing approximate locations on the map. */
export function normalizeLocation(position: Position, now = Date.now()): LocationReading | null {
  const { latitude, longitude, accuracy } = position.coords;
  if (!Number.isFinite(position.timestamp) || now - position.timestamp > 30000 || position.timestamp > now + 5000 ||
    !Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude) || Math.abs(longitude) > 180) return null;

  return {
    latitude,
    longitude,
    accuracy: accuracy !== null && Number.isFinite(accuracy) && accuracy >= 0 ? accuracy : null,
    timestamp: position.timestamp,
  };
}

export function locationErrorMessage(cause: unknown, web: boolean): string {
  if (web && cause && typeof cause === 'object' && 'code' in cause) {
    const code = (cause as { code?: unknown }).code;
    if (code === 1) return 'Ubicación bloqueada. Permite el acceso en el navegador y en los ajustes de ubicación del dispositivo.';
    if (code === 2) return 'No se pudo obtener la ubicación. Comprueba los servicios de ubicación de tu computadora o celular.';
    if (code === 3) return 'La ubicación tardó demasiado. Revisa los permisos e inténtalo de nuevo.';
  }
  if (cause instanceof Error && cause.message) return cause.message;
  if (typeof cause === 'string' && cause) return cause;
  return 'No se pudo recibir la ubicación del dispositivo.';
}
