# Animaciones de carga y bienvenida

Implementación compartida: `src/components/feedback/trekking-animations.tsx`.

Los dibujos son SVG nativos con `react-native-svg` 15.15.4 (Expo SDK 57). No descargan imágenes ni necesitan conexión. Se animan mediante `Animated` de React Native; no requieren un WebView, GIF ni animaciones SVG del navegador.

## Componentes

- `TrailIllustration`: paisaje de montañas, árboles y sendero.
- `TrailSpinner`: indicador circular, con variante blanca para botones verdes.
- `LoadingState`: ilustración con indicador y texto; `compact` muestra solo el indicador y texto.
- `LoginWelcome`: bienvenida con paisaje y confirmación al iniciar sesión correctamente.

La paleta reutiliza los colores de las pantallas existentes: bosque `#123f2d`, verde `#1f6a43`, salvia `#dce8d7`, menta `#dcefe4`, crema `#fbfbf7` y arena `#e8d5a4`.

## Integraciones

- Inicio de sesión y registro: indicador durante la petición.
- Catálogo, Mis rutas, detalle y mapas: indicador durante la carga.
- Grabación: indicador mientras se obtiene la ubicación inicial.
- Guardar punto, guardar ruta, guardar ruta pública y gestionar descarga local: indicador durante la operación real.
- Bienvenida: solo tras una respuesta exitosa del formulario de ingreso con sesión válida. Restaurar una sesión o renovar el token no muestra la bienvenida.

Los indicadores no cambian la lógica de persistencia o autenticación. El guardado local no espera a que termine la sincronización remota. No se simulan porcentajes ni se alargan artificialmente los procesos.

## Accesibilidad y ciclo de vida

Los botones ocupados no aceptan otro toque y exponen el estado accesible `busy`. Los dibujos son decorativos y los estados de carga incluyen texto.

Se respeta la preferencia del sistema de reducir movimiento y se detienen los bucles en segundo plano o al desmontar el componente. La bienvenida se puede cerrar inmediatamente; se cierra automáticamente a los 2,6 segundos si no hay lector de pantalla activo. Con lector de pantalla, se conserva el botón de cierre sin límite de tiempo.

## Verificación en celular pendiente

1. Ingresar con credenciales válidas: comprobar indicador, bienvenida y navegación al inicio. Una contraseña incorrecta debe mostrar el error sin bienvenida.
2. Cerrar la bienvenida con el botón y con Atrás en Android.
3. Volver desde segundo plano: no debe repetirse la bienvenida por renovación de sesión.
4. Activar reducir movimiento: las ilustraciones deben permanecer visibles sin giro.
5. Probar TalkBack/VoiceOver: la bienvenida debe esperar al botón y las cargas deben anunciar su texto.
6. Guardar una ruta offline: el indicador debe terminar tras el guardado local aunque no haya red.
7. Provocar un error de carga/guardado: el indicador debe desaparecer y conservar el mensaje de error correspondiente.

Las comprobaciones de TypeScript, lint, pruebas unitarias y exportación de bundles no sustituyen estas pruebas físicas. Una exportación tampoco genera ni instala una APK.
