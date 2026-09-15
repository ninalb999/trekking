'use dom';

import { useEffect, useRef, useState } from 'react';
import type * as Leaflet from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Tables } from '@/types/database';

type TrackCoordinate = Pick<Tables<'route_track_points'>, 'latitude' | 'longitude'> & { segment?: number };
type MarkedRoutePoint = Pick<Tables<'route_points'>, 'latitude' | 'longitude' | 'name' | 'point_type' | 'sequence_no'>;

export default function RouteMap({ points, routePoints = [] }: {
  points: TrackCoordinate[];
  routePoints?: MarkedRoutePoint[];
  dom?: import('expo/dom').DOMProps;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const layer = useRef<Leaflet.LayerGroup | null>(null);
  const library = useRef<typeof Leaflet | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    import('leaflet').then(L => {
      if (cancelled || !container.current) return;
      library.current = L;
      map.current = L.map(container.current).setView([-16.5, -68.15], 12);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).on('tileerror', () => setError('No se pudo cargar el mapa. Revisa tu conexion.')).addTo(map.current);
      layer.current = L.layerGroup().addTo(map.current);
      setReady(true);
    }).catch(() => setError('No se pudo cargar el mapa.'));
    return () => { cancelled = true; map.current?.remove(); map.current = null; };
  }, []);
  useEffect(() => {
    const L = library.current;
    if (!ready || !L || !map.current || !layer.current) return;
    layer.current.clearLayers();
    const segments = new Map<number, Leaflet.LatLngTuple[]>();
    for (const point of points) {
      const segmentNumber = point.segment ?? 0;
      const segment = segments.get(segmentNumber) ?? [];
      segment.push([point.latitude, point.longitude]); segments.set(segmentNumber, segment);
    }
    for (const coordinates of segments.values()) L.polyline(coordinates, { color: '#1f6a43', weight: 5 }).addTo(layer.current);
    const first = points[0], last = points.at(-1);
    if (first) L.circleMarker([first.latitude, first.longitude], { radius: 7, color: '#1f6a43' }).bindTooltip('Inicio').addTo(layer.current);
    if (last) {
      L.circleMarker([last.latitude, last.longitude], { radius: 7, color: '#2675ef' }).bindTooltip('Final').addTo(layer.current);
    }
    for (const point of routePoints) {
      L.circleMarker([point.latitude, point.longitude], { radius: 6, color: '#e58a15', fillOpacity: 1 })
        .bindTooltip(point.name || point.point_type)
        .addTo(layer.current);
    }
    if (points.length) {
      map.current.fitBounds(points.map(point => [point.latitude, point.longitude] as Leaflet.LatLngTuple), { padding: [24, 24], maxZoom: 16 });
    }
    map.current.invalidateSize();
  }, [points, ready, routePoints]);
  return <div style={{ position: 'relative', height: 342, width: '100%' }}>
    <div ref={container} aria-label="Mapa del recorrido GPS" style={{ height: '100%', width: '100%' }} />
    {error && <div role="status" style={{ position: 'absolute', top: 0, left: 40, right: 0, zIndex: 1000, background: 'white', padding: 8 }}>{error}</div>}
  </div>;
}
