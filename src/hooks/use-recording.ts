import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as Location from 'expo-location';
import * as Crypto from 'expo-crypto';
import { Recording } from '../lib/recording';
import { saveRecordedRoute } from '../lib/recorded-routes';
import { getSupabase } from '../lib/supabase';

export type RecordedPlace = {
  id: string;
  type: 'campamento' | 'descanso' | 'agua' | 'tienda' | 'otro';
  label: string;
  name: string;
  description: string;
  latitude: number;
  longitude: number;
  services: string[];
};

async function initialPosition() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('No se obtuvo ubicacion en 30 segundos. Revisa el GPS y vuelve a intentar.')), 30000);
      }),
    ]);
  } finally { if (timer) clearTimeout(timer); }
}

export function useRecording() {
  const engine = useRef(new Recording());
  const watcher = useRef<Location.LocationSubscription | null>(null);
  const generation = useRef(0);
  const busyRef = useRef(false);
  const routeIdRef = useRef<string | null>(null);
  const finishedAtRef = useRef<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [places, setPlaces] = useState<RecordedPlace[]>([]);
  const [snapshot, setSnapshot] = useState({
    track: { points: [] as Recording['points'], distance: 0, status: 'idle' as Recording['status'] },
    elapsed: 0,
  });
  const update = (now = Date.now()) => {
    const current = engine.current;
    setSnapshot({
      track: { points: [...current.points], distance: current.distance, status: current.status },
      elapsed: current.elapsed(now),
    });
  };
  const stopWatcher = () => { generation.current++; watcher.current?.remove(); watcher.current = null; };
  const pause = () => { stopWatcher(); engine.current.pause(Date.now()); update(); };
  useEffect(() => {
    const timer = setInterval(() => { if (engine.current.status === 'recording') update(); }, 1000);
    const listener = AppState.addEventListener('change', state => {
      if (state !== 'active' && engine.current.status === 'recording') {
        stopWatcher();
        engine.current.pause(Date.now());
        setError('Grabacion pausada al salir de la app. Pulsa Continuar ruta al volver.');
        update();
      }
    });
    return () => { clearInterval(timer); listener.remove(); stopWatcher(); };
  }, []);
  const begin = async () => {
    if (busyRef.current || engine.current.status === 'recording') return;
    busyRef.current = true; setBusy(true); setError('');
    stopWatcher();
    const token = generation.current;
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) throw new Error('Permite el acceso a tu ubicacion en Ajustes para grabar la ruta.');
      if (!await Location.hasServicesEnabledAsync()) throw new Error('Activa la ubicacion GPS del celular.');
      const first = await initialPosition();
      if (token !== generation.current) return;
      if (first.coords.accuracy === null || first.coords.accuracy > 50) throw new Error('La precision GPS es insuficiente. Sal a un lugar abierto y vuelve a intentar.');
      if (engine.current.status === 'paused') engine.current.resume(Date.now());
      else {
        engine.current = new Recording();
        routeIdRef.current = Crypto.randomUUID();
        finishedAtRef.current = null;
        setPlaces([]);
        engine.current.start(Date.now());
      }
      const add = (location: Location.LocationObject) => {
        if (token !== generation.current) return;
        engine.current.add({ latitude: location.coords.latitude, longitude: location.coords.longitude,
          accuracy: location.coords.accuracy, timestamp: location.timestamp });
        update();
      };
      add(first);
      const subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 3, timeInterval: 2000 }, add,
        message => { if (token === generation.current) { pause(); setError(`GPS interrumpido: ${message}`); } });
      if (token !== generation.current) subscription.remove();
      else watcher.current = subscription;
    } catch (cause) {
      if (token === generation.current) { pause(); setError(cause instanceof Error ? cause.message : 'No se pudo iniciar el GPS.'); }
    } finally { busyRef.current = false; setBusy(false); update(); }
  };
  const finish = async () => {
    if (busyRef.current || engine.current.status === 'idle' || engine.current.status === 'finished') return false;
    busyRef.current = true;
    setBusy(true);
    setError('');
    const stoppedAt = Date.now();
    const finalPointStartsNewSegment = engine.current.status === 'paused';
    stopWatcher();
    engine.current.pause(stoppedAt);
    update(stoppedAt);
    try {
      const final = await initialPosition();
      const accepted = engine.current.finish(stoppedAt, {
        latitude: final.coords.latitude,
        longitude: final.coords.longitude,
        accuracy: final.coords.accuracy,
        timestamp: final.timestamp,
      }, finalPointStartsNewSegment);
      if (!accepted) {
        setError('La ruta terminó usando la última posición válida porque la lectura final no fue confiable.');
      }
    } catch {
      engine.current.finish(stoppedAt);
      setError('La ruta terminó, pero no se pudo obtener una última posición GPS.');
    } finally {
      finishedAtRef.current = stoppedAt;
      busyRef.current = false;
      setBusy(false);
      update(stoppedAt);
    }
    return true;
  };
  const addPlace = (place: Omit<RecordedPlace, 'id' | 'latitude' | 'longitude' | 'services'> & { services?: string[] }) => {
    const position = engine.current.points.at(-1);
    if (!position) {
      setError('Espera una ubicación GPS válida antes de guardar un punto.');
      return false;
    }
    setPlaces(current => [...current, {
      ...place,
      id: Crypto.randomUUID(),
      services: place.services ?? [],
      latitude: position.latitude,
      longitude: position.longitude,
    }]);
    return true;
  };
  const save = async (details: { name: string; description: string; difficulty: string; visibility: 'public' | 'private'; equipment: string[] }) => {
    const { data, error: userError } = await getSupabase().auth.getUser();
    if (userError) throw userError;
    if (!data.user) throw new Error('Inicia sesión para guardar tu ruta.');
    if (!routeIdRef.current || !engine.current.startedAt || !finishedAtRef.current) {
      throw new Error('Finaliza una grabación válida antes de guardar la ruta.');
    }
    return saveRecordedRoute({
      id: routeIdRef.current,
      ownerId: data.user.id,
      status: 'finished',
      ...details,
      started: engine.current.startedAt,
      ended: finishedAtRef.current,
      distance: engine.current.distance,
      elapsed: engine.current.elapsed(finishedAtRef.current),
      pauseCount: engine.current.pauseCount,
      updatedAt: Date.now(),
      points: engine.current.points,
      places,
      equipment: details.equipment,
    });
  };
  return { track: snapshot.track, places, busy, error, begin, pause, finish, addPlace, save, routeId: routeIdRef.current, elapsed: snapshot.elapsed };
}
