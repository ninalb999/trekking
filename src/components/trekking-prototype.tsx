import { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRecording } from '../hooks/use-recording';
import { formatElapsed } from '../lib/recording';
import RouteMap from './route-map';

import { getSession, signInWithPassword, signOut, signUp } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase';

type ScreenId = 'home' | 'login' | 'register' | 'routes' | 'record' | 'point' | 'finish' | 'detail';

const ROUTES = [
  ['Laguna Escondida', 'Andes Explorer', '12.4 km', '5 h 30 min', 'Novato', 'green'],
  ['Cerro Mirador', 'RutaLibre', '8.7 km', '3 h 20 min', 'Intermedio', 'blue'],
  ['Pico del Sol', 'Montana Viva', '15.2 km', '7 h 10 min', 'Experto', 'red'],
  ['Bosque del Rio', 'CaminaMas', '6.1 km', '2 h 45 min', 'Novato', 'green'],
  ['Ruta de las Rocas', 'Aventura Natural', '10.3 km', '4 h 15 min', 'Intermedio', 'blue'],
];

export function TrekkingPrototype() {
  const recording = useRecording();
  const [screen, setCurrentScreen] = useState<ScreenId>('login');
  const [activeTab, setActiveTab] = useState('Inicio');
  const [authenticated, setAuthenticated] = useState(false);
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

  useEffect(() => {
    const showHome = () => {
      setActiveTab('Inicio');
      setCurrentScreen('home');
    };
    const { data: subscription } = getSupabase().auth.onAuthStateChange((event, session) => {
      setAuthenticated(Boolean(session));
      if (session) showHome();
      if (event === 'SIGNED_OUT') setCurrentScreen('login');
    });
    getSession().then(({ data }) => {
      if (data.session) {
        setAuthenticated(true);
        showHome();
      }
    }).catch(() => {});
    return () => subscription.subscription.unsubscribe();
  }, []);

  const logOut = async () => {
    const { error } = await signOut();
    if (!error) setScreen('login');
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
        {screen === 'home' && <HomeScreen navigate={setScreen} authenticated={authenticated} onSignOut={logOut} />}
        {screen === 'login' && <LoginScreen navigate={setScreen} />}
        {screen === 'register' && <RegisterScreen navigate={setScreen} />}
        {screen === 'routes' && <MyRoutesScreen navigate={setScreen} />}
        {screen === 'record' && <RecordingScreen navigate={setScreen} recording={recording} />}
        {screen === 'point' && <PointScreen navigate={setScreen} elapsed={recording.elapsed} />}
        {screen === 'finish' && <FinishScreen navigate={setScreen} recording={recording} />}
        {screen === 'detail' && <DetailScreen navigate={setScreen} />}
        </ScrollView>
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

function HomeScreen({ navigate, authenticated, onSignOut }: {
  navigate: (screen: ScreenId) => void;
  authenticated: boolean;
  onSignOut: () => void;
}) {
  return (
    <>
      <Hero title="Rutas de Trekking" subtitle="Explora. Camina. Comparte." />
      <View style={styles.content}>
        <SecondaryButton label={authenticated ? 'Cerrar sesión' : 'Iniciar sesión / Crear cuenta'} onPress={authenticated ? onSignOut : () => navigate('login')} />
        <SearchBox text="Buscar rutas, lugares o creadores..." />
        <View style={styles.rowBetween}>
          <View style={styles.row}>
            <Icon label="F" />
            <Text selectable style={styles.sectionTitle}>
              Filtros
            </Text>
          </View>
          <Text selectable style={styles.link}>
            Limpiar todo
          </Text>
        </View>
        <View style={styles.pillGrid}>
          <Pill label="Novato" tone="green" />
          <Pill label="Intermedio" tone="sand" />
          <Pill label="Experto" tone="red" />
          <Pill label="Mas recientes" />
          <Pill label="Mas visitadas" />
          <Pill label="Cerca de mi" />
        </View>
        {ROUTES.map((route, index) => (
          <RouteCard key={route[0]} route={route} index={index} onPress={() => navigate('detail')} />
        ))}
        <PrimaryButton label="Grabar ruta" icon="+" onPress={() => navigate('record')} />
      </View>
    </>
  );
}

function LoginScreen({ navigate }: { navigate: (screen: ScreenId) => void }) {
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
      if (data.session) navigate('home');
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
          Iniciar sesion
        </Text>
        <Text selectable style={styles.authCopy}>
          Continua tu aventura y descubre nuevas rutas
        </Text>
        <Field icon="M" text="Correo" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        <Field icon="L" text="Contraseña" value={password} onChangeText={setPassword} secure />
        <Text selectable style={styles.forgot}>
          Olvidaste tu contrasena?
        </Text>
        {!!feedback && <Text selectable accessibilityRole="alert" style={styles.formFeedback}>{feedback}</Text>}
        <PrimaryButton label={loading ? 'Ingresando...' : 'Ingresar'} suffix="→" onPress={login} disabled={loading} />
        <Divider />
        <SecondaryButton label="No tienes cuenta? Registrate" onPress={() => navigate('register')} />
      </View>
      <View style={styles.features}>
        <MiniFeature icon="↟" label="Descubre nuevos lugares" />
        <MiniFeature icon="◎" label="Comparte tus experiencias" />
        <MiniFeature icon="▱" label="Vive la naturaleza" />
      </View>
    </>
  );
}

function RegisterScreen({ navigate }: { navigate: (screen: ScreenId) => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState('');

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

    setLoading(true);
    try {
      const { data, error } = await signUp(normalizedEmail, password, fullName, phone.trim());
      if (error) {
        setFeedback(error.code === 'user_already_exists' || /already registered/i.test(error.message)
          ? 'Ya existe una cuenta con ese correo.'
          : error.message);
        return;
      }
      if (data.session) {
        navigate('home');
      } else {
        setFeedback('Si el registro fue aceptado, revisa tu correo para confirmar la cuenta.');
      }
    } catch {
      setFeedback('No se pudo completar el registro. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Hero title="Crear cuenta" subtitle="Unete a nuestra comunidad y comienza a explorar." />
      <View style={styles.sheet}>
        <View style={styles.profileRow}>
          <View style={styles.profilePhoto}>
            <Text selectable style={styles.profileIcon}>
              C
            </Text>
            <View style={styles.addCircle}>
              <Text selectable style={styles.addText}>
                +
              </Text>
            </View>
          </View>
          <View style={styles.flex}>
            <Text selectable style={styles.formTitle}>
              Foto de perfil <Text style={styles.lightText}>(opcional)</Text>
            </Text>
            <Text selectable style={styles.formCopy}>
              Agrega una foto para que otros exploradores te reconozcan.
            </Text>
          </View>
        </View>
        <Field icon="P" text="Nombre completo" value={name} onChangeText={setName} autoCapitalize="words" />
        <Field icon="T" text="Teléfono (opcional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <Field icon="M" text="Correo electrónico" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        <Field icon="L" text="Contraseña" value={password} onChangeText={setPassword} secure />
        <Text selectable style={styles.helpText}>
          Minimo 8 caracteres, con letras y numeros.
        </Text>
        <Field icon="L" text="Confirmar contraseña" value={confirmation} onChangeText={setConfirmation} secure />
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
          dom={{ useExpoDOMWebView: false, style: { height: 342 }, scrollEnabled: false }}
        />
        {!!error && <Text accessibilityRole="alert" style={styles.formCopy}>{error}</Text>}
        <Pressable accessibilityRole="button" disabled={busy} onPress={active ? pause : () => void begin()} style={[styles.detailButton, busy && { opacity: 0.5 }]}>
          <Text style={styles.detailButtonText}>{busy ? 'Buscando GPS...' : active ? 'Pausar ruta' : track.status === 'paused' ? 'Continuar ruta' : 'Iniciar grabacion'}</Text>
        </Pressable>
        {(active || track.status === 'paused') && <>
        <View style={styles.actions}>
          <SecondaryButton label="Agregar punto" icon="P" flex onPress={() => navigate('point')} />
          <DangerButton label="Finalizar" onPress={() => { finish(); navigate('finish'); }} />
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
        <Text selectable style={styles.sectionTitle}>
          Foto principal
        </Text>
        <View style={styles.photoRow}>
          <Photo wide />
          <View style={styles.upload}>
            <Text selectable style={styles.uploadPlus}>
              +
            </Text>
            <Text selectable style={styles.formCopy}>
              Subir foto
            </Text>
          </View>
        </View>
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

function DetailScreen({ navigate }: { navigate: (screen: ScreenId) => void }) {
  return (
    <View style={styles.detailContent}>
      <View style={styles.detailBar}>
        <RoundButton label="<" onPress={() => navigate('routes')} />
        <Text selectable style={styles.detailHeader}>
          Detalle de ruta
        </Text>
        <Text selectable style={styles.kebab}>
          ⋮
        </Text>
      </View>
      <Photo hero />
      <View style={styles.rowBetween}>
        <View style={styles.flex}>
          <Text selectable style={styles.bigRouteTitle}>
            Laguna Escondida
          </Text>
          <Text selectable style={styles.owner}>
            Por Andes Explorer
          </Text>
        </View>
        <Pill label="Publica" tone="green" small />
      </View>
      <View style={styles.summary}>
        <SmallMetric value="12.4 km" label="Distancia" />
        <SmallMetric value="5 h 30 min" label="Duracion" />
        <SmallMetric value="Novato" label="Dificultad" />
      </View>
      <View style={styles.actions}>
        <PrimaryButton label="Descargar" icon="D" flex />
        <SecondaryButton label="Guardar" icon="B" flex />
      </View>
      <Panel title="Mapa de la ruta">
        <MapCard small />
      </Panel>
      <Panel title="Equipo indispensable">
        <ChipCloud items={['Mochila', 'Botas de trekking', 'Agua (2L+)', 'Ropa termica', 'Impermeable', 'Bastones']} />
      </Panel>
      <Panel title="Puntos de la ruta">
        {['Inicio', 'Campamento 1', 'Mirador', 'Final - Laguna Escondida'].map((item, index) => (
          <View key={item} style={styles.pointRow}>
            <View style={styles.pointDot} />
            <View style={styles.flex}>
              <Text selectable style={styles.pointRowTitle}>
                {item}
              </Text>
              <Text selectable style={styles.pointRowCopy}>
                Altitud: {2450 + index * 320} m
              </Text>
            </View>
            <Text selectable style={styles.pointRowTrail}>
              {index === 0 ? '0.0 km' : '⌄'}
            </Text>
          </View>
        ))}
      </Panel>
      <Panel title="Comentarios">
        <View style={styles.comment}>
          <View style={styles.avatar} />
          <View style={styles.flex}>
            <Text selectable style={styles.commentName}>
              Camila R.
            </Text>
            <Text selectable style={styles.commentCopy}>
              Increible ruta. Las vistas de la laguna son espectaculares.
            </Text>
          </View>
        </View>
      </Panel>
    </View>
  );
}

function SearchBox({ text }: { text: string }) {
  return (
    <View style={styles.search}>
      <Text selectable style={styles.searchIcon}>
        Q
      </Text>
      <Text selectable style={styles.placeholder}>
        {text}
      </Text>
    </View>
  );
}

function Field({ icon, text, trail, value, onChangeText, keyboardType, autoCapitalize, secure }: {
  icon?: string;
  text: string;
  trail?: string;
  value?: string;
  onChangeText?: (value: string) => void;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words';
  secure?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <View style={styles.field}>
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
          onChangeText={onChangeText}
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

function RouteCard({ route, index, onPress }: { route: string[]; index: number; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.routeCard, pressed && styles.pressed]}>
      <Photo seed={index} />
      <View style={styles.flex}>
        <Text selectable style={styles.routeTitle}>
          {route[0]}
        </Text>
        <Text selectable style={styles.owner}>
          Por {route[1]}
        </Text>
        <View style={styles.meta}>
          <Text selectable style={styles.metaText}>
            {route[2]}
          </Text>
          <Text selectable style={styles.metaText}>
            {route[3]}
          </Text>
        </View>
      </View>
      <Text selectable style={styles.heart}>
        ♡
      </Text>
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

function MapCard({ recording, small }: { recording?: boolean; small?: boolean }) {
  return (
    <View style={[styles.map, small && styles.mapSmall]}>
      <View style={styles.mapGrid} />
      <View style={[styles.path, styles.pathOne]} />
      <View style={[styles.path, styles.pathTwo]} />
      <View style={[styles.path, styles.pathThree]} />
      <View style={[styles.mapPin, styles.mapStart]} />
      <View style={[styles.mapPin, styles.mapEnd]} />
      {recording && (
        <View style={styles.location}>
          <Text selectable style={styles.locationText}>
            Tu ubicacion
          </Text>
        </View>
      )}
      <Text selectable style={styles.scale}>
        0     500 m     1 km
      </Text>
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
    <Pressable onPress={onPress} style={({ pressed }) => [styles.secondary, flex && styles.flex, pressed && styles.pressed]}>
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

function DangerButton({ label, onPress }: { label: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.danger, pressed && styles.pressed]}>
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

function MiniFeature({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={styles.feature}>
      <Icon label={icon} />
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

function RoundButton({ label, onPress }: { label: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.roundButton, pressed && styles.pressed]}>
      <Text selectable style={styles.roundText}>
        {label}
      </Text>
    </Pressable>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.panel}>
      <Text selectable style={styles.sectionTitle}>
        {title}
      </Text>
      {children}
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
  searchIcon: { color: '#1d2b27', fontSize: 20, fontWeight: '900' },
  placeholder: { color: '#7d8683', fontSize: 16, flex: 1 },
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
  authCard: { margin: 14, marginTop: -10, padding: 20, borderRadius: 24, backgroundColor: '#fff', gap: 12, boxShadow: '0 16px 44px rgba(25,55,41,0.12)' },
  logo: { alignSelf: 'center', width: 80, height: 80, borderRadius: 40, backgroundColor: '#dceee4', alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#155136', fontSize: 16, fontWeight: '900' },
  authTitle: { color: '#073d2d', fontSize: 29, fontWeight: '900', textAlign: 'center', letterSpacing: 0 },
  authCopy: { color: '#717a7a', fontSize: 16, lineHeight: 22, textAlign: 'center' },
  field: { minHeight: 56, borderRadius: 14, borderWidth: 1, borderColor: '#d1d8d6', flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, backgroundColor: '#fff' },
  fieldInput: { flex: 1, minWidth: 0, color: '#17221d', fontSize: 16, paddingVertical: 12 },
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
  profileIcon: { color: '#155136', fontSize: 24, fontWeight: '900' },
  addCircle: { position: 'absolute', right: -2, bottom: 8, width: 36, height: 36, borderRadius: 18, backgroundColor: '#2f6d49', alignItems: 'center', justifyContent: 'center' },
  addText: { color: '#fff', fontSize: 26, lineHeight: 28 },
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
