import { useCallback, useEffect, useState } from 'react';

import { getRouteById, getRouteMainImageUrl, type RouteDetail } from '@/lib/route-detail';

export type RouteDetailState =
  | { status: 'invalid-id' }
  | { status: 'loading'; routeId: string }
  | { status: 'unavailable'; routeId: string }
  | { status: 'error'; routeId: string; message: string }
  | { status: 'ready'; routeId: string; detail: RouteDetail; imageUrl: string | null; imageError: boolean };

export function useRouteDetail(routeId: string | null) {
  const [state, setState] = useState<RouteDetailState>(
    routeId ? { status: 'loading', routeId } : { status: 'invalid-id' },
  );
  const [requestVersion, setRequestVersion] = useState(0);

  const retry = useCallback(() => setRequestVersion((version) => version + 1), []);

  useEffect(() => {
    if (!routeId) return;

    let active = true;

    void Promise.resolve().then(async () => {
      if (!active) return;
      setState({ status: 'loading', routeId });

      try {
        const detail = await getRouteById(routeId);
        if (!active) return;
        if (!detail) {
          setState({ status: 'unavailable', routeId });
          return;
        }

        setState({ status: 'ready', routeId, detail, imageUrl: null, imageError: false });

        try {
          const imageUrl = await getRouteMainImageUrl(detail.imagePath);
          if (active) setState({ status: 'ready', routeId, detail, imageUrl, imageError: false });
        } catch {
          if (active) setState({ status: 'ready', routeId, detail, imageUrl: null, imageError: true });
        }
      } catch {
        if (active) {
          setState({
            status: 'error',
            routeId,
            message: 'No se pudo cargar la ruta. Revisa tu conexión e inténtalo de nuevo.',
          });
        }
      }
    });

    return () => {
      active = false;
    };
  }, [requestVersion, routeId]);

  const visibleState = routeId
    ? state.status !== 'invalid-id' && state.routeId === routeId
      ? state
      : { status: 'loading' as const, routeId }
    : { status: 'invalid-id' as const };

  return { state: visibleState, retry };
}
