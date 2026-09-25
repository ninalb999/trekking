import { useEffect, useRef, useState } from 'react';
import { Text, View, Pressable, Share } from 'react-native';
import { Image } from 'expo-image';
import { pickRouteImage } from '../lib/route-images';
import { useRecording } from '../hooks/use-recording';
import { formatElapsed } from '../lib/recording';
import type { RouteData } from '../lib/route-data';
import { loadLocalRoutes, loadOfflineRoutes, saveOfflineRoute, removeOfflineRoute } from '../lib/local-routes';
import { refreshRoutes } from '../lib/cloud-routes';
import { Action, Choices, Input, ui } from './route-controls';
import RouteMap from './route-map';
import { LoadingState } from './feedback/trekking-animations';
import { getRouteShareLinkLabel, getRouteShareUrl } from '../lib/route-sharing';

type Recorder = ReturnType<typeof useRecording>;
const types: Record<string, string> = { Campamento: 'campamento', Descanso: 'descanso', Agua: 'agua', Tienda: 'tienda', Otro: 'otro' };
const services: Record<string, string> = { Agua: 'water', Senal: 'signal', Alojamiento: 'lodging', Tienda: 'shop' };
const toggle = (items: string[], value: string) => items.includes(value) ? items.filter(item => item !== value) : [...items, value];

export function PointForm({ recording, back }: { recording: Recorder; back: () => void }) {
  const [name, setName] = useState(''), [description, setDescription] = useState(''), [type, setType] = useState('Campamento');
  const [photo, setPhoto] = useState('');
  const [selected, setSelected] = useState<string[]>([]), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const saving = useRef(false);
  async function choosePhoto() {
    try {
      const result = await pickRouteImage();
      if (result) setPhoto(result.uri);
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cargar la foto del punto.'); }
  }
  async function save() {
    if (saving.current) return; saving.current = true; setBusy(true);
    try { await recording.addPlace({ name: name.trim(), description: description.trim(), type: types[type], services: selected.map(value => services[value]), photo }); back(); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar el punto.'); }
    finally { saving.current = false; setBusy(false); }
  }
  return <View style={ui.content}>
    <Text style={ui.title}>Agregar punto</Text><Text style={ui.muted}>Ruta en pausa · {formatElapsed(recording.elapsed)}</Text>
    <Text style={ui.label}>Tipo de punto</Text><Choices values={Object.keys(types)} selected={[type]} onSelect={setType} />
    <Input label="Nombre del punto" value={name} onChangeText={setName} maxLength={100} placeholder="Ej. Mirador del valle" />
    <Input label="Descripcion del punto" value={description} onChangeText={setDescription} multiline maxLength={200} />
    {photo && <Image source={photo} style={{ width: '100%', height: 128, borderRadius: 18 }} contentFit="cover" />}
    <Action label={photo ? 'Cambiar foto del punto' : 'Agregar foto del punto'} disabled={busy} onPress={() => void choosePhoto()} />
    <Text style={ui.label}>Servicios disponibles</Text><Choices values={Object.keys(services)} selected={selected} onSelect={value => setSelected(toggle(selected, value))} multiple />
    <Text style={ui.muted}>{recording.location ? `${recording.location.latitude.toFixed(6)}, ${recording.location.longitude.toFixed(6)}` : 'Sin ubicacion'}</Text>
    {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
    <Action label={busy ? 'Guardando punto...' : 'Guardar punto'} loading={busy} onPress={() => void save()} />
    <Action label="Continuar sin agregar" disabled={busy} onPress={back} />
  </View>;
}

export function FinishForm({ recording, done }: { recording: Recorder; done: () => void }) {
  const data = recording.data;
  const [name, setName] = useState(data.name), [description, setDescription] = useState(data.description);
  const [difficulty, setDifficulty] = useState(data.difficulty), [visibility, setVisibility] = useState(data.visibility);
  const [equipment, setEquipment] = useState(data.equipment), [photo, setPhoto] = useState(data.photo);
  const [photoType, setPhotoType] = useState(data.photoType);
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [saved, setSaved] = useState(false), [shareError, setShareError] = useState('');
  const saving = useRef(false);
  async function choosePhoto() {
    try {
      const result = await pickRouteImage();
      if (result) { setPhoto(result.uri); setPhotoType(result.contentType); }
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cargar la fotografia.'); }
  }
  async function save() {
    if (saving.current) return; saving.current = true; setBusy(true); setError('');
    try { await recording.save({ name: name.trim(), description: description.trim(), difficulty, visibility, equipment, photo, photoType, imagePath: photo !== data.photo ? undefined : data.imagePath }); setSaved(true); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar.'); }
    finally { saving.current = false; setBusy(false); }
  }
  async function shareRoute() {
    setShareError('');
    try {
      const routeUrl = getRouteShareUrl(data.id, visibility === 'public' ? 'public' : 'private');
      await Share.share({ message: [
        `Ruta: ${name.trim() || 'Ruta de Trekking'}`,
        `Distancia: ${(data.distance / 1000).toFixed(2)} km`,
        `Duración: ${formatElapsed(data.elapsed)}`,
        `Dificultad: ${difficulty}`,
        ...(description.trim() ? [`Descripción: ${description.trim()}`] : []),
        ...(routeUrl ? [`${getRouteShareLinkLabel(routeUrl)}: ${routeUrl}`] : []),
      ].join('\n') });
    } catch { setShareError('No se pudo compartir la ruta. Inténtalo de nuevo.'); }
  }
  return <View style={ui.content}>
    <Text style={ui.title}>Guardar ruta</Text>
    <Text style={ui.label}>{(data.distance / 1000).toFixed(2)} km · {formatElapsed(data.elapsed)} · {data.places.length} puntos</Text>
    <RouteMap points={data.points} places={data.places} overview />
    {photo && <Image source={photo} style={{ width: '100%', height: 160, borderRadius: 20 }} contentFit="cover" />}
    <Action label={photo ? 'Cambiar foto' : 'Agregar foto'} onPress={() => void choosePhoto()} />
    <Input label="Nombre de la ruta" value={name} onChangeText={setName} maxLength={100} placeholder="Ej. Sendero del valle" />
    <Input label="Descripcion de la ruta" value={description} onChangeText={setDescription} multiline maxLength={500} />
    <Text style={ui.label}>Dificultad</Text><Choices values={['Novato', 'Intermedio', 'Experto']} selected={[difficulty]} onSelect={setDifficulty} />
    <Text style={ui.label}>Equipo indispensable</Text><Choices multiple values={['Agua', 'Botas', 'Mochila', 'Ropa termica', 'Bastones', 'Proteccion solar', 'Mapa/GPS']} selected={equipment} onSelect={value => setEquipment(toggle(equipment, value))} />
    <Text style={ui.label}>Visibilidad</Text><Choices values={['Privada', 'Publica']} selected={[visibility === 'private' ? 'Privada' : 'Publica']} onSelect={value => setVisibility(value === 'Privada' ? 'private' : 'public')} />
    {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
    {saved
      ? <>
          <Text accessibilityLiveRegion="polite" style={ui.muted}>Ruta guardada correctamente.</Text>
          <Action label="Compartir ruta" onPress={() => void shareRoute()} />
          {!!shareError && <Text accessibilityRole="alert" style={ui.error}>{shareError}</Text>}
          <Action label="Continuar a Mis rutas" onPress={done} />
        </>
      : <Action label={busy ? 'Guardando ruta...' : 'Guardar ruta'} loading={busy} onPress={() => void save()} />}
  </View>;
}

export function SavedRoutes({ ownerId, open, create, message }: { ownerId: string | null; open: (route: RouteData) => void; create: () => void; message: string }) {
  const [routes, setRoutes] = useState<RouteData[]>([]), [filter, setFilter] = useState('Todas'), [error, setError] = useState('');
  const [loadedOwner, setLoadedOwner] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    let downloads: RouteData[] = [];
    const merge = (primary: RouteData[], fallback: RouteData[]) => Array.from(new Map([...fallback, ...primary].map(route => [route.id, route])).values()).sort((a, b) => b.updatedAt - a.updatedAt);
    loadOfflineRoutes(ownerId).catch(() => {
      if (alive) setError('No se pudieron cargar las descargas.');
      return [];
    }).then(offline => {
      downloads = offline;
      if (alive) setRoutes(offline);
      return loadLocalRoutes(ownerId);
    }).then(local => { if (alive) { setRoutes(merge(local, downloads)); setLoadedOwner(ownerId); } })
      .then(() => refreshRoutes(ownerId)).then(updated => { if (alive) setRoutes(merge(updated, downloads)); })
      .catch(() => { if (alive) { setLoadedOwner(ownerId); setError('Mostrando copia local. Sincronizacion pendiente.'); } });
    return () => { alive = false; };
  }, [ownerId]);
  return <View style={ui.content}>
    <Text style={ui.title}>Mis rutas</Text>{!!message && <Text accessibilityLiveRegion="polite" style={ui.muted}>{message}</Text>}
    <Choices values={['Todas', 'Publicas', 'Privadas']} selected={[filter]} onSelect={setFilter} />
    {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
    <Text style={ui.muted}>{ownerId ? 'La sincronización con Supabase se realiza automáticamente.' : 'Inicia sesion para sincronizar tus rutas entre dispositivos.'}</Text>
    {routes.filter(route => filter === 'Todas' || route.visibility === (filter === 'Publicas' ? 'public' : 'private')).map(route => {
      const pending = route.syncedAt !== route.updatedAt;
      return (
      <Pressable key={route.id} accessibilityRole="button" accessibilityLabel={`Abrir ${route.name || 'Recorrido pendiente'}`} onPress={() => open(route)} style={{ padding: 14, gap: 8, borderBottomWidth: 1, borderColor: '#d5dfd7' }}>
        <Text style={ui.label}>{route.name || 'Recorrido pendiente'}</Text><Text>{(route.distance / 1000).toFixed(2)} km · {formatElapsed(route.elapsed)}</Text>
        {route.photo && <Image source={route.photo} style={{ width: 76, height: 76, borderRadius: 38 }} contentFit="cover" />}
        <Text style={ui.muted}>{route.status === 'finished' ? 'Finalizada' : 'Continuar recorrido'} · {pending ? 'Pendiente de sincronizar' : 'Sincronizada'} · {route.visibility === 'public' ? 'Publica' : 'Privada'}</Text>
      </Pressable>
    );})}
    {loadedOwner !== ownerId && !routes.length && <LoadingState label="Cargando tus rutas…" />}
    {loadedOwner === ownerId && !routes.length && <Text style={ui.muted}>Todavia no tienes rutas guardadas.</Text>}
    <Action label="Grabar ruta" onPress={create} />
  </View>;
}
export function SavedRouteDetail({ route, back }: { route: RouteData; back: () => void }) {
  const [downloaded, setDownloaded] = useState(false), [offlineBusy, setOfflineBusy] = useState(true), [offlineError, setOfflineError] = useState('');
  const [checkedRouteId, setCheckedRouteId] = useState<string | null>(null);
  const offlineOperation = useRef(false);
  useEffect(() => {
    let alive = true;
    loadOfflineRoutes(route.ownerId)
      .then(routes => { if (alive) setDownloaded(routes.some(item => item.id === route.id)); })
      .catch(() => { if (alive) setOfflineError('No se pudo comprobar la descarga.'); })
      .finally(() => { if (alive) { setCheckedRouteId(route.id); setOfflineBusy(false); } });
    return () => { alive = false; };
  }, [route.id, route.ownerId]);
  async function toggleDownload() {
    if (offlineOperation.current) return;
    offlineOperation.current = true; setOfflineBusy(true); setOfflineError('');
    try {
      if (downloaded) await removeOfflineRoute(route.id);
      else await saveOfflineRoute(route);
      setDownloaded(!downloaded);
    } catch { setOfflineError('No se pudo guardar o eliminar la descarga. Inténtalo de nuevo.'); }
    finally { offlineOperation.current = false; setOfflineBusy(false); }
  }
  const [shareError, setShareError] = useState('');
  async function shareRoute() {
    setShareError('');
    try {
      const routeUrl = getRouteShareUrl(route.id, route.visibility);
      await Share.share({ message: [
        `Ruta: ${route.name || 'Ruta de Trekking'}`,
        `Distancia: ${(route.distance / 1000).toFixed(2)} km`,
        `Duración: ${formatElapsed(route.elapsed)}`,
        `Dificultad: ${route.difficulty}`,
        ...(route.description.trim() ? [`Descripción: ${route.description}`] : []),
        ...(routeUrl ? [`${getRouteShareLinkLabel(routeUrl)}: ${routeUrl}`] : []),
      ].join('\n') });
    } catch { setShareError('No se pudo compartir la ruta. Inténtalo de nuevo.'); }
  }
  return <View style={ui.content}><Action label="Volver a Mis rutas" onPress={back} /><Text style={ui.title}>{route.name}</Text>
    <Action label="Compartir ruta" onPress={() => void shareRoute()} />
    {!!shareError && <Text accessibilityRole="alert" style={ui.error}>{shareError}</Text>}
    {downloaded && <Text accessibilityLiveRegion="polite" style={ui.muted}>Disponible offline</Text>}
    <Action label={checkedRouteId !== route.id ? 'Comprobando descarga...' : offlineBusy ? (downloaded ? 'Eliminando descarga...' : 'Guardando descarga...') : downloaded ? 'Eliminar descarga' : 'Descargar para usar offline'} loading={offlineBusy || checkedRouteId !== route.id} onPress={() => void toggleDownload()} />
    <Text style={ui.muted}>La descarga incluye datos y trazado GPS. No incluye mapa base ni fotos.</Text>
    {!!offlineError && <Text accessibilityRole="alert" style={ui.error}>{offlineError}</Text>}
    <Text>{(route.distance / 1000).toFixed(2)} km · {formatElapsed(route.elapsed)} · {route.difficulty}</Text>
    {route.photo && <Image source={route.photo} style={{ height: 180, width: '100%', borderRadius: 22 }} />}
    <RouteMap points={route.points} places={route.places} overview /><Text>{route.description}</Text>
    <Text style={ui.label}>Equipo</Text><Text>{route.equipment.join(', ') || 'Sin equipo indicado'}</Text>
    <Text style={ui.label}>Puntos del recorrido</Text>
    {route.places.map(place => <View key={place.id} style={{ gap: 6 }}>{place.photo && <Image source={place.photo} style={{ width: '100%', height: 140, borderRadius: 18 }} contentFit="cover" />}<Text style={ui.label}>{place.name}</Text><Text>{place.description}</Text><Text>{place.type} · {place.services.join(', ')}</Text><Text>{place.latitude.toFixed(6)}, {place.longitude.toFixed(6)}</Text></View>)}
  </View>;
}
