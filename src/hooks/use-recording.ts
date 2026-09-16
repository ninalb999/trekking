import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as Location from 'expo-location';
import { randomUUID } from 'expo-crypto';
import { Recording, type TrackPoint } from '../lib/recording';
import { loadLocalRoutes, saveLocalRoute } from '../lib/local-routes';
import { syncRoute } from '../lib/cloud-routes';
import { validateRoute, type Place, type RouteData } from '../lib/route-data';

export function useRecording(ownerId: string | null) {
  const engine = useRef(new Recording());
  const meta = useRef<Partial<RouteData>>({});
  const watcher = useRef<(() => void) | null>(null);
  const generation = useRef(0), busyRef = useRef(false), cloudBusy = useRef(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [saveStatus, setSaveStatus] = useState('');
  const [location, setLocation] = useState<Omit<TrackPoint, 'segment'> | null>(null);
  const [, render] = useState(0);
  const update = () => render(value => value + 1);
  const stop = () => { generation.current++; watcher.current?.(); watcher.current = null; };
  const snapshot = (): RouteData => ({
    id: engine.current.id, ownerId: meta.current.ownerId ?? null, name: meta.current.name ?? '', description: meta.current.description ?? '',
    difficulty: meta.current.difficulty ?? 'Novato', visibility: meta.current.visibility ?? 'private', equipment: meta.current.equipment ?? [],
    photo: meta.current.photo, imagePath: meta.current.imagePath, started: engine.current.started, ended: meta.current.ended,
    elapsed: engine.current.elapsed(Date.now()), distance: engine.current.distance, pauseCount: engine.current.pauseCount,
    points: [...engine.current.points], places: [...(meta.current.places ?? [])],
    status: engine.current.status === 'idle' ? 'paused' : engine.current.status, updatedAt: Date.now(),
  });
  const persist = async (cloud = false) => {
    if (!engine.current.id) return;
    const data = snapshot();
    await saveLocalRoute(data);
    setSaveStatus('Copia local guardada');
    if (cloud && data.ownerId && !cloudBusy.current && (data.status !== 'finished' || data.name.trim())) {
      cloudBusy.current = true;
      try { await syncRoute(data); setSaveStatus('Guardado local y en Supabase'); }
      catch { setSaveStatus('Guardado local. Sincronizacion pendiente.'); }
      finally { cloudBusy.current = false; }
    } else if (!data.ownerId) setSaveStatus('Guardado local. Inicia sesion para sincronizar.');
  };
  const autosave = (cloud = false) => void persist(cloud).catch(() => setSaveStatus('No se pudo guardar la copia local. Revisa el espacio disponible.'));
  const pause = () => { stop(); engine.current.pause(Date.now()); autosave(true); update(); };
  const restore = (data: RouteData) => {
    stop(); engine.current = new Recording(); engine.current.restore(data); meta.current = data;
    setLocation(data.points.at(-1) ?? null); setError(''); update();
  };
  useEffect(() => {
    let alive = true;
    stop(); engine.current = new Recording(); meta.current = {}; setLocation(null); update();
    loadLocalRoutes(ownerId).then(routes => {
      const draft = routes.find(route => route.status !== 'finished');
      if (alive && draft && engine.current.status === 'idle') restore(draft);
    }).catch(() => setError('No se pudo recuperar el recorrido local.'));
    return () => { alive = false; stop(); };
  }, [ownerId]);
  // Refs keep timer and app-state handlers on the current route without restarting GPS.
  const persistRef = useRef(autosave); persistRef.current = autosave;
  const pauseRef = useRef(pause); pauseRef.current = pause;
  useEffect(() => {
    let ticks = 0;
    const timer = setInterval(() => {
      if (engine.current.status === 'recording') { update(); ticks++; if (ticks % 5 === 0) persistRef.current(ticks % 30 === 0); }
    }, 1000);
    const listener = AppState.addEventListener('change', state => {
      if (state !== 'active' && engine.current.status === 'recording') {
        pauseRef.current(); setError('Ruta pausada al salir de la app. Pulsa Continuar ruta.');
      }
    });
    return () => { clearInterval(timer); listener.remove(); stop(); };
  }, []);
  const begin = async () => {
    if (busyRef.current || engine.current.status === 'recording') return;
    busyRef.current = true; setBusy(true); setError(''); stop();
    const token = generation.current;
    try {
      if (process.env.EXPO_OS !== 'web') {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!permission.granted) throw new Error('Permite la ubicacion precisa en Ajustes para grabar.');
        if (!await Location.hasServicesEnabledAsync()) throw new Error('Activa la ubicacion GPS del celular.');
      } else if (!globalThis.isSecureContext || !navigator.geolocation) {
        throw new Error('La ubicacion necesita localhost o una conexion HTTPS.');
      }
      if (token !== generation.current) return;
      if (engine.current.status === 'paused') engine.current.resume(Date.now());
      else {
        engine.current = new Recording(); engine.current.id = randomUUID();
        engine.current.start(Date.now()); meta.current = { ownerId, places: [] }; setLocation(null);
      }
      const add = (position: { coords: { latitude: number; longitude: number; accuracy: number | null }; timestamp: number }) => {
        if (token !== generation.current || Date.now() - position.timestamp > 30000) return;
        const next = { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy, timestamp: position.timestamp };
        setLocation(next); engine.current.add(next); setError(''); update();
      };
      const failed = (message: string) => { if (token === generation.current) { pause(); setError(message); } };
      if (process.env.EXPO_OS === 'web') {
        const id = navigator.geolocation.watchPosition(add, err => {
          if (err.code === 1) failed('Acceso bloqueado. Permite Ubicacion en los ajustes del sitio.');
          else if (token === generation.current) setError('Buscando senal GPS. Se conserva el recorrido.');
        }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
        watcher.current = () => navigator.geolocation.clearWatch(id);
      } else {
        const subscription = await Location.watchPositionAsync({ accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 0, timeInterval: 1000, mayShowUserSettingsDialog: true }, add, failed);
        if (token !== generation.current) subscription.remove(); else watcher.current = () => subscription.remove();
      }
      autosave(true);
    } catch (cause) {
      if (token === generation.current) { stop(); engine.current.pause(Date.now()); setError(cause instanceof Error ? cause.message : 'No se pudo iniciar el GPS.'); }
    } finally { busyRef.current = false; setBusy(false); update(); }
  };
  const finish = () => { stop(); engine.current.finish(Date.now()); meta.current.ended = Date.now(); autosave(); update(); };
  const addPlace = async (place: Omit<Place, 'id' | 'latitude' | 'longitude' | 'accuracy' | 'timestamp'>) => {
    if (!place.name.trim()) throw new Error('Escribe el nombre del punto.');
    if (!location || Date.now() - location.timestamp > 120000) throw new Error('No hay ubicacion reciente. Vuelve a Grabar y espera la senal.');
    if (location.accuracy === null || location.accuracy > 150) throw new Error('Espera una precision de 150 m o mejor para ubicar este punto.');
    meta.current.places = [...(meta.current.places ?? []), { ...place, ...location, id: randomUUID() }];
    await persist(true); update();
  };
  const save = async (values: Partial<RouteData>) => {
    const next = { ...snapshot(), ...values, ownerId: meta.current.ownerId ?? ownerId };
    validateRoute(next); meta.current = { ...meta.current, ...values, ownerId: next.ownerId };
    await persist(true);
  };
  const age = location ? Date.now() - location.timestamp : Date.now() - engine.current.started;
  const quality = !location ? (age > 15000 ? 'Sin senal GPS. Buscando ubicacion...' : 'Buscando ubicacion...') :
    age > 15000 ? 'Senal GPS perdida. Distancia detenida.' : location.accuracy === null ? 'Precision desconocida. Distancia detenida.' :
    location.accuracy > 150 ? `Ubicacion aproximada (+/-${Math.round(location.accuracy)} m). Esperando mejor senal para trazar.` :
    location.accuracy > 50 ? `Precision baja (+/-${Math.round(location.accuracy)} m). Recorrido aproximado.` : `Precision GPS: +/-${Math.round(location.accuracy)} m`;
  return { track: engine.current, busy, error, begin, pause, finish, elapsed: engine.current.elapsed(Date.now()), location, quality, saveStatus,
    places: meta.current.places ?? [], snapshot, addPlace, save, restore };
}
