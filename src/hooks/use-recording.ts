import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import * as Location from 'expo-location';
import { randomUUID } from 'expo-crypto';
import { Recording, type TrackPoint } from '../lib/recording';
import { loadLocalRoutes, saveLocalRoute } from '../lib/local-routes';
import { syncRoute } from '../lib/cloud-routes';
import { emptyRoute, validateRoute, type Place, type RouteData } from '../lib/route-data';

async function finalPosition(): Promise<Omit<TrackPoint, 'segment'>> {
  const read = Platform.OS === 'web'
    ? new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, maximumAge: 0, timeout: 8000 }))
    : Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.BestForNavigation });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([read, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('GPS no disponible')), 8500); })]);
    return { latitude: result.coords.latitude, longitude: result.coords.longitude, accuracy: result.coords.accuracy, timestamp: result.timestamp };
  } finally { clearTimeout(timer); }
}

export function useRecording(ownerId: string | null) {
  const engine = useRef(new Recording());
  const meta = useRef<Partial<RouteData>>({});
  const watcher = useRef<(() => void) | null>(null);
  const generation = useRef(0), busyRef = useRef(false), cloudBusy = useRef(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [saveStatus, setSaveStatus] = useState('');
  const [location, setLocation] = useState<Omit<TrackPoint, 'segment'> | null>(null);
  const [view, setView] = useState({ track: { points: [] as TrackPoint[], distance: 0, status: 'idle' as Recording['status'] }, data: emptyRoute, now: 0 });
  const stop = useCallback(() => { generation.current++; watcher.current?.(); watcher.current = null; }, []);
  const snapshot = useCallback((): RouteData => ({
    id: engine.current.id, ownerId: meta.current.ownerId ?? null, name: meta.current.name ?? '', description: meta.current.description ?? '',
    difficulty: meta.current.difficulty ?? 'Novato', visibility: meta.current.visibility ?? 'private', equipment: meta.current.equipment ?? [],
    photo: meta.current.photo, photoType: meta.current.photoType, imagePath: meta.current.imagePath, started: engine.current.started, ended: meta.current.ended,
    elapsed: engine.current.elapsed(Date.now()), distance: engine.current.distance, pauseCount: engine.current.pauseCount,
    points: [...engine.current.points], places: [...(meta.current.places ?? [])],
    status: engine.current.status === 'idle' ? 'paused' : engine.current.status, updatedAt: Date.now(),
  }), []);
  const update = useCallback(() => setView({ track: { points: [...engine.current.points], distance: engine.current.distance, status: engine.current.status }, data: snapshot(), now: Date.now() }), [snapshot]);
  const persist = async (cloud = false) => {
    if (!engine.current.id) return;
    const data = snapshot();
    await saveLocalRoute(data);
    setSaveStatus('Copia local guardada');
    if (cloud && data.ownerId && !cloudBusy.current && (data.status !== 'finished' || data.name.trim())) {
      cloudBusy.current = true;
      void syncRoute(data).then(() => setSaveStatus('Guardado local y en Supabase'))
        .catch(() => setSaveStatus('Guardado local. Sincronizacion pendiente.'))
        .finally(() => { cloudBusy.current = false; });
    } else if (!data.ownerId) setSaveStatus('Guardado local. Inicia sesion para sincronizar.');
  };
  const autosave = (cloud = false) => void persist(cloud).catch(() => setSaveStatus('No se pudo guardar la copia local. Revisa el espacio disponible.'));
  const pause = () => { stop(); engine.current.pause(Date.now()); autosave(true); update(); };
  const restore = useCallback((data: RouteData) => {
    stop(); engine.current = new Recording(); engine.current.restore(data); meta.current = data;
    setLocation(data.points.at(-1) ?? null); setError(''); update();
  }, [stop, update]);
  useEffect(() => {
    let alive = true;
    stop(); engine.current = new Recording(); meta.current = {};
    loadLocalRoutes(ownerId).then(routes => {
      if (!alive) return;
      setLocation(null); update();
      const draft = routes.find(route => route.status !== 'finished');
      if (alive && draft && engine.current.status === 'idle') restore(draft);
    }).catch(() => setError('No se pudo recuperar el recorrido local.'));
    return () => { alive = false; stop(); };
  }, [ownerId, stop, restore, update]);
  // Refs keep timer and app-state handlers on the current route without restarting GPS.
  const persistRef = useRef(autosave);
  const pauseRef = useRef(pause);
  useEffect(() => { persistRef.current = autosave; pauseRef.current = pause; });
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
  }, [stop, update]);
  const begin = async () => {
    if (busyRef.current || engine.current.status === 'recording') return;
    busyRef.current = true; setBusy(true); setError(''); stop();
    const token = generation.current;
    try {
      if (Platform.OS !== 'web') {
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
        if (token !== generation.current || !Number.isFinite(position.timestamp) || Date.now() - position.timestamp > 30000 || position.timestamp > Date.now() + 5000 ||
          !Number.isFinite(position.coords.latitude) || Math.abs(position.coords.latitude) > 90 || !Number.isFinite(position.coords.longitude) || Math.abs(position.coords.longitude) > 180) return;
        const next = { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy, timestamp: position.timestamp };
        setLocation(next); engine.current.add(next); setError(''); update();
      };
      const failed = (cause: unknown) => {
        if (token !== generation.current) return;
        const message = cause && typeof cause === 'object' && 'message' in cause
          ? String((cause as { message?: unknown }).message)
          : typeof cause === 'string' ? cause : 'No se pudo recibir la ubicacion del dispositivo.';
        pause(); setError(message);
      };
      if (Platform.OS === 'web') {
        const id = navigator.geolocation.watchPosition(add, err => {
          if (err.code === 1) failed('Acceso bloqueado. Permite Ubicacion en los ajustes del sitio.');
          else if (token === generation.current) setError('Buscando senal GPS. Se conserva el recorrido.');
        }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
        watcher.current = () => navigator.geolocation.clearWatch(id);
      } else {
        const subscription = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, distanceInterval: 0, timeInterval: 1000, mayShowUserSettingsDialog: true }, add, failed);
        if (token !== generation.current) subscription.remove(); else watcher.current = () => subscription.remove();
        void Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High, mayShowUserSettingsDialog: true })
          .then(position => { if (token === generation.current) add(position); })
          .catch(() => { if (token === generation.current && !engine.current.points.length) setError('Buscando senal GPS. Mueve el telefono a un lugar abierto.'); });
      }
      autosave(true);
    } catch (cause) {
      if (token === generation.current) { stop(); engine.current.pause(Date.now()); setError(cause instanceof Error ? cause.message : 'No se pudo iniciar el GPS.'); }
    } finally { busyRef.current = false; setBusy(false); update(); }
  };
  const finish = async () => {
    if (busyRef.current || engine.current.status === 'idle' || engine.current.status === 'finished') return false;
    busyRef.current = true; setBusy(true); setError('');
    const stoppedAt = Date.now(), paused = engine.current.status === 'paused', pauses = engine.current.pauseCount;
    stop(); const token = generation.current;
    engine.current.pause(stoppedAt); engine.current.pauseCount = pauses; update();
    try {
      // A fresh watcher reading already represents the endpoint; no extra GPS wait is needed.
      const final = location && stoppedAt - location.timestamp < 5000 ? location : await finalPosition();
      if (token !== generation.current) return false;
      engine.current.finish(stoppedAt, final, paused);
    } catch {
      if (token !== generation.current) return false;
      engine.current.finish(stoppedAt);
      setError('Recorrido finalizado con la ultima ubicacion valida.');
    } finally { busyRef.current = false; setBusy(false); update(); }
    meta.current.ended = stoppedAt;
    try { await persist(); } catch { setError('No se pudo guardar la copia local. Reintenta guardar la ruta.'); }
    update(); return true;
  };
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
  const age = view.now - (location?.timestamp ?? view.data.started);
  const quality = !location ? (age > 15000 ? 'Sin senal GPS. Buscando ubicacion...' : 'Buscando ubicacion...') :
    age > 15000 ? 'Senal GPS perdida. Distancia detenida.' : location.accuracy === null ? 'Precision desconocida. Distancia detenida.' :
    location.accuracy > 150 ? `Ubicacion aproximada (+/-${Math.round(location.accuracy)} m). Esperando mejor senal para trazar.` :
    location.accuracy > 50 ? `Precision baja (+/-${Math.round(location.accuracy)} m). Recorrido aproximado.` : `Precision GPS: +/-${Math.round(location.accuracy)} m`;
  return { track: view.track, busy, error, begin, pause, finish, elapsed: view.data.elapsed, location, quality, saveStatus,
    data: view.data, places: view.data.places, addPlace, save, restore };
}
