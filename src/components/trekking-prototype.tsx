import { useEffect, useRef, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useRouter } from 'expo-router';
import { useRecording } from '../hooks/use-recording';
import { formatElapsed } from '../lib/recording';
import RouteMap from './route-map';
import { pickRouteImage, type RouteImageSelection } from '../lib/route-images';
import { PointForm, FinishForm, SavedRoutes, SavedRouteDetail } from './route-workflow';
import type { RouteData } from '../lib/route-data';
import { useKeepAwake } from 'expo-keep-awake';

import { getSession, signInWithPassword, signOut, signUp } from '@/lib/auth';
import { screenAfterAuthEvent, type AuthScreen } from '@/lib/auth-events';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  formatDistance,
  formatDuration,
  listPublicRoutes,
  type PublicRouteSummary,
} from '@/lib/public-routes';
import {
  clearPendingProfileImage,
  pickProfileImage,
  savePendingProfileImage,
  uploadPendingProfileImage,
  type ProfileImageSelection,
} from '@/lib/profile-images';
import { getRouteMainImageUrl } from '@/lib/route-detail';

type ScreenId = AuthScreen;

const ROUTES = [
  ['Laguna Escondida', 'Andes Explorer', '12.4 km', '5 h 30 min', 'Novato', 'green'],
  ['Cerro Mirador', 'RutaLibre', '8.7 km', '3 h 20 min', 'Intermedio', 'blue'],
  ['Pico del Sol', 'Montana Viva', '15.2 km', '7 h 10 min', 'Experto', 'red'],
  ['Bosque del Rio', 'CaminaMas', '6.1 km', '2 h 45 min', 'Novato', 'green'],
  ['Ruta de las Rocas', 'Aventura Natural', '10.3 km', '4 h 15 min', 'Intermedio', 'blue'],
];

export function TrekkingPrototype() {
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const recording = useRecording(ownerId);
  const pauseRecording = useRef(recording.pause);
  useEffect(() => { pauseRecording.current = recording.pause; });
  const [selectedRoute, setSelectedRoute] = useState<RouteData | null>(null);
  const [screen, setCurrentScreen] = useState<ScreenId>('login');
  const [activeTab, setActiveTab] = useState('Inicio');
  const [authenticated, setAuthenticated] = useState(false);
  const [sessionFeedback, setSessionFeedback] = useState('');
  const [notice, setNotice] = useState('');
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const phoneWidth = Math.min(width, 430);
  const isAuth = screen === 'login' || screen === 'register';
  const setScreen = (next: ScreenId) => {
    if (screen === 'point' && next === 'record' && recording.track.status === 'paused') void recording.begin();
    if (next !== 'record' && (recording.track.status === 'recording' || recording.busy)) recording.pause();
    if (next === 'home') setActiveTab('Inicio');
    if (next === 'routes') setActiveTab('Mis rutas');
    if (next === 'record' || next === 'point' || next === 'finish') setActiveTab('Grabar');
    setCurrentScreen(next);
  };
  const showNotice = (message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(current => current === message ? '' : current), 3800);
  };

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;
    let receivedAuthEvent = false;
    const applyAuthEvent = (event: string, hasSession: boolean) => {
      if (!active) return;
      setAuthenticated(hasSession);
      setCurrentScreen(current => {
        const next = screenAfterAuthEvent(event, hasSession, current);
        if (next === 'home' && next !== current) setActiveTab('Inicio');
        if (next === 'login' && next !== current) {
          pauseRecording.current();
          setActiveTab('Inicio');
        }
        return next;
      });
    };
    const { data: subscription } = getSupabase().auth.onAuthStateChange((event, session) => {
      receivedAuthEvent = true;
      setOwnerId(session?.user.id ?? null);
      if (session?.user.id) {
        void uploadPendingProfileImage(session.user.id).then(uploaded => {
          if (active && uploaded) showNotice('Foto de perfil guardada con éxito.');
        }).catch(() => {
          if (active) {
            setSessionFeedback('Tu cuenta está activa, pero la foto de perfil aún no pudo subirse. Se reintentará al iniciar sesión.');
          }
        });
      }
      applyAuthEvent(event, Boolean(session));
    });
    getSession().then(({ data }) => {
      const restoredUserId = data.session?.user.id ?? null;
      if (restoredUserId) {
        void uploadPendingProfileImage(restoredUserId).then(uploaded => {
          if (active && uploaded) showNotice('Foto de perfil guardada con éxito.');
        }).catch(() => {
          if (active) setSessionFeedback('Tu cuenta está activa, pero la foto de perfil aún no pudo subirse. Se reintentará al iniciar sesión.');
        });
      }
      if (!receivedAuthEvent) { setOwnerId(restoredUserId); applyAuthEvent('INITIAL_SESSION', Boolean(data.session)); }
    }).catch(() => {
      if (active && !receivedAuthEvent) {
        setAuthenticated(false);
        setSessionFeedback('No se pudo restaurar la sesión. Revisa tu conexión e inténtalo de nuevo.');
      }
    });
    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const logOut = async () => {
    setSessionFeedback('');
    const { error } = await signOut();
    if (error) {
      setSessionFeedback('No se pudo cerrar la sesión. Inténtalo de nuevo.');
      return;
    }
    setScreen('login');
  };

  return (
    <View style={[styles.root, { height, maxHeight: height, alignItems: 'center' }]}>
      <View style={[styles.phone, { width: phoneWidth, flex: 1, paddingTop: insets.top }]}>
        {process.env.EXPO_OS === 'web' && <PhoneStatus />}
        <ScrollView
          key={screen}
          style={{ flex: 1, minHeight: 0 }}
          contentContainerStyle={{ paddingBottom: isAuth ? insets.bottom + 16 : 16 }}
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="never">
        {screen === 'home' && <HomeScreen navigate={setScreen} authenticated={authenticated} onSignOut={logOut} sessionFeedback={sessionFeedback} />}
        {screen === 'login' && <LoginScreen navigate={setScreen} onNotice={showNotice} />}
        {screen === 'register' && <RegisterScreen navigate={setScreen} onNotice={showNotice} />}
        {screen === 'routes' && <SavedRoutes ownerId={ownerId} message={recording.saveStatus} create={() => setScreen('record')} open={route => {
          if (route.status !== 'finished' || !route.name) { recording.restore(route); setScreen(route.status === 'finished' ? 'finish' : 'record'); }
          else { setSelectedRoute(route); setScreen('detail'); }
        }} />}
        {screen === 'record' && <RecordingScreen navigate={setScreen} recording={recording} />}
        {screen === 'point' && <PointForm recording={recording} back={() => setScreen('record')} />}
        {screen === 'finish' && <FinishForm recording={recording} done={() => { showNotice('Ruta guardada con éxito.'); setScreen('routes'); }} />}
        {screen === 'detail' && selectedRoute && <SavedRouteDetail route={selectedRoute} back={() => { setSelectedRoute(null); setScreen('routes'); }} />}
        </ScrollView>
        {!!notice && <NoticeBanner message={notice} />}
        {!isAuth && (
          <View style={{ paddingBottom: insets.bottom, backgroundColor: '#fff', flexShrink: 0 }}>
            <BottomTabs active={activeTab} navigate={setScreen} />
          </View>
        )}
      </View>
    </View>
  );
}

function PhoneStatus() {
  return (
    <View style={styles.status}>
      <Text selectable style={styles.statusTime}>
        9:41
      </Text>
      <View style={styles.statusRight}>
        <Text selectable style={styles.statusMini}>
          5G
        </Text>
        <View style={styles.battery} />
      </View>
    </View>
  );
}

function NoticeBanner({ message }: { message: string }) {
  return (
    <View accessibilityRole="alert" style={styles.notice}>
      <Text selectable style={styles.noticeText}>{message}</Text>
    </View>
  );
}

function Hero({ title, subtitle, center }: { title: string; subtitle: string; center?: boolean }) {
  return (
    <View style={[styles.hero, center && styles.heroCenter]}>
      <View style={styles.mountains}>
        <View style={[styles.mountain, styles.mountainOne]} />
        <View style={[styles.mountain, styles.mountainTwo]} />
        <View style={[styles.mountain, styles.mountainThree]} />
        <View style={[styles.tree, { left: 12 }]} />
        <View style={[styles.tree, { right: 28 }]} />
        <View style={[styles.tree, { right: 78, height: 42 }]} />
      </View>
      <Text selectable style={[styles.heroTitle, center && styles.textCenter]}>
        {title}
      </Text>
      <Text selectable style={[styles.heroCopy, center && styles.textCenter]}>
        {subtitle}
      </Text>
    </View>
  );
}

function HomeScreen({ navigate, authenticated, onSignOut, sessionFeedback }: {
  navigate: (screen: ScreenId) => void;
  authenticated: boolean;
  onSignOut: () => void;
  sessionFeedback: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [routes, setRoutes] = useState<PublicRouteSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    let active = true;
    listPublicRoutes(search, difficulty)
      .then(data => { if (active) { setRoutes(data); setFeedback(''); } })
      .catch(() => { if (active) setFeedback('No se pudo cargar el catalogo.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [search, difficulty]);

  const open = (route: PublicRouteSummary) => router.push(`/rutas/${route.id}` as never);

  return (
    <>
      <Hero title="Rutas de Trekking" subtitle="Explora. Camina. Comparte." />
      <View style={styles.content}>
        <SecondaryButton label={authenticated ? 'Cerrar sesión' : 'Iniciar sesión / Crear cuenta'} onPress={authenticated ? onSignOut : () => navigate('login')} />
        {!!sessionFeedback && <Text selectable accessibilityRole="alert" style={styles.formFeedback}>{sessionFeedback}</Text>}
        <SearchBox text="Buscar rutas, lugares o creadores..." value={search} onChangeText={setSearch} />
        <View style={styles.rowBetween}>
          <View style={styles.row}>
            <Icon label="F" />
            <Text selectable style={styles.sectionTitle}>
              Filtros
            </Text>
          </View>
          <Text selectable onPress={() => { setDifficulty(''); setSearch(''); }} style={styles.link}>
            Limpiar todo
          </Text>
        </View>
        <View style={styles.pillGrid}>
          <FilterPill label="Novato" tone="green" active={difficulty === 'Novato'} onPress={() => setDifficulty(difficulty === 'Novato' ? '' : 'Novato')} />
          <FilterPill label="Intermedio" tone="sand" active={difficulty === 'Intermedio'} onPress={() => setDifficulty(difficulty === 'Intermedio' ? '' : 'Intermedio')} />
          <FilterPill label="Experto" tone="red" active={difficulty === 'Experto'} onPress={() => setDifficulty(difficulty === 'Experto' ? '' : 'Experto')} />
          <Pill label="Mas recientes" />
          <Pill label="Mas visitadas" />
          <Pill label="Cerca de mi" />
        </View>
        {!!feedback && <Text selectable accessibilityRole="alert" style={styles.formFeedback}>{feedback}</Text>}
        {loading && <Text selectable style={styles.formCopy}>Cargando rutas publicas...</Text>}
        {!loading && routes.map((route, index) => (
          <RouteCard key={route.id} route={route} index={index} onPress={() => open(route)} />
        ))}
        {!loading && !routes.length && <Text selectable style={styles.formCopy}>No hay rutas publicas con esos filtros.</Text>}
        <PrimaryButton label="Grabar ruta" icon="+" onPress={() => navigate('record')} />
      </View>
    </>
  );
}

function LoginScreen({ navigate, onNotice }: { navigate: (screen: ScreenId) => void; onNotice: (message: string) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState('');

  const login = async () => {
    if (loading) return;
    setFeedback('');
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setFeedback('Escribe tu correo y contraseña.');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await signInWithPassword(normalizedEmail, password);
      if (error) {
        setFeedback(error.code === 'invalid_credentials'
          ? 'Correo o contraseña incorrectos.'
          : error.code === 'email_not_confirmed'
            ? 'Confirma tu correo antes de ingresar.'
            : error.message);
        return;
      }
      if (data.session) { onNotice('Inicio de sesión correcto.'); navigate('home'); }
    } catch {
      setFeedback('No se pudo iniciar sesión. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Hero title="Rutas de Trekking" subtitle="Explora. Camina. Comparte." />
      <View style={styles.authCard}>
        <View style={styles.logo}>
          <Text selectable style={styles.logoText}>
            MT
          </Text>
        </View>
        <Text selectable style={styles.authTitle}>
          Iniciar sesión
        </Text>
        <Text selectable style={styles.authCopy}>
          Continúa tu aventura y descubre nuevas rutas
        </Text>
        <View style={styles.authForm}>
          <Field text="Correo electrónico" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" maxLength={120} />
          <Field text="Contraseña" value={password} onChangeText={setPassword} secure maxLength={64} />
          <Text selectable style={styles.forgot}>
            ¿Olvidaste tu contraseña?
          </Text>
          {!!feedback && <Text selectable accessibilityRole="alert" style={styles.formFeedback}>{feedback}</Text>}
          <PrimaryButton label={loading ? 'Ingresando...' : 'Ingresar'} suffix="→" onPress={login} disabled={loading} />
          <Divider />
          <SecondaryButton label="¿No tienes cuenta? Regístrate" onPress={() => navigate('register')} />
          <SecondaryButton label="Continuar sin cuenta" onPress={() => navigate('home')} />
        </View>
      </View>
      <View style={styles.features}>
        <MiniFeature icon={{ ios: 'map.fill', android: 'route', web: 'route' }} label="Descubre nuevos lugares" />
        <MiniFeature icon={{ ios: 'bubble.left.and.bubble.right.fill', android: 'forum', web: 'forum' }} label="Comparte tus experiencias" />
        <MiniFeature icon={{ ios: 'tree.fill', android: 'forest', web: 'forest' }} label="Vive la naturaleza" />
      </View>
    </>
  );
}

function RegisterScreen({ navigate, onNotice }: { navigate: (screen: ScreenId) => void; onNotice: (message: string) => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [pickingPhoto, setPickingPhoto] = useState(false);
  const [profileImage, setProfileImage] = useState<ProfileImageSelection | null>(null);
  const [feedback, setFeedback] = useState('');

  const chooseProfileImage = async () => {
    if (pickingPhoto || loading) return;
    // On web the picker may not resolve when the user cancels, so do not leave
    // the control disabled while the native browser dialog is open.
    if (process.env.EXPO_OS !== 'web') setPickingPhoto(true);
    setFeedback('');
    try {
      const image = await pickProfileImage();
      if (image) setProfileImage(image);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo seleccionar la foto.');
    } finally {
      if (process.env.EXPO_OS !== 'web') setPickingPhoto(false);
    }
  };

  const register = async () => {
    if (loading) return;
    setFeedback('');
    const fullName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();
    if (fullName.length < 2) {
      setFeedback('Escribe tu nombre completo.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setFeedback('Escribe un correo electrónico válido.');
      return;
    }
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      setFeedback('La contraseña debe tener al menos 8 caracteres, letras y números.');
      return;
    }
    if (password !== confirmation) {
      setFeedback('Las contraseñas no coinciden.');
      return;
    }

    let registrationAccepted = false;
    setLoading(true);
    try {
      if (profileImage) await savePendingProfileImage(profileImage);
      const { data, error } = await signUp(normalizedEmail, password, fullName, phone.trim());
      if (error) {
        if (profileImage) await clearPendingProfileImage();
        setFeedback(error.code === 'user_already_exists' || /already registered/i.test(error.message)
          ? 'Ya existe una cuenta con ese correo.'
          : error.message);
        return;
      }
      registrationAccepted = true;
      if (data.session) {
        if (profileImage) await uploadPendingProfileImage(data.session.user.id);
        onNotice(profileImage ? 'Cuenta creada y foto de perfil guardada con éxito.' : 'Cuenta creada con éxito.');
        navigate('home');
      } else {
        onNotice('Registro creado. Revisa tu correo para confirmar la cuenta.');
        setFeedback(profileImage
          ? 'Revisa tu correo para confirmar la cuenta. Tu foto se subirá cuando inicies sesión.'
          : 'Si el registro fue aceptado, revisa tu correo para confirmar la cuenta.');
      }
    } catch {
      if (profileImage && !registrationAccepted) await clearPendingProfileImage();
      setFeedback(registrationAccepted
        ? 'La cuenta fue creada, pero la foto aún no pudo subirse. Se reintentará cuando inicies sesión.'
        : 'No se pudo completar el registro. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Hero title="Crear cuenta" subtitle="Unete a nuestra comunidad y comienza a explorar." />
      <View style={styles.sheet}>
        <View style={styles.profileRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={profileImage ? 'Cambiar foto de perfil' : 'Agregar foto de perfil'}
            disabled={pickingPhoto || loading}
            onPress={chooseProfileImage}
            style={({ pressed }) => [styles.profilePhoto, pressed && styles.pressed, (pickingPhoto || loading) && styles.disabled]}>
            {profileImage
              ? <Image source={{ uri: profileImage.uri }} style={styles.profilePreview} />
              : <Text selectable style={styles.profileIcon}>{pickingPhoto ? '…' : 'C'}</Text>}
            <View style={styles.addCircle}>
              <SymbolView name={{ ios: 'plus', android: 'add', web: 'add' }} size={20} tintColor="#fff" />
            </View>
          </Pressable>
          <View style={styles.flex}>
            <Text selectable style={styles.formTitle}>
              Foto de perfil <Text style={styles.lightText}>(opcional)</Text>
            </Text>
            <Text selectable style={styles.formCopy}>
              Agrega una foto para que otros exploradores te reconozcan.
            </Text>
          </View>
        </View>
        <Field text="Nombre completo" value={name} onChangeText={setName} autoCapitalize="words" maxLength={80} />
        <Field text="Teléfono (opcional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={20} />
        <Field text="Correo electrónico" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" maxLength={120} />
        <Field text="Contraseña" value={password} onChangeText={setPassword} secure maxLength={64} />
        <Text selectable style={styles.helpText}>
          Minimo 8 caracteres, con letras y numeros.
        </Text>
        <Field text="Confirmar contraseña" value={confirmation} onChangeText={setConfirmation} secure maxLength={64} />
        {!!feedback && <Text selectable accessibilityRole="alert" style={styles.formFeedback}>{feedback}</Text>}
        <PrimaryButton label={loading ? 'Registrando...' : 'Registrarme'} onPress={register} disabled={loading} />
        <Text selectable onPress={() => navigate('login')} style={styles.centerLink}>
          Ya tienes una cuenta? <Text style={styles.linkStrong}>Iniciar sesion</Text>
        </Text>
      </View>
    </>
  );
}

function MyRoutesScreen({ navigate }: { navigate: (screen: ScreenId) => void }) {
  return (
    <>
      <Hero title="Mis rutas" subtitle="Tus aventuras, en un solo lugar." />
      <View style={styles.content}>
        <Segmented values={['Todas', 'Publicas', 'Privadas']} />
        {ROUTES.slice(0, 4).map((route, index) => (
          <OwnedCard key={route[0]} route={route} index={index} privateRoute={index % 2 === 1} onPress={() => navigate('detail')} />
        ))}
        <PrimaryButton label="Nueva ruta" icon="+" onPress={() => navigate('record')} />
      </View>
    </>
  );
}

function RecordingScreen({ navigate, recording }: { navigate: (screen: ScreenId) => void; recording: ReturnType<typeof useRecording> }) {
  const { track, busy, error, begin, pause, finish, elapsed } = recording;
  const active = track.status === 'recording';
  return (
    <>
      {active && <KeepRecordingAwake />}
      <Hero title="Grabando ruta" subtitle="Explora. Camina. Comparte." />
      <View style={styles.content}>
        <View style={styles.banner}>
          <View style={styles.liveDot} />
          <View style={styles.flex}>
            <Text selectable style={styles.bannerTitle}>
              {active ? 'Ruta en progreso' : track.status === 'paused' ? 'Ruta en pausa' : 'Grabar recorrido'}
            </Text>
            <Text selectable style={styles.bannerCopy}>
              {busy ? 'Buscando ubicacion GPS...' : 'Mantén la app abierta durante el recorrido.'}
            </Text>
          </View>
          <Pill label={active ? 'GPS activo' : 'GPS detenido'} tone="green" small />
        </View>
        <View style={styles.metrics}>
          <Metric title="Distancia" value={`${(track.distance / 1000).toFixed(2)} km`} icon="D" />
          <Metric title="Tiempo activo" value={formatElapsed(elapsed)} icon="T" />
        </View>
        <RouteMap
          points={[...track.points]}
          location={recording.location}
          places={recording.places}
        />
        <Text style={styles.formCopy}>{recording.quality}</Text>
        {!!recording.saveStatus && <Text style={styles.formCopy}>{recording.saveStatus}</Text>}
        {!!error && <Text accessibilityRole="alert" style={styles.formCopy}>{error}</Text>}
        <Pressable accessibilityRole="button" disabled={busy} onPress={active ? pause : () => void begin()} style={[styles.detailButton, busy && { opacity: 0.5 }]}>
          <Text style={styles.detailButtonText}>{busy ? 'Buscando GPS...' : active ? 'Pausar ruta' : track.status === 'paused' ? 'Continuar ruta' : 'Iniciar grabacion'}</Text>
        </Pressable>
        {(active || track.status === 'paused') && <>
        <View style={styles.actions}>
          <SecondaryButton label="Agregar punto" icon="P" flex onPress={() => navigate('point')} />
          <DangerButton
            label={busy ? 'Finalizando...' : 'Finalizar'}
            disabled={busy}
            onPress={() => void finish().then(finished => { if (finished) navigate('finish'); })}
          />
        </View>
        </>}
        <View style={styles.note}>
          <Icon label="i" />
          <Text selectable style={styles.noteText}>
            Puedes agregar puntos de interes durante el recorrido.
          </Text>
        </View>
      </View>
    </>
  );
}

function KeepRecordingAwake() { useKeepAwake(); return null; }

function PointScreen({ navigate, elapsed }: { navigate: (screen: ScreenId) => void; elapsed: number }) {
  return (
    <>
      <Hero title="Agregar punto" subtitle="Marca un lugar importante en tu ruta" center />
      <View style={styles.content}>
        <View style={styles.pauseBox}>
          <View style={styles.pauseIcon}>
            <Text selectable style={styles.pauseText}>
              ||
            </Text>
          </View>
          <View style={styles.flex}>
            <Text selectable style={styles.formTitle}>
              Ruta en pausa
            </Text>
            <Text selectable style={styles.formCopy}>
              El tiempo esta detenido mientras agregas este punto.
            </Text>
          </View>
          <Text selectable style={styles.timer}>
            {formatElapsed(elapsed)}
          </Text>
        </View>
        <Text selectable style={styles.sectionTitle}>
          Tipo de punto
        </Text>
        <View style={styles.pointTypes}>
          {['Campamento', 'Descanso', 'Agua', 'Tienda', 'Otro'].map((item, index) => (
            <View key={item} style={[styles.pointType, index === 0 && styles.pointTypeActive]}>
              <Text selectable style={[styles.pointLetter, index === 0 && styles.greenText]}>
                {item[0]}
              </Text>
              <Text selectable style={styles.pointText}>
                {item}
              </Text>
            </View>
          ))}
        </View>
        <Text selectable style={styles.sectionTitle}>
          Nombre del punto
        </Text>
        <Field icon="C" text="Ej. Campamento Base, Mirador, etc." />
        <Text selectable style={styles.sectionTitle}>
          Descripcion <Text style={styles.lightText}>(opcional)</Text>
        </Text>
        <TextArea text="Escribe una breve descripcion de este lugar..." count="0/200" />
        <View style={styles.services}>
          <Text selectable style={styles.formTitle}>
            Servicios disponibles
          </Text>
          <Text selectable style={styles.formCopy}>
            Indica que hay en este campamento
          </Text>
          <View style={styles.serviceGrid}>
            {['Agua', 'Senal', 'Alojamiento', 'Tienda'].map((item, index) => (
              <View key={item} style={styles.serviceCard}>
                <Text selectable style={styles.serviceLetter}>
                  {item[0]}
                </Text>
                <Text selectable style={styles.serviceText}>
                  {item}
                </Text>
                <View style={[styles.check, index % 2 === 0 && styles.checkActive]}>
                  {index % 2 === 0 && <Text style={styles.checkMark}>✓</Text>}
                </View>
              </View>
            ))}
          </View>
        </View>
        <PrimaryButton label="Guardar punto" icon="P" onPress={() => navigate('record')} />
        <SecondaryButton label="Continuar ruta" icon=">" onPress={() => navigate('record')} />
      </View>
    </>
  );
}

function FinishScreen({ navigate, recording }: { navigate: (screen: ScreenId) => void; recording: ReturnType<typeof useRecording> }) {
  const [routeImage, setRouteImage] = useState<RouteImageSelection | null>(null);
  const [imageFeedback, setImageFeedback] = useState('');
  const [pickingImage, setPickingImage] = useState(false);

  const chooseImage = async () => {
    if (pickingImage) return;
    setImageFeedback('');
    setPickingImage(true);
    try {
      const selection = await pickRouteImage();
      if (selection) {
        setRouteImage(selection);
        setImageFeedback('Foto seleccionada. Se subirá cuando la ruta se guarde.');
      }
    } catch (error) {
      setImageFeedback(error instanceof Error ? error.message : 'No se pudo seleccionar la fotografía.');
    } finally {
      setPickingImage(false);
    }
  };

  return (
    <>
      <Hero title="Finalizar ruta" subtitle="Revisa los detalles y guarda tu ruta." />
      <View style={styles.content}>
        <View style={styles.success}>
          <View style={styles.successCircle}>
            <Text style={styles.successMark}>✓</Text>
          </View>
          <View style={styles.flex}>
            <Text selectable style={styles.bannerTitle}>
              Grabacion finalizada
            </Text>
            <Text selectable style={styles.bannerCopy}>
              Recorrido conservado durante esta sesion. Guardado en la nube pendiente.
            </Text>
          </View>
        </View>
        <View style={styles.summary}>
          <SmallMetric value={`${(recording.track.distance / 1000).toFixed(2)} km`} label="Distancia total" />
          <SmallMetric value={formatElapsed(recording.elapsed)} label="Tiempo activo" />
          <SmallMetric value={String(recording.track.points.length)} label="Coordenadas" />
        </View>
        {!!recording.error && <Text selectable accessibilityRole="alert" style={styles.formFeedback}>{recording.error}</Text>}
        <Text selectable style={styles.sectionTitle}>
          Foto principal
        </Text>
        <View style={styles.photoRow}>
          {routeImage ? <Image source={{ uri: routeImage.uri }} style={[styles.photo, styles.photoWide]} resizeMode="cover" /> : <Photo wide />}
          <Pressable accessibilityRole="button" disabled={pickingImage} onPress={chooseImage} style={({ pressed }) => [styles.upload, pickingImage && styles.disabled, pressed && styles.pressed]}>
            <Text selectable style={styles.uploadPlus}>
              +
            </Text>
            <Text selectable style={styles.formCopy}>
              {pickingImage ? 'Abriendo...' : routeImage ? 'Cambiar foto' : 'Subir foto'}
            </Text>
          </Pressable>
        </View>
        {!!imageFeedback && <Text selectable accessibilityLiveRegion="polite" style={styles.formCopy}>{imageFeedback}</Text>}
        <Text selectable style={styles.sectionTitle}>
          Nombre de la ruta
        </Text>
        <Field text="Ej. Laguna Escondida" />
        <Text selectable style={styles.sectionTitle}>
          Descripcion
        </Text>
        <TextArea text="Cuentanos sobre tu ruta, los paisajes, recomendaciones..." count="0/500" />
        <Text selectable style={styles.sectionTitle}>
          Dificultad
        </Text>
        <View style={styles.pillGrid}>
          <Pill label="Novato" tone="green" />
          <Pill label="Intermedio" tone="sand" />
          <Pill label="Experto" tone="red" />
        </View>
        <Text selectable style={styles.sectionTitle}>
          Equipo indispensable
        </Text>
        <ChipCloud items={['Agua', 'Botas', 'Mochila', 'Ropa termica', 'Bastones', 'Proteccion solar', 'Mapa/GPS']} />
        <Text selectable style={styles.sectionTitle}>
          Visibilidad de la ruta
        </Text>
        <View style={styles.visibility}>
          <Visibility title="Publica" active />
          <Visibility title="Privada" />
        </View>
        <SecondaryButton label="Volver a Mis rutas" onPress={() => navigate('routes')} />
      </View>
    </>
  );
}

function SearchBox({ text, value, onChangeText }: { text: string; value: string; onChangeText: (value: string) => void }) {
  return (
    <View style={styles.search}>
      <SymbolView
        name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
        size={20}
        tintColor="#1d2b27"
      />
      <TextInput
        accessibilityLabel="Buscar rutas"
        autoCapitalize="none"
        onChangeText={onChangeText}
        placeholder={text}
        placeholderTextColor="#7d8683"
        style={styles.searchInput}
        value={value}
      />
      {!!value && (
        <Pressable
          accessibilityLabel="Limpiar búsqueda"
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => onChangeText('')}
          style={({ pressed }) => [styles.searchClearButton, pressed && styles.pressed]}
        >
          <SymbolView
            name={{ ios: 'xmark.circle.fill', android: 'close', web: 'close' }}
            size={22}
            tintColor="#52605a"
          />
        </Pressable>
      )}
    </View>
  );
}

function Field({ icon, text, trail, value, onChangeText, keyboardType, autoCapitalize, secure, maxLength }: {
  icon?: string;
  text: string;
  trail?: string;
  value?: string;
  onChangeText?: (value: string) => void;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words';
  secure?: boolean;
  maxLength?: number;
}) {
  const [visible, setVisible] = useState(false);
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.field, focused && styles.fieldFocused]}>
      {icon && (
        <Text selectable style={styles.fieldIcon}>
          {icon}
        </Text>
      )}
      {onChangeText ? (
        <TextInput
          accessibilityLabel={text}
          autoCapitalize={autoCapitalize ?? 'none'}
          keyboardType={keyboardType ?? 'default'}
          maxLength={maxLength}
          onBlur={() => setFocused(false)}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          placeholder={text}
          placeholderTextColor="#7d8683"
          secureTextEntry={secure && !visible}
          style={styles.fieldInput}
          value={value ?? ''}
        />
      ) : (
        <Text selectable style={styles.fieldText}>{text}</Text>
      )}
      {secure ? (
        <Pressable accessibilityRole="button" accessibilityLabel={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'} onPress={() => setVisible(!visible)}>
          <Text selectable style={styles.fieldTrail}>{visible ? 'Ocultar' : 'Mostrar'}</Text>
        </Pressable>
      ) : trail && (
        <Text selectable style={styles.fieldTrail}>
          {trail}
        </Text>
      )}
    </View>
  );
}

function TextArea({ text, count }: { text: string; count: string }) {
  return (
    <View style={styles.textArea}>
      <Text selectable style={styles.fieldText}>
        {text}
      </Text>
      <Text selectable style={styles.counter}>
        {count}
      </Text>
    </View>
  );
}

function Pill({ label, tone = 'neutral', small }: { label: string; tone?: string; small?: boolean }) {
  return (
    <View style={[styles.pill, small && styles.pillSmall, tone === 'green' && styles.greenPill, tone === 'blue' && styles.bluePill, tone === 'red' && styles.redPill, tone === 'sand' && styles.sandPill]}>
      <Text selectable style={[styles.pillText, tone === 'green' && styles.greenText, tone === 'blue' && styles.blueText, tone === 'red' && styles.redText, tone === 'sand' && styles.sandText]}>
        {label}
      </Text>
    </View>
  );
}

function FilterPill({ label, tone, active, onPress }: { label: string; tone: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={({ pressed }) => [pressed && styles.pressed, active && styles.filterPillActive]}>
      <Pill label={label} tone={tone} />
    </Pressable>
  );
}

function RouteCard({ route, index, onPress }: { route: PublicRouteSummary; index: number; onPress?: () => void }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    if (!route.imagePath) {
      setImageUrl(null);
      return () => { active = false; };
    }
    getRouteMainImageUrl(route.imagePath).then(url => { if (active) setImageUrl(url); }).catch(() => { if (active) setImageUrl(null); });
    return () => { active = false; };
  }, [route.imagePath]);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.routeCard, pressed && styles.pressed]}>
      {imageUrl ? <Image source={{ uri: imageUrl }} style={styles.routeThumb} /> : <Photo seed={index} />}
      <View style={styles.flex}>
        <Text selectable style={styles.routeTitle}>
          {route.name}
        </Text>
        <Text selectable style={styles.owner}>
          Por {route.ownerName}
        </Text>
        <View style={styles.meta}>
          <Text selectable style={styles.metaText}>
            {formatDistance(route.distanceMeters)}
          </Text>
          <Text selectable style={styles.metaText}>
            {formatDuration(route.durationSeconds)}
          </Text>
        </View>
      </View>
      <Pill label={route.difficulty} tone={route.difficulty === 'Experto' ? 'red' : route.difficulty === 'Intermedio' ? 'blue' : 'green'} small />
    </Pressable>
  );
}

function OwnedCard({ route, index, privateRoute, onPress }: { route: string[]; index: number; privateRoute?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.ownedCard, pressed && styles.pressed]}>
      <Photo seed={index} tall />
      <View style={styles.flex}>
        <View style={styles.rowBetween}>
          <Text selectable style={styles.routeTitle}>
            {route[0]}
          </Text>
          <Pill label={privateRoute ? 'Privada' : 'Publica'} tone={privateRoute ? 'sand' : 'green'} small />
        </View>
        <Text selectable style={styles.owner}>
          Parque Nacional Huascaran
        </Text>
        <View style={styles.meta}>
          <Text selectable style={styles.metaText}>
            {route[2]}
          </Text>
          <Text selectable style={styles.metaText}>
            {route[3]}
          </Text>
        </View>
        <View style={styles.detailButton}>
          <Text selectable style={styles.detailButtonText}>
            Ver detalle
          </Text>
          <Text selectable style={styles.detailButtonText}>
            {'>'}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function Photo({ seed = 0, wide, tall, hero }: { seed?: number; wide?: boolean; tall?: boolean; hero?: boolean }) {
  const skies = ['#8cc5df', '#9bbde0', '#eeaf78', '#8baa72'];
  const hills = ['#285f43', '#5d6b39', '#334c43', '#173d2b'];
  return (
    <View style={[styles.photo, wide && styles.photoWide, tall && styles.photoTall, hero && styles.photoHero]}>
      <View style={[styles.photoSky, { backgroundColor: skies[seed % skies.length] }]} />
      <View style={[styles.photoHillOne, { borderBottomColor: '#e8d5a4' }]} />
      <View style={[styles.photoHillTwo, { borderBottomColor: hills[seed % hills.length] }]} />
      <View style={styles.photoWater} />
    </View>
  );
}

function PrimaryButton({
  label,
  icon,
  suffix,
  flex,
  onPress,
  disabled,
}: {
  label: string;
  icon?: string;
  suffix?: string;
  flex?: boolean;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.primary, flex && styles.flex, disabled && styles.disabled, pressed && styles.pressed]}>
      {icon && (
        <Text selectable style={styles.primaryIcon}>
          {icon}
        </Text>
      )}
      <Text selectable style={styles.primaryText}>
        {label}
      </Text>
      {suffix && (
        <Text selectable style={styles.primaryIcon}>
          {suffix}
        </Text>
      )}
    </Pressable>
  );
}

function SecondaryButton({ label, icon, flex, onPress }: { label: string; icon?: string; flex?: boolean; onPress?: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.secondary, flex && styles.flex, pressed && styles.pressed]}>
      {icon && (
        <Text selectable style={styles.secondaryIcon}>
          {icon}
        </Text>
      )}
      <Text selectable style={styles.secondaryText}>
        {label}
      </Text>
    </Pressable>
  );
}

function DangerButton({ label, onPress, disabled }: { label: string; onPress?: () => void; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.danger, disabled && styles.disabled, pressed && styles.pressed]}>
      <View style={styles.stop} />
      <Text selectable style={styles.dangerText}>
        {label}
      </Text>
    </Pressable>
  );
}

function BottomTabs({ active, navigate }: { active: string; navigate: (screen: ScreenId) => void }) {
  const tabTargets: Record<string, ScreenId> = {
    Inicio: 'home',
    Grabar: 'record',
    'Mis rutas': 'routes',
  };

  return (
    <View style={styles.tabs}>
      {['Inicio', 'Grabar', 'Mis rutas'].map((item) => (
        <Pressable
          key={item}
          accessibilityRole="tab"
          accessibilityLabel={item}
          accessibilityState={{ selected: active === item }}
          onPress={() => navigate(tabTargets[item])}
          style={({ pressed }) => [styles.tab, pressed && styles.pressed]}>
          <Text selectable style={[styles.tabIcon, active === item && styles.tabActive]}>
            {item === 'Inicio' ? '⌂' : item === 'Grabar' ? '●' : '▱'}
          </Text>
          <Text selectable style={[styles.tabLabel, active === item && styles.tabActive]}>
            {item}
          </Text>
          <View style={[styles.tabLine, { opacity: active === item ? 1 : 0 }]} />
        </Pressable>
      ))}
    </View>
  );
}

function Segmented({ values }: { values: string[] }) {
  return (
    <View style={styles.segmented}>
      {values.map((item, index) => (
        <View key={item} style={[styles.segment, index === 0 && styles.segmentActive]}>
          <Text selectable style={[styles.segmentText, index === 0 && styles.segmentTextActive]}>
            {item}
          </Text>
        </View>
      ))}
    </View>
  );
}

function Metric({ title, value, icon }: { title: string; value: string; icon: string }) {
  return (
    <View style={styles.metric}>
      <Icon label={icon} large />
      <View>
        <Text selectable style={styles.metricTitle}>
          {title}
        </Text>
        <Text selectable style={styles.metricValue}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function SmallMetric({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.smallMetric}>
      <Text selectable style={styles.smallMetricValue}>
        {value}
      </Text>
      <Text selectable style={styles.smallMetricLabel}>
        {label}
      </Text>
    </View>
  );
}

function Icon({ label, large }: { label: string; large?: boolean }) {
  return (
    <View style={[styles.iconCircle, large && styles.iconLarge]}>
      <Text selectable style={[styles.iconText, large && styles.iconTextLarge]}>
        {label}
      </Text>
    </View>
  );
}

function MiniFeature({ icon, label }: { icon: SymbolViewProps['name']; label: string }) {
  return (
    <View style={styles.feature}>
      <View style={styles.iconCircle}>
        <SymbolView name={icon} size={18} tintColor="#155136" />
      </View>
      <Text selectable style={styles.featureText}>
        {label}
      </Text>
    </View>
  );
}

function Divider() {
  return (
    <View style={styles.divider}>
      <View style={styles.dividerLine} />
      <Text selectable style={styles.dividerText}>
        o
      </Text>
      <View style={styles.dividerLine} />
    </View>
  );
}

function ChipCloud({ items }: { items: string[] }) {
  return (
    <View style={styles.chipCloud}>
      {items.map((item) => (
        <View key={item} style={styles.smallChip}>
          <Text selectable style={styles.smallChipText}>
            {item}
          </Text>
        </View>
      ))}
    </View>
  );
}

function Visibility({ title, active }: { title: string; active?: boolean }) {
  return (
    <View style={[styles.visibilityOption, active && styles.visibilityActive]}>
      <Icon label={title[0]} />
      <View style={styles.flex}>
        <Text selectable style={styles.visibilityTitle}>
          {title}
        </Text>
        <Text selectable style={styles.visibilityCopy}>
          {active ? 'Visible para toda la comunidad' : 'Solo para ti'}
        </Text>
      </View>
      <View style={[styles.radio, active && styles.radioActive]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#eef3ef' },
  rootContent: { alignItems: 'center' },
  workspaceHeader: {
    alignSelf: 'stretch',
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: '#f8faf7',
    borderBottomWidth: 1,
    borderBottomColor: '#dfe9e2',
  },
  workspaceEyebrow: { color: '#5d7567', fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  workspaceTitle: { color: '#0b3325', fontSize: 30, fontWeight: '900', letterSpacing: 0, marginTop: 4 },
  workspaceCopy: { color: '#64726b', fontSize: 14, lineHeight: 20, marginTop: 4 },
  selector: { gap: 10, paddingHorizontal: 16, paddingVertical: 14 },
  selectorChip: {
    width: 138,
    minHeight: 58,
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dfe7e1',
    justifyContent: 'center',
  },
  selectorChipActive: { backgroundColor: '#1d5c3d', borderColor: '#1d5c3d' },
  selectorTitle: { color: '#17221d', fontSize: 13, fontWeight: '900' },
  selectorTitleActive: { color: '#fff' },
  selectorCopy: { color: '#737d78', fontSize: 11, fontWeight: '700', marginTop: 3 },
  selectorCopyActive: { color: '#dcefe3' },
  pressed: { opacity: 0.76 },
  notice: {
    position: 'absolute',
    top: 54,
    left: 18,
    right: 18,
    zIndex: 50,
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: '#e7f3eb',
    borderWidth: 1,
    borderColor: '#b9dcc8',
    boxShadow: '0 8px 22px rgba(13, 65, 40, 0.18)',
    justifyContent: 'center',
  },
  noticeText: { color: '#124733', fontSize: 14, lineHeight: 19, fontWeight: '900', textAlign: 'center' },
  phone: {
    overflow: 'hidden',
    minHeight: 0,
    backgroundColor: '#fbfbf7',
    borderWidth: 1,
    borderColor: 'rgba(12, 52, 36, 0.13)',
    boxShadow: '0 20px 60px rgba(20, 47, 35, 0.18)',
  },
  status: {
    height: 44,
    paddingHorizontal: 24,
    backgroundColor: '#fbfbf7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusTime: { color: '#020504', fontSize: 15, fontWeight: '900' },
  statusRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusMini: { color: '#020504', fontSize: 11, fontWeight: '900' },
  battery: { width: 24, height: 12, borderWidth: 2, borderColor: '#020504', borderRadius: 3 },
  hero: {
    minHeight: 148,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 18,
    backgroundColor: '#f8f7ef',
    justifyContent: 'flex-end',
  },
  heroCenter: { alignItems: 'center', minHeight: 174 },
  heroTitle: { color: '#073d2d', fontSize: 34, lineHeight: 38, fontWeight: '900', letterSpacing: 0, maxWidth: 310 },
  heroCopy: { color: '#35423f', fontSize: 18, lineHeight: 24, marginTop: 4, maxWidth: 300 },
  textCenter: { textAlign: 'center' },
  mountains: { ...StyleSheet.absoluteFill, overflow: 'hidden', opacity: 0.78 },
  mountain: { position: 'absolute', width: 210, height: 110, transform: [{ rotate: '45deg' }] },
  mountainOne: { right: -24, bottom: 28, backgroundColor: '#d8e9e1' },
  mountainTwo: { right: 60, bottom: 0, backgroundColor: '#b9d5c7' },
  mountainThree: { left: -48, bottom: -30, backgroundColor: '#789b7b' },
  tree: { position: 'absolute', bottom: 0, width: 18, height: 50, borderRadius: 9, backgroundColor: '#2c5f3f' },
  content: { gap: 12, padding: 14, backgroundColor: '#f7f8f4' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  flex: { flex: 1 },
  sectionTitle: { color: '#060807', fontSize: 20, fontWeight: '900', letterSpacing: 0 },
  link: { color: '#155136', fontSize: 14, fontWeight: '800', textDecorationLine: 'underline' },
  search: {
    minHeight: 58,
    borderRadius: 29,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e8e4',
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  searchClearButton: { alignItems: 'center', justifyContent: 'center', minHeight: 32, minWidth: 32 },
  placeholder: { color: '#7d8683', fontSize: 16, flex: 1 },
  searchInput: { flex: 1, minWidth: 0, color: '#17221d', fontSize: 16, paddingVertical: 10, outlineColor: 'transparent', outlineStyle: 'solid', outlineWidth: 0 },
  filterPillActive: { borderRadius: 18, boxShadow: '0 0 0 2px rgba(21,81,54,0.28)' },
  pillGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { minHeight: 36, minWidth: 98, paddingHorizontal: 14, borderRadius: 18, backgroundColor: '#eef1ef', alignItems: 'center', justifyContent: 'center' },
  pillSmall: { minWidth: 74, minHeight: 32 },
  greenPill: { backgroundColor: '#dcefe4' },
  bluePill: { backgroundColor: '#dce5ff' },
  redPill: { backgroundColor: '#f8dedc' },
  sandPill: { backgroundColor: '#f1eadc' },
  pillText: { color: '#4c5752', fontSize: 13, fontWeight: '900' },
  greenText: { color: '#155136' },
  blueText: { color: '#1550b8' },
  redText: { color: '#9b1d1e' },
  sandText: { color: '#70491c' },
  routeCard: {
    minHeight: 92,
    flexDirection: 'row',
    gap: 12,
    padding: 10,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e8ece8',
    alignItems: 'center',
  },
  routeTitle: { color: '#030605', fontSize: 18, fontWeight: '900', letterSpacing: 0 },
  bigRouteTitle: { color: '#030605', fontSize: 29, fontWeight: '900', letterSpacing: 0 },
  owner: { color: '#5e6864', fontSize: 13, fontWeight: '600', marginTop: 3 },
  meta: { flexDirection: 'row', gap: 12, marginTop: 8 },
  metaText: { color: '#17201c', fontSize: 13, fontWeight: '800' },
  heart: { color: '#111a18', fontSize: 24, fontWeight: '700' },
  routeThumb: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#dce8d7' },
  photo: { width: 112, height: 72, borderRadius: 11, overflow: 'hidden', backgroundColor: '#8cc5df' },
  photoTall: { width: 104, height: 124 },
  photoWide: { flex: 1, height: 96 },
  photoHero: { width: '100%', height: 190, borderRadius: 16 },
  photoSky: { ...StyleSheet.absoluteFill },
  photoHillOne: {
    position: 'absolute',
    left: -30,
    bottom: 2,
    width: 0,
    height: 0,
    borderLeftWidth: 80,
    borderRightWidth: 80,
    borderBottomWidth: 84,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  photoHillTwo: {
    position: 'absolute',
    right: -40,
    bottom: -2,
    width: 0,
    height: 0,
    borderLeftWidth: 100,
    borderRightWidth: 100,
    borderBottomWidth: 108,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  photoWater: { position: 'absolute', left: 16, right: 16, bottom: 8, height: 12, borderRadius: 12, backgroundColor: '#79c2cb' },
  primary: { minHeight: 58, borderRadius: 29, paddingHorizontal: 18, backgroundColor: '#1f6a43', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 12 },
  primaryText: { color: '#fff', fontSize: 20, fontWeight: '900', letterSpacing: 0 },
  primaryIcon: { color: '#fff', fontSize: 22, fontWeight: '900' },
  secondary: { minHeight: 48, borderRadius: 24, paddingHorizontal: 14, borderWidth: 1, borderColor: '#b9ccc3', backgroundColor: '#fbfdfb', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10 },
  secondaryText: { color: '#124733', fontSize: 15, fontWeight: '900', textAlign: 'center' },
  secondaryIcon: { color: '#124733', fontSize: 17, fontWeight: '900' },
  danger: { flex: 1, minHeight: 58, borderRadius: 18, backgroundColor: '#c84f48', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 12 },
  dangerText: { color: '#fff', fontSize: 18, fontWeight: '900' },
  stop: { width: 18, height: 18, borderRadius: 4, backgroundColor: '#fff' },
  tabs: { height: 78, flexShrink: 0, backgroundColor: '#fff', borderTopWidth: 1, borderColor: '#ecf0ed', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  tab: { flex: 1, height: 78, justifyContent: 'center', alignItems: 'center', gap: 4, minWidth: 78 },
  tabIcon: { color: '#58615f', fontSize: 20, fontWeight: '900' },
  tabLabel: { color: '#58615f', fontSize: 13, fontWeight: '700' },
  tabActive: { color: '#155136' },
  tabLine: { width: 34, height: 3, borderRadius: 4, backgroundColor: '#155136' },
  authCard: { margin: 14, marginTop: -10, paddingHorizontal: 20, paddingVertical: 22, borderRadius: 24, backgroundColor: '#fff', gap: 12, boxShadow: '0 16px 44px rgba(25,55,41,0.12)' },
  authForm: { width: '94%', maxWidth: 340, alignSelf: 'center', gap: 12 },
  logo: { alignSelf: 'center', width: 80, height: 80, borderRadius: 40, backgroundColor: '#dceee4', alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#155136', fontSize: 16, fontWeight: '900' },
  authTitle: { color: '#073d2d', fontSize: 29, fontWeight: '900', textAlign: 'center', letterSpacing: 0 },
  authCopy: { color: '#717a7a', fontSize: 16, lineHeight: 22, textAlign: 'center' },
  field: { minHeight: 56, width: '100%', borderRadius: 14, borderWidth: 1, borderColor: '#c8d4ce', flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, backgroundColor: '#fff' },
  fieldFocused: { borderColor: '#1f6a43', borderWidth: 2, boxShadow: '0 0 0 3px rgba(31,106,67,0.10)' },
  fieldInput: {
    flex: 1,
    minWidth: 0,
    color: '#17221d',
    fontSize: 16,
    paddingVertical: 12,
    borderWidth: 0,
    outlineColor: 'transparent',
    outlineStyle: 'solid',
    outlineWidth: 0,
    backgroundColor: 'transparent',
  },
  formFeedback: { color: '#9b1d1e', fontSize: 14, lineHeight: 20, fontWeight: '700' },
  disabled: { opacity: 0.6 },
  fieldIcon: { color: '#39413f', fontSize: 17, fontWeight: '900', width: 20, textAlign: 'center' },
  fieldText: { color: '#9299a2', fontSize: 16, flex: 1 },
  fieldTrail: { color: '#1b3327', fontSize: 11, fontWeight: '800' },
  forgot: { color: '#155136', fontSize: 13, fontWeight: '700', alignSelf: 'flex-end' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#d7ddd9' },
  dividerText: { color: '#5d6863', fontSize: 15, fontWeight: '800' },
  features: { flexDirection: 'row', justifyContent: 'space-around', padding: 16, gap: 10 },
  feature: { flex: 1, alignItems: 'center', gap: 7 },
  featureText: { color: '#60706a', textAlign: 'center', fontSize: 12, lineHeight: 16, fontWeight: '700' },
  iconCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#e4f0e8', alignItems: 'center', justifyContent: 'center' },
  iconLarge: { width: 52, height: 52, borderRadius: 26 },
  iconText: { color: '#155136', fontSize: 14, fontWeight: '900' },
  iconTextLarge: { fontSize: 22 },
  sheet: { padding: 16, gap: 12, backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 8 },
  profilePhoto: { width: 94, height: 94, borderRadius: 47, borderWidth: 2, borderStyle: 'dashed', borderColor: '#8ab09f', backgroundColor: '#e5f1ea', alignItems: 'center', justifyContent: 'center' },
  profilePreview: { width: 90, height: 90, borderRadius: 45 },
  profileIcon: { color: '#155136', fontSize: 24, fontWeight: '900' },
  addCircle: { position: 'absolute', right: -2, bottom: 8, width: 36, height: 36, borderRadius: 18, backgroundColor: '#2f6d49', alignItems: 'center', justifyContent: 'center' },
  formTitle: { color: '#050806', fontSize: 18, fontWeight: '900', letterSpacing: 0 },
  lightText: { fontWeight: '500', color: '#313b39' },
  formCopy: { color: '#59635f', fontSize: 15, lineHeight: 20, fontWeight: '500' },
  helpText: { color: '#606b67', fontSize: 13, fontWeight: '600' },
  centerLink: { textAlign: 'center', color: '#4e5a55', fontSize: 15, fontWeight: '700' },
  linkStrong: { color: '#155136', fontWeight: '900', textDecorationLine: 'underline' },
  segmented: { flexDirection: 'row', padding: 5, borderRadius: 21, backgroundColor: '#fff', borderWidth: 1, borderColor: '#d9e1dc' },
  segment: { flex: 1, minHeight: 44, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: '#1f6a43' },
  segmentText: { color: '#1c2521', fontSize: 15, fontWeight: '800' },
  segmentTextActive: { color: '#fff' },
  ownedCard: { flexDirection: 'row', gap: 12, padding: 10, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e8ece8' },
  detailButton: { minHeight: 36, marginTop: 8, paddingHorizontal: 14, borderRadius: 18, backgroundColor: '#f0f2f1', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  detailButtonText: { color: '#26322e', fontSize: 14, fontWeight: '800' },
  banner: { minHeight: 70, padding: 14, borderRadius: 18, backgroundColor: '#eaf4ed', flexDirection: 'row', alignItems: 'center', gap: 12 },
  liveDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#16814f' },
  bannerTitle: { color: '#155136', fontSize: 16, fontWeight: '900' },
  bannerCopy: { color: '#475a52', fontSize: 13, fontWeight: '600', marginTop: 3 },
  metrics: { flexDirection: 'row', gap: 12 },
  metric: { flex: 1, minHeight: 86, borderRadius: 18, backgroundColor: '#fff', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  metricTitle: { color: '#69736f', fontSize: 13, fontWeight: '700' },
  metricValue: { color: '#101820', fontSize: 24, fontWeight: '900', marginTop: 4 },
  map: { height: 342, borderRadius: 18, overflow: 'hidden', backgroundColor: '#dce8d7' },
  mapSmall: { height: 160 },
  mapGrid: { ...StyleSheet.absoluteFill, backgroundColor: '#dce8d7', borderWidth: 18, borderColor: 'rgba(118,151,124,0.18)' },
  path: { position: 'absolute', height: 9, borderRadius: 8, backgroundColor: '#247049' },
  pathOne: { left: 40, right: 190, bottom: 94, transform: [{ rotate: '-24deg' }] },
  pathTwo: { left: 120, right: 118, bottom: 160, transform: [{ rotate: '28deg' }] },
  pathThree: { left: 202, right: 34, bottom: 218, transform: [{ rotate: '-35deg' }] },
  mapPin: { position: 'absolute', width: 30, height: 30, borderRadius: 15, backgroundColor: '#23824f', borderWidth: 4, borderColor: '#fff' },
  mapStart: { left: 44, bottom: 80 },
  mapEnd: { right: 44, top: 76 },
  location: { position: 'absolute', right: 48, top: 74, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#fff' },
  locationText: { color: '#1a2b22', fontSize: 13, fontWeight: '900' },
  scale: { position: 'absolute', right: 22, bottom: 16, color: '#15211b', fontSize: 12, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 12 },
  note: { padding: 14, borderRadius: 16, backgroundColor: '#eaf4ed', flexDirection: 'row', alignItems: 'center', gap: 12 },
  noteText: { color: '#24543c', fontSize: 14, lineHeight: 20, flex: 1, fontWeight: '600' },
  pauseBox: { padding: 16, borderRadius: 18, backgroundColor: '#fff2db', flexDirection: 'row', alignItems: 'center', gap: 12 },
  pauseIcon: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#ffdda6', alignItems: 'center', justifyContent: 'center' },
  pauseText: { color: '#e58a15', fontSize: 24, fontWeight: '900' },
  timer: { color: '#040806', fontSize: 15, fontWeight: '900', fontVariant: ['tabular-nums'] },
  pointTypes: { flexDirection: 'row', gap: 8 },
  pointType: { flex: 1, minHeight: 76, borderRadius: 14, borderWidth: 1, borderColor: '#e0e4e3', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', gap: 5 },
  pointTypeActive: { borderColor: '#6fa88b', backgroundColor: '#eaf4ed' },
  pointLetter: { color: '#48504e', fontSize: 20, fontWeight: '900' },
  pointText: { color: '#222c28', fontSize: 11, fontWeight: '800', textAlign: 'center' },
  textArea: { minHeight: 92, borderRadius: 14, borderWidth: 1, borderColor: '#d1d8d6', padding: 14, backgroundColor: '#fff' },
  counter: { color: '#7d858c', fontSize: 13, fontWeight: '700', alignSelf: 'flex-end', marginTop: 18 },
  services: { padding: 12, borderRadius: 18, backgroundColor: '#fff', gap: 8 },
  serviceGrid: { flexDirection: 'row', gap: 8 },
  serviceCard: { flex: 1, minHeight: 100, borderRadius: 12, backgroundColor: '#edf6ef', alignItems: 'center', justifyContent: 'center', gap: 6 },
  serviceLetter: { color: '#155136', fontSize: 20, fontWeight: '900' },
  serviceText: { color: '#143d2d', fontSize: 11, fontWeight: '900', textAlign: 'center' },
  check: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: '#9ca4a2' },
  checkActive: { backgroundColor: '#2f6d49', borderColor: '#2f6d49', alignItems: 'center', justifyContent: 'center' },
  checkMark: { color: '#fff', fontSize: 16, fontWeight: '900' },
  success: { padding: 14, borderRadius: 18, backgroundColor: '#e7f3eb', flexDirection: 'row', alignItems: 'center', gap: 12 },
  successCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#2f6d49', alignItems: 'center', justifyContent: 'center' },
  successMark: { color: '#fff', fontSize: 28, fontWeight: '900' },
  summary: { padding: 14, borderRadius: 18, backgroundColor: '#fff', flexDirection: 'row', justifyContent: 'space-around', gap: 8 },
  smallMetric: { flex: 1, alignItems: 'center' },
  smallMetricValue: { color: '#07100b', fontSize: 18, fontWeight: '900', textAlign: 'center' },
  smallMetricLabel: { color: '#69736f', fontSize: 12, fontWeight: '700', textAlign: 'center', marginTop: 4 },
  photoRow: { flexDirection: 'row', gap: 10 },
  upload: { width: 108, minHeight: 96, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: '#aebbb7', alignItems: 'center', justifyContent: 'center', gap: 6 },
  uploadPlus: { color: '#7d8a86', fontSize: 26, fontWeight: '900' },
  chipCloud: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  smallChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: '#e8f1eb' },
  smallChipText: { color: '#163d2d', fontSize: 12, fontWeight: '700' },
  visibility: { flexDirection: 'row', gap: 10 },
  visibilityOption: { flex: 1, minHeight: 76, padding: 10, borderRadius: 14, borderWidth: 1, borderColor: '#d6dfdb', backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', gap: 8 },
  visibilityActive: { borderColor: '#155136', backgroundColor: '#edf7f0' },
  visibilityTitle: { color: '#0b1812', fontSize: 15, fontWeight: '900' },
  visibilityCopy: { color: '#637069', fontSize: 10, fontWeight: '700', marginTop: 3 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#31433c' },
  radioActive: { borderWidth: 5, borderColor: '#155136' },
  detailContent: { gap: 12, padding: 14, backgroundColor: '#fbfbf7' },
  detailBar: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  roundButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(0,0,0,0.12)' },
  roundText: { color: '#103929', fontSize: 22, fontWeight: '900' },
  detailHeader: { color: '#0a2520', fontSize: 18, fontWeight: '900' },
  kebab: { color: '#0a2520', fontSize: 22, fontWeight: '900' },
  panel: { padding: 12, borderRadius: 16, backgroundColor: '#fff', gap: 10 },
  pointRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 10 },
  pointDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#2f8a4c' },
  pointRowTitle: { color: '#101713', fontSize: 14, fontWeight: '900' },
  pointRowCopy: { color: '#59635f', fontSize: 12, marginTop: 2 },
  pointRowTrail: { color: '#43514c', fontSize: 12, fontWeight: '900' },
  comment: { minHeight: 72, padding: 10, borderRadius: 14, borderWidth: 1, borderColor: '#e3e9e5', flexDirection: 'row', gap: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#8db8d1' },
  commentName: { color: '#111815', fontSize: 13, fontWeight: '900' },
  commentCopy: { color: '#4f5c58', fontSize: 12, lineHeight: 17, marginTop: 3 },
});
