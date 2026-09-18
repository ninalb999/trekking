export const ROUTE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

const EXTENSIONS_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const;

export type RouteImageMime = keyof typeof EXTENSIONS_BY_MIME;

export function routeImageMime(value: string | null | undefined, fileName?: string | null): RouteImageMime {
  const normalized = value?.toLowerCase();
  if (normalized && normalized in EXTENSIONS_BY_MIME) return normalized as RouteImageMime;
  const extension = fileName?.split('.').at(-1)?.toLowerCase();
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  throw new Error('Selecciona una imagen JPG, PNG o WebP.');
}

export function routeImageExtension(contentType: RouteImageMime) {
  return EXTENSIONS_BY_MIME[contentType];
}

export function assertRouteImageSize(bytes: number | null | undefined) {
  if (bytes !== null && bytes !== undefined && (!Number.isFinite(bytes) || bytes <= 0)) {
    throw new Error('La fotografía seleccionada está vacía o no se puede leer.');
  }
  if (bytes !== null && bytes !== undefined && bytes > ROUTE_IMAGE_MAX_BYTES) {
    throw new Error('La fotografía debe pesar como máximo 5 MB.');
  }
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
