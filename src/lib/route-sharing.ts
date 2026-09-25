const APP_SCHEME = 'trekkingapp';

function configuredWebBase() {
  const value = process.env.EXPO_PUBLIC_APP_URL?.trim();
  return value ? value.replace(/\/+$/, '') : null;
}

/**
 * Builds a stable route link without using Expo Go's temporary exp:// URL.
 * HTTPS is preferred when the web deployment is configured; otherwise the
 * native app scheme remains useful after installing a development/production build.
 */
export function getRouteShareUrl(routeId: string, visibility: string = 'public') {
  if (visibility !== 'public' || !routeId.trim()) return null;
  const encodedId = encodeURIComponent(routeId.trim());
  const webBase = configuredWebBase();
  return webBase ? `${webBase}/rutas/${encodedId}` : `${APP_SCHEME}://rutas/${encodedId}`;
}

export function getRouteShareLinkLabel(url: string) {
  return url.startsWith('http') ? 'Ver ruta en línea' : 'Abrir ruta en la app';
}
