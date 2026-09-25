import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import RouteMap from '@/components/route-map';
import { LoadingState } from '@/components/feedback/trekking-animations';
import { getRouteMapData, type RouteMapData } from '@/lib/routes';

const EMPTY_MAP: RouteMapData = { trackPoints: [], routePoints: [] };

type MapState = { routeId: string; data?: RouteMapData; error?: string };

export function RouteDetailMap({ routeId }: { routeId: string }) {
  const [state, setState] = useState<MapState>({ routeId });

  useEffect(() => {
    let active = true;
    getRouteMapData(routeId)
      .then(data => { if (active) setState({ routeId, data }); })
      .catch(() => { if (active) setState({ routeId, error: 'No se pudo cargar el recorrido de esta ruta.' }); });
    return () => { active = false; };
  }, [routeId]);

  const loading = state.routeId !== routeId || (!state.data && !state.error);
  const mapData = state.routeId === routeId ? state.data ?? EMPTY_MAP : EMPTY_MAP;
  const error = state.routeId === routeId ? state.error : undefined;
  if (loading) return <LoadingState label="Cargando mapa…" />;
  if (error) return <View style={{ minHeight: 160, justifyContent: 'center' }}><Text accessibilityRole="alert">{error}</Text></View>;
  if (!mapData.trackPoints.length) return <View style={{ minHeight: 160, justifyContent: 'center' }}><Text>Esta ruta todavía no tiene coordenadas.</Text></View>;

  return (
    <RouteMap
      points={mapData.trackPoints.map(point => ({ latitude: point.latitude, longitude: point.longitude, accuracy: point.accuracy_m, timestamp: Date.parse(point.recorded_at), segment: point.segment_no }))}
      places={mapData.routePoints.map(point => ({
        ...point,
        name: point.name ?? point.point_type,
        description: point.description ?? undefined,
        type: point.point_type,
      }))}
      overview
    />
  );
}
