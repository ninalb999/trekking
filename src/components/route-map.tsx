import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import WebView from 'react-native-webview';
import { mapDocument, type MapData } from '../lib/map-document';
const source = { html: mapDocument };
export default function RouteMap(data: MapData) {
  const webview = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => { if (ready) webview.current?.injectJavaScript(`window.updateRoute(${JSON.stringify(data)});true;`); }, [data, ready]);
  return <View style={{ height: 342, width: '100%', overflow: 'hidden' }}>
    <WebView key={attempt} ref={webview} source={source} originWhitelist={['*']} javaScriptEnabled nestedScrollEnabled
      style={{ flex: 1, backgroundColor: '#e8f0e5' }}
      onMessage={event => { if (event.nativeEvent.data === 'ready') { setReady(true); setError(false); } }}
      onError={() => setError(true)} onContentProcessDidTerminate={() => setError(true)} />
    {(!ready || error) && <View style={{ position: 'absolute', top: 12, left: 48, right: 12, backgroundColor: 'white', padding: 12 }}>
      <Text>{error ? 'No se pudo abrir el mapa.' : 'Cargando mapa...'}</Text>
      <Pressable accessibilityRole="button" onPress={() => { setReady(false); setError(false); setAttempt(value => value + 1); }}><Text>Reintentar</Text></Pressable>
    </View>}
  </View>;
}
