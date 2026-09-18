import { useEffect, useRef } from 'react';
import { mapDocument, type MapData } from '../lib/map-document';
export default function RouteMap(data: MapData) {
  const frame = useRef<HTMLIFrameElement>(null);
  const latest = useRef(data);
  useEffect(() => { latest.current = data; }, [data]);
  const send = () => frame.current?.contentWindow?.postMessage({ type: 'route', data: latest.current }, '*');
  useEffect(() => {
    const ready = (event: MessageEvent) => { if (event.source === frame.current?.contentWindow && event.data === 'map-ready') send(); };
    window.addEventListener('message', ready); return () => window.removeEventListener('message', ready);
  }, []);
  useEffect(send, [data]);
  return <iframe ref={frame} srcDoc={mapDocument} title="Mapa del recorrido GPS" sandbox="allow-scripts" onLoad={send}
    style={{ height: 342, width: '100%', border: 0, display: 'block' }} />;
}
