# Pruebas de GPS y rutas en Android

## Entorno recomendado

Usar Android Studio Emulator para repetir recorridos GPS y una APK instalada
en un telefono Android para validar precision real y funcionamiento sin internet.
El navegador de la PC sirve para formularios, pero no reproduce el receptor GPS
del celular. El emulador tampoco demuestra precision real en montana.

### Emulador

1. Android Studio > Device Manager > Create Virtual Device. Crear un Pixel con
   una imagen Android compatible e iniciarlo. En esta PC el SDK esta instalado,
   pero aun no hay un dispositivo virtual creado.
2. En la terminal, dentro de `trekking-app`, ejecutar `npm install` y
   `npx expo start --android`. No hace falta que el celular comparta Wi-Fi.
3. En el emulador abrir Extended Controls > Location > Routes o GPX/KML.
4. Importar `tests/fixtures/trekking-walk.gpx` y reproducir a velocidad 1x.
   Los puntos son sinteticos, solo para pruebas. Iniciar la grabacion antes
   de reproducirlos. Permitir ubicacion precisa.
5. Verificar que aumentan distancia y tiempo. Pausar la emision GPS mas de
   15 segundos; al recuperar senal debe aparecer otro segmento sin sumar
   una linea recta entre posiciones desconocidas.

Referencia: https://developer.android.com/studio/run/emulator-extended-controls

### APK independiente de Metro

```powershell
cd "C:\Users\PC\Documents\ChatGPT\New project\trekking-app"
npx eas-cli@latest login
npx eas-cli@latest build --platform android --profile preview
```

La primera compilacion pide vincular el proyecto Expo y definir su identificador
Android. Configurar en EAS `EXPO_PUBLIC_SUPABASE_URL` y
`EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (o la clave anon compatible).
Nunca incluir service_role, contrasena de la base de datos ni secretos.
`eas.json` ya incluye el perfil APK; no se ha lanzado una compilacion en la nube.
EAS requiere una cuenta y esta sujeto a los limites del plan.
Descargar el APK desde el enlace de EAS e instalarlo en el telefono.

Referencia: https://docs.expo.dev/build-reference/apk/

## Prueba de campo

1. Iniciar sesion con internet para habilitar sincronizacion y salir al exterior.
2. Grabar un recorrido conocido, comparar distancia y tiempo con una referencia.
3. Quitar datos moviles y Wi-Fi, manteniendo Ubicacion activada. El GPS no necesita
   cobertura celular, aunque la primera ubicacion puede tardar mas sin asistencia.
4. Agregar un punto con nombre/servicios y finalizar. Guardar nombre, descripcion,
   dificultad, visibilidad y foto. Confirmar que aparece en Mis rutas.
5. Cerrar y abrir la app: la copia local debe conservarse. Con internet, abrir
   Mis rutas y pulsar Sincronizar; comprobar la misma ruta con esa cuenta en otro
   dispositivo. Durante grabacion se intenta sincronizar cada 30 segundos.
6. Repetir con permiso denegado, precision aproximada y perdida de senal.

## Comportamiento actual y limites

- Coordenadas nativas de `expo-location`, distancia geodesica acumulada y reloj
  activo actualizado cada segundo. Autoguardado local cada cinco segundos y en
  pausas/finalizacion. Un cierre forzado puede perder los ultimos cinco segundos.
- Se filtran coordenadas invalidas, lecturas antiguas, saltos superiores a
  30 km/h y desplazamientos menores al umbral de ruido. Precision de 50 a 150 m
  se admite como aproximada; por encima de 150 m no se agrega al trazado.
- Sin lecturas validas se conserva la ruta. El tiempo sigue y la distancia no
  aumenta. No se inventa el camino recorrido durante la ausencia del GPS.
- La grabacion actual es **en primer plano**. Mantiene la pantalla encendida;
  al salir de la app se pausa y al volver hay que continuar. Grabacion con pantalla
  bloqueada requiere un servicio Android/TaskManager y validacion adicional.
- Leaflet y sus recursos se incluyen en la app: no dependen de un CDN para
  arrancar. Los tiles de OpenStreetMap **requieren internet**; no hay descarga
  offline de mapas. Sin tiles, se conserva el trazado y se muestra un aviso.
- Guardado local disponible sin cuenta. Solo las rutas iniciadas con una cuenta
  se sincronizan con Supabase; las rutas de invitado permanecen en ese dispositivo.
- No se ha verificado todavia en un telefono fisico ni compilado un APK.

## Pruebas automatizadas sin capturas

```powershell
npm test
npm run typecheck
npx expo export --platform web --platform android
```

Con `playwright` instalado en el entorno de pruebas, Chrome y Metro en 8081:
`node scripts/test-recording-web.mjs`. Prueba GPS simulado, interrupcion de senal,
formularios offline, persistencia al recargar, capas del mapa y barra inferior.
No toma capturas ni envia ubicaciones simuladas a Supabase.

El analizador de seguridad remoto detecto una advertencia preexistente sobre
`public.rls_auto_enable()` ejecutable por anon/authenticated. No pertenece al
guardado GPS; revisar sus permisos antes de publicar la app.
