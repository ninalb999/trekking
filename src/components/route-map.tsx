import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import WebView from 'react-native-webview';
import { mapDocument, type MapData } from '../lib/map-document';
import { getTile } from '../lib/offline-maps';
import { LoadingState } from './feedback/trekking-animations';
const source = { html: mapDocument };
export default function RouteMap(data: MapData) {
  const webview = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => { if (ready) webview.current?.injectJavaScript(`window.updateRoute(${JSON.stringify(data)});true;`); }, [data, ready]);
  const onMessage = async (event: { nativeEvent: { data: string } }) => {
    const raw = event.nativeEvent.data;
    if (raw === 'ready') { setReady(true); setError(false); return; }
    try {
      const message = JSON.parse(raw) as { type?: string; requestId?: string; regionId?: string; z?: number; x?: number; y?: number };
      if (message.type !== 'REQUEST_TILE' || !message.requestId || !message.regionId || !Number.isInteger(message.z) || !Number.isInteger(message.x) || !Number.isInteger(message.y)) return;
      const tile = await getTile(message.regionId, message.z as number, message.x as number, message.y as number);
      const response = { type: 'TILE_RESPONSE', requestId: message.requestId, dataUri: tile?.dataUri ?? null, error: tile ? undefined : 'Tile no disponible' };
      webview.current?.injectJavaScript(`window.receiveTileResponse(${JSON.stringify(response)});true;`);
    } catch {
      setError(true);
    }
  };
  return <View style={{ height: 342, width: '100%', overflow: 'hidden' }}>
    <WebView key={attempt} ref={webview} source={source} originWhitelist={['*']} javaScriptEnabled nestedScrollEnabled
      style={{ flex: 1, backgroundColor: '#e8f0e5' }}
      onMessage={event => { void onMessage(event); }}
      onError={() => setError(true)} onContentProcessDidTerminate={() => setError(true)} />
    {(!ready || error) && <View style={{ position: 'absolute', top: 12, left: 48, right: 12, backgroundColor: 'white', padding: 12 }}>
      {error ? <Text>No se pudo abrir el mapa.</Text> : <LoadingState compact label="Cargando mapa…" />}
      <Pressable accessibilityRole="button" onPress={() => { setReady(false); setError(false); setAttempt(value => value + 1); }}><Text>Reintentar</Text></Pressable>
    </View>}
  </View>;
}
