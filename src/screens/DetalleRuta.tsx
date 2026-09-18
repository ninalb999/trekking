import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import RouteMap from '@/components/route-map';
import { RouteDetailMap } from '@/components/route-detail-map';
import { useRouteDetail } from '@/hooks/use-route-detail';
import { formatDistance, formatDuration, type PublicRouteDetail } from '@/lib/public-routes';

type DetalleRutaProps = {
  routeId: string | null;
  onBack: () => void;
};

export default function DetalleRuta({ routeId, onBack }: DetalleRutaProps) {
  const { state, retry } = useRouteDetail(routeId);

  if (state.status === 'loading') return <StatusCard title="Cargando ruta…" onBack={onBack} />;
  if (state.status === 'invalid-id') return <StatusCard title="Identificador de ruta inválido" onBack={onBack} />;
  if (state.status === 'unavailable') return <StatusCard title="Ruta no disponible" copy="Puede que no exista o que no esté publicada." onBack={onBack} />;
  if (state.status === 'error') return <StatusCard title={state.message} onBack={onBack} onRetry={retry} />;

  return <RouteContent detail={state.detail} imageUrl={state.imageUrl} imageError={state.imageError} onBack={onBack} />;
}

function RouteContent({ detail, imageUrl, imageError, onBack }: {
  detail: PublicRouteDetail;
  imageUrl: string | null;
  imageError: boolean;
  onBack: () => void;
}) {
  const hasTrack = detail.points.length > 0;
  const isPersistedRoute = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(detail.id);

  return (
    <View style={styles.content}>
      <View style={styles.header}><BackButton onPress={onBack} /><Text accessibilityRole="header" style={styles.headerTitle}>Detalle de ruta</Text></View>
      {imageUrl ? <Image accessibilityLabel="Fotografía principal de la ruta" source={{ uri: imageUrl }} style={styles.heroImage} /> : <View style={styles.imagePlaceholder}><Text style={styles.imagePlaceholderText}>{imageError ? 'No se pudo cargar la fotografía' : 'Sin fotografía principal'}</Text></View>}
      <View style={styles.identity}>
        <View style={styles.titleGroup}><Text selectable accessibilityRole="header" style={styles.title}>{detail.name}</Text><Text selectable style={styles.author}>Por {detail.ownerName}</Text></View>
        <View style={styles.badge}><Text style={styles.badgeText}>Pública</Text></View>
      </View>
      <View style={styles.summary}>
        <Metric value={formatDistance(detail.distanceMeters)} label="Distancia" />
        <Metric value={formatDuration(detail.durationSeconds)} label="Duración" />
        <Metric value={detail.difficulty} label="Dificultad" />
      </View>
      <Panel title="Descripción"><Text selectable style={styles.description}>{detail.description || 'Sin descripción.'}</Text></Panel>
      <Panel title="Mapa de la ruta">
        {hasTrack ? <RouteMap points={detail.points} places={detail.places} overview /> : isPersistedRoute ? <RouteDetailMap routeId={detail.id} /> : <Text style={styles.description}>Esta ruta todavía no tiene coordenadas.</Text>}
      </Panel>
      <Panel title="Equipo indispensable">
        {detail.equipment.length ? <View style={styles.equipmentList}>{detail.equipment.map(item => <Text key={item} style={styles.equipmentItem}>{item}</Text>)}</View> : <Text style={styles.description}>No se registró equipo para esta ruta.</Text>}
      </Panel>
      {!!detail.places.length && <Panel title="Puntos de la ruta">
        {detail.places.map((place, index) => <View key={place.id} style={styles.placeRow}>
          <View style={styles.pointDot} />
          <View style={styles.titleGroup}>
            {!!place.photo && <Image source={{ uri: place.photo }} style={styles.placeImage} />}
            <Text style={styles.placeName}>{place.name}</Text>
            <Text style={styles.placeType}>{pointTypeLabel(place.type)}</Text>
            <Text style={styles.description}>{place.description || `Punto ${index + 1} del recorrido`}</Text>
            {!!place.services.length && <View style={styles.serviceList}>{place.services.map(service => <Text key={service} style={styles.serviceItem}>{service}</Text>)}</View>}
          </View>
        </View>)}
      </Panel>}
    </View>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={styles.panel}><Text accessibilityRole="header" style={styles.sectionTitle}>{title}</Text>{children}</View>;
}

function StatusCard({ title, copy, onBack, onRetry }: { title: string; copy?: string; onBack: () => void; onRetry?: () => void }) {
  return <View style={styles.content}>
    <View style={styles.header}><BackButton onPress={onBack} /><Text accessibilityRole="header" style={styles.headerTitle}>Detalle de ruta</Text></View>
    <View style={styles.statusCard}><Text accessibilityRole="header" style={styles.sectionTitle}>{title}</Text>{!!copy && <Text style={styles.description}>{copy}</Text>}{!!onRetry && <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retryButton}><Text style={styles.retryText}>Reintentar</Text></Pressable>}</View>
  </View>;
}

function BackButton({ onPress }: { onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel="Volver" onPress={onPress} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}><Text style={styles.backText}>‹</Text></Pressable>;
}

function Metric({ value, label }: { value: string; label: string }) {
  return <View style={styles.metric}><Text selectable style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

function pointTypeLabel(type: string) {
  return ({ campamento: 'Campamento', descanso: 'Descanso', agua: 'Agua', tienda: 'Tienda', otro: 'Otro' } as Record<string, string>)[type] ?? type;
}

const styles = StyleSheet.create({
  content: { gap: 12, padding: 14, backgroundColor: '#fbfbf7' }, header: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 16 }, headerTitle: { flex: 1, color: '#0a2520', fontSize: 18, fontWeight: '900' }, backButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(0,0,0,0.12)' }, backText: { color: '#103929', fontSize: 28, fontWeight: '900' }, pressed: { opacity: 0.76 }, heroImage: { width: '100%', height: 190, borderRadius: 24 }, imagePlaceholder: { width: '100%', height: 190, borderRadius: 24, backgroundColor: '#dce8d7', alignItems: 'center', justifyContent: 'center' }, imagePlaceholderText: { color: '#456153', fontSize: 14, fontWeight: '700' }, identity: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 }, titleGroup: { flexGrow: 1, flexShrink: 1, flexBasis: 200 }, title: { color: '#030605', fontSize: 29, fontWeight: '900' }, author: { color: '#5e6864', fontSize: 13, fontWeight: '600', marginTop: 3 }, badge: { minHeight: 32, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 18, backgroundColor: '#dcefe4', justifyContent: 'center' }, badgeText: { color: '#155136', fontSize: 13, fontWeight: '900' }, summary: { padding: 14, borderRadius: 18, backgroundColor: '#fff', flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, metric: { flexGrow: 1, flexBasis: 85, alignItems: 'center' }, metricValue: { color: '#07100b', fontSize: 18, fontWeight: '900', textAlign: 'center' }, metricLabel: { color: '#69736f', fontSize: 12, fontWeight: '700', textAlign: 'center', marginTop: 4 }, panel: { padding: 12, borderRadius: 16, backgroundColor: '#fff', gap: 10 }, statusCard: { padding: 16, borderRadius: 16, backgroundColor: '#fff', gap: 12 }, sectionTitle: { color: '#060807', fontSize: 20, fontWeight: '900' }, description: { color: '#4f5c58', fontSize: 15, lineHeight: 23 }, retryButton: { alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: '#155136' }, retryText: { color: '#fff', fontSize: 14, fontWeight: '800' }, equipmentList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, equipmentItem: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: '#e8f1eb', color: '#163d2d', fontSize: 12, fontWeight: '700' }, placeRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' }, pointDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#2f8a4c', marginTop: 6 }, placeImage: { width: '100%', height: 116, borderRadius: 18, marginBottom: 8 }, placeName: { color: '#101713', fontSize: 14, fontWeight: '900' }, placeType: { color: '#155136', fontSize: 12, fontWeight: '800', marginTop: 2 }, serviceList: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }, serviceItem: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, backgroundColor: '#e8f1eb', color: '#163d2d', fontSize: 11, fontWeight: '700' },
});
