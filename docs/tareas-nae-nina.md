# Trekking: tareas de Nae Nina (Ester)

Revision: 2026-09-15. Proyecto Jira: Desarrollo Trekking (SCRUM).
Las 7 historias y sus 28 subtareas figuraban como Por hacer. No se modificaron estados en Jira.

## Orden de trabajo

| Historia | Trabajo | Situacion de esta entrega |
| --- | --- | --- |
| [SCRUM-73](https://josuealejandroma.atlassian.net/browse/SCRUM-73) | Configurar expo-location, pedir permiso, bloquear sin permiso | Implementado; comprobar permisos en celular |
| [SCRUM-74](https://josuealejandroma.atlassian.net/browse/SCRUM-74) | Capturar latitud/longitud inicial y asociarlas al recorrido | Implementado en memoria, marcador Inicio |
| [SCRUM-75](https://josuealejandroma.atlassian.net/browse/SCRUM-75) | Escuchar GPS, guardar secuencia, trazar y cancelar suscripcion | Implementado con Leaflet; falta prueba caminando |
| [SCRUM-76](https://josuealejandroma.atlassian.net/browse/SCRUM-76) | Distancia acumulada y tiempo activo | Implementado; pruebas unitarias pasan |
| [SCRUM-80](https://josuealejandroma.atlassian.net/browse/SCRUM-80) | Pausar tiempo y distancia | Implementado; pausa al agregar punto o salir de la vista |
| [SCRUM-81](https://josuealejandroma.atlassian.net/browse/SCRUM-81) | Reanudar sin sumar desplazamientos durante la pausa | Implementado con segmentos independientes |
| [SCRUM-87](https://josuealejandroma.atlassian.net/browse/SCRUM-87) | Guardar datos, trazado y puntos de forma completa | Pendiente: public no tiene tablas; falta contrato de datos y sesion real |

## Dependencias del equipo

- Josue: registro/login con Supabase Auth (SCRUM-66 y SCRUM-67) y finalizacion (SCRUM-82).
- Cesar: puntos de interes y resumen. El formulario de puntos actual sigue siendo visual; no guarda puntos de interes reales.
- Freddy: catalogo, busqueda y filtros. Los listados actuales siguen siendo datos de demostracion.
- Coordinar tablas y politicas RLS antes de SCRUM-87. Propuesta para revisar: ruta con owner_id, trazado ordenado con segmentos, puntos de interes y guardado atomico para evitar rutas incompletas.

## Comprobar en el celular

1. Abrir Grabar, pulsar Iniciar grabacion y rechazar permiso: debe informar y no iniciar.
2. Conceder permiso, activar GPS y salir al exterior: comprobar Inicio y ubicacion real.
3. Caminar 100-200 m: comprobar trazado, distancia creciente y contador.
4. Pausar y caminar: tiempo y distancia deben permanecer constantes.
5. Continuar: el nuevo segmento no debe sumar ni dibujar el tramo recorrido en pausa.
6. Agregar punto y volver: debe pausar y reanudar el GPS. El formulario aun no persiste el punto.
7. Finalizar: verificar resumen con valores reales y que cesan las actualizaciones.
8. Cambiar de pantalla o enviar la app al fondo: debe pausar. Reanudar explicitamente al volver.
9. Desactivar internet: pueden faltar los mosaicos, pero las coordenadas GPS no dependen de Leaflet.

## Limites actuales

- Grabacion en primer plano; no prometer seguimiento con pantalla bloqueada. En Expo Go no se implementa el servicio GPS en segundo plano.
- Recorrido en memoria durante esta sesion; no hay recuperacion despues de cerrar o recargar la app.
- Leaflet muestra mapas mediante un componente DOM (WebView en celular), con mosaicos OpenStreetMap y atribucion visible. No hay descarga offline de mosaicos.
- Se rechazan lecturas con precision peor de 50 m, desplazamientos menores de 3 m y saltos superiores a 12 m/s. Validar estos umbrales en recorridos reales.
- No marcar las historias como terminadas hasta completar las pruebas en dispositivo.

## Verificacion automatica

`node --test tests/recording.test.mjs`

`npx tsc --noEmit`

`npx expo export --platform web --platform android`

## Referencias

- https://docs.expo.dev/versions/latest/sdk/location/
- https://docs.expo.dev/guides/dom-components/
- https://leafletjs.com/examples/quick-start/
