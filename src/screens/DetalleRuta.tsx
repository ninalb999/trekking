import { Pressable, StyleSheet, Text, View } from 'react-native';

/** Datos de presentación temporales para HU-06.1; no representan el esquema de Supabase. */
export type DetalleRutaData = {
  name: string;
  author: string;
  visibility: 'public' | 'private';
  distance: string;
  duration: string;
  difficulty: string;
  description: string;
};

type DetalleRutaProps = {
  route: DetalleRutaData;
  onBack: () => void;
};

/** El prototipo padre conserva el ScrollView y las áreas seguras. */
export default function DetalleRuta({ route, onBack }: DetalleRutaProps) {
  return (
    <View style={styles.content}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Volver a Mis rutas"
          onPress={onBack}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.headerTitle}>Detalle de ruta</Text>
      </View>

      <View style={styles.demoNotice}>
        <Text selectable style={styles.demoText}>
          Datos de demostración · Vista previa de HU-06.1
        </Text>
      </View>

      <View style={styles.identity}>
        <View style={styles.titleGroup}>
          <Text selectable accessibilityRole="header" style={styles.title}>{route.name}</Text>
          <Text selectable style={styles.author}>Por {route.author}</Text>
        </View>
        <View style={[styles.badge, route.visibility === 'private' && styles.privateBadge]}>
          <Text style={styles.badgeText}>{route.visibility === 'public' ? 'Pública' : 'Privada'}</Text>
        </View>
      </View>

      <View style={styles.summary}>
        <Metric value={route.distance} label="Distancia" />
        <Metric value={route.duration} label="Duración" />
        <Metric value={route.difficulty} label="Dificultad" />
      </View>

      <View style={styles.panel}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>Descripción</Text>
        <Text selectable style={styles.description}>{route.description}</Text>
      </View>
    </View>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.metric}>
      <Text selectable style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: 12, padding: 14, backgroundColor: '#fbfbf7' },
  header: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 16 },
  headerTitle: { flex: 1, color: '#0a2520', fontSize: 18, fontWeight: '900' },
  backButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(0,0,0,0.12)' },
  backText: { color: '#103929', fontSize: 28, fontWeight: '900' },
  pressed: { opacity: 0.76 },
  demoNotice: { padding: 12, borderRadius: 12, backgroundColor: '#fff2db' },
  demoText: { color: '#70491c', fontSize: 13, lineHeight: 19, fontWeight: '600' },
  identity: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  titleGroup: { flexGrow: 1, flexShrink: 1, flexBasis: 200 },
  title: { color: '#030605', fontSize: 29, fontWeight: '900' },
  author: { color: '#5e6864', fontSize: 13, fontWeight: '600', marginTop: 3 },
  badge: { minHeight: 32, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 18, backgroundColor: '#dcefe4', justifyContent: 'center' },
  privateBadge: { backgroundColor: '#eef1ef' },
  badgeText: { color: '#155136', fontSize: 13, fontWeight: '900' },
  summary: { padding: 14, borderRadius: 18, backgroundColor: '#fff', flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metric: { flexGrow: 1, flexBasis: 85, alignItems: 'center' },
  metricValue: { color: '#07100b', fontSize: 18, fontWeight: '900', textAlign: 'center' },
  metricLabel: { color: '#69736f', fontSize: 12, fontWeight: '700', textAlign: 'center', marginTop: 4 },
  panel: { padding: 12, borderRadius: 16, backgroundColor: '#fff', gap: 10 },
  sectionTitle: { color: '#060807', fontSize: 20, fontWeight: '900' },
  description: { color: '#4f5c58', fontSize: 15, lineHeight: 23 },
});
