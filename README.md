# Trekking Bolivia

App Expo/React Native para registrar rutas de trekking con GPS, guardar copia local y sincronizar con Supabase.

## Requisitos

- Node.js instalado.
- Expo Go instalado en el celular Android.
- Archivo `.env.local` en la raiz del proyecto con las variables de Supabase.

Ejemplo:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://khhnfbwzxklzkegwfapd.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=tu_publishable_key
# Opcional: dominio web público usado en los enlaces al compartir rutas
EXPO_PUBLIC_APP_URL=https://tu-dominio-publico.example.com
```

El archivo `.env.local` no se sube a GitHub.

Si `EXPO_PUBLIC_APP_URL` está configurada, las rutas públicas se comparten con un enlace HTTPS como `https://tu-dominio-publico.example.com/rutas/<id>`. Si no está configurada, se utiliza el enlace profundo `trekkingapp://rutas/<id>`, que requiere una build instalada de la aplicación. Las rutas privadas se comparten sin enlace.

## Instalar Dependencias

```bash
cd "C:\Users\PC\Documents\ChatGPT\New project\trekking-app"
npm install
```

`@expo/ngrok` ya esta como dependencia del proyecto para que `--tunnel` no pida instalacion global.

## Correr Localmente En Navegador

```bash
npx expo start --web
```

Abre:

```text
http://localhost:8081
```

Esta opcion sirve para revisar pantallas y formularios. Para GPS real conviene probar desde celular.

## Correr En Celular Con Expo Go

Si la PC y el celular estan en la misma red Wi-Fi, usa LAN. Es la opcion mas estable para pruebas locales:

```bash
npm run start:lan
```

Si no estan en la misma red, usa tunel:

```bash
npm run start:tunnel
```

Luego:

1. Abre Expo Go en el celular.
2. Escanea el QR que aparece en la terminal.
3. Acepta permisos de ubicacion precisa cuando la app los pida.
4. Manten la app abierta mientras grabas una ruta.

Si Expo vuelve a pedir instalar `@expo/ngrok`, deten el proceso con `Ctrl + C`, ejecuta `npm install` y vuelve a correr `npm run start:tunnel`.

Si el tunel falla con este error:

```text
CommandError: TypeError: Cannot read properties of undefined (reading 'body')
```

significa que Expo no pudo obtener una respuesta valida del servicio de tuneles de ngrok. Para seguir probando sin depender de ngrok, conecta la PC y el celular a la misma red Wi-Fi o al mismo hotspot y corre:

```bash
npm run start:lan
```

Si el puerto `8081` esta ocupado, puedes cerrar el otro Metro con `Ctrl + C` o aceptar el puerto alternativo que Expo proponga. Escanea siempre el QR nuevo que aparece despues de elegir el puerto.

Si el QR no aparece pero Metro queda activo, revisa que diga:

```text
Tunnel connected.
Tunnel ready.
Waiting on http://localhost:8081
```

En ese caso deten con `Ctrl + C` y vuelve a ejecutar el mismo comando en una terminal normal del proyecto.

## Probar Grabacion GPS

Flujo esperado:

1. Entra a la app desde Expo Go.
2. Pulsa `Continuar sin cuenta` o inicia sesion.
3. Ve a `Grabar`.
4. Pulsa `Iniciar grabacion`.
5. Espera una precision GPS razonable.
6. Camina unos metros.
7. Verifica que distancia y tiempo activo aumenten.
8. Agrega un punto si necesitas marcar campamento, agua, descanso, tienda u otro.
9. Finaliza la ruta.
10. Completa nombre, descripcion, dificultad, equipo y visibilidad.
11. Guarda la ruta.

Sin sesion, la ruta queda como copia local. Con sesion, se guarda localmente y se intenta sincronizar con Supabase.

## Comandos Utiles

```bash
npm run typecheck
npm test
npm run lint
```

Para validar que el bundle Android compila sin crear APK:

```bash
npx expo export --platform android
```

## Base De Datos

El esquema, RLS, Storage y funciones de sincronizacion estan documentados en:

- `docs/supabase_database.md`
- `docs/supabase_validation.md`

Las migraciones estan en:

```text
supabase/migrations
```

## APK

Todavia no se debe crear APK para esta etapa. Primero se hacen pruebas locales con Expo Go y, cuando se cierren observaciones, se genera una build APK de prueba.
