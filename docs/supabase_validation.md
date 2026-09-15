# Trekking V1 — informe de validación

Fecha: 15 de septiembre de 2026. Rama: `Josue-Maydana`. Sin commit ni push.

## Resultado

**Esquema preparado y validado localmente. Despliegue remoto pendiente.**

La reproducción desde `supabase/tests/package-lock.json` pasó **20/20 escenarios** en PostgreSQL **17.10**, el 15/09/2026 a las 05:16 UTC. El motor ejecutó las ocho migraciones, las consultas de auditoría y RLS con roles reales anon/authenticated. Los contratos de Auth y Storage son fixtures SQL mínimos: no equivalen al servicio Supabase completo.

Inventario exacto de tablas, relaciones, migraciones, índices, funciones, políticas, paquetes, archivos y matriz RF/HU en [supabase_database.md](./supabase_database.md).

## Organización y proyecto

| Dato | Estado |
| --- | --- |
| Organización utilizada para Trekking | Ninguna: no aparece una organización de Trekking accesible. |
| Proyecto utilizado | Ninguno remoto. |
| Project ref | Pendiente; no se inventó ni se enlazó un proyecto ajeno. |
| MCP | Acceso verificado. |
| CLI | Instalada e inicializada; sin token personal de acceso. |
| Cambios remotos | Ninguno. |
| Costes / contratación | Ninguno. |

Organización observada: `ninalb999's Org` (`qrcnccfbbxcjrgvjtrnl`). Proyectos observados: `portal-proyectos-universitarios` y `sistema-de-reciclaje`. Se conservaron intactos.

## Comprobaciones

| Comprobación | Resultado |
| --- | --- |
| Ocho migraciones aplicadas desde cero en PostgreSQL 17 | PASS |
| 20 escenarios SQL de datos, restricciones y permisos | PASS |
| Siete tablas públicas con RLS habilitado | PASS |
| 26 políticas de tablas + cuatro de Storage | PASS |
| 16 índices: siete PK y nueve índices adicionales/UNIQUE | PASS |
| Bucket route-images privado | PASS |
| Funciones privadas y privilegios de ejecución | PASS |
| Tipos generados desde PostgreSQL con generador oficial Supabase | PASS |
| Comparación de tipos generados con archivo versionable, sin drift | PASS |
| `npm run typecheck` | PASS |
| Lint de todos los archivos TypeScript añadidos/modificados | PASS |
| `npm run lint` / lint global | **FAIL** por un error del starter sin modificar; detalle abajo. |
| `expo install --check` | PASS: dependencias compatibles con Expo 57. |
| Exportación Android con Metro | PASS: 1.667 módulos; bundle Hermes de 4,3 MB. |
| `git diff --check` | PASS |
| Manifiesto y lockfile raíz coherentes | PASS |
| Patrones de claves privadas/tokens/URLs con contraseña/JWT service_role | PASS: ninguna coincidencia. |
| Exclusión Git de .env, .env.local y artefactos locales | PASS |
| Auth signup/login/logout real por HTTP | NO EJECUTADO |
| Subida/descarga de archivos binarios por Storage API | NO EJECUTADO |
| Sesión persistente y refresh en dispositivo | NO EJECUTADO |
| Supabase Security/Performance Advisors remotos | NO EJECUTADO: falta proyecto. |

### Error global de lint

Archivo sin cambios: `src/hooks/use-color-scheme.web.ts:11`.

Regla: `react-hooks/set-state-in-effect`. El starter llama `setHasHydrated(true)` dentro de un efecto. Se confirmó que ese archivo coincide con HEAD. No se cambió su comportamiento ni se desactivó la regla.

ESLint se instaló con la configuración recomendada por Expo porque originalmente solo existía el comando lint. Los archivos de Supabase, Auth, el hook de refresh, el layout y los tipos sí pasan lint.

### Auditoría npm

`npm audit` informó **14 avisos moderados**, cero altos y cero críticos. Se concentran en cadenas de Expo (uuid/xcode y decode-uri-component/query-string). Se compararon las versiones afectadas con el lockfile original y son las mismas. No se aplicó `npm audit fix --force`: las soluciones propuestas incluyen retroceder a versiones mayores antiguas de Expo/Router, ajenas a esta tarea.

## Pruebas solicitadas: alcance comprobado

| Test | Escenario | Resultado |
| --- | --- | --- |
| 1 | Alta de auth.users crea profile y conserva full_name | PASS SQL; signup HTTP pendiente |
| 2 | Ruta privada visible para A, invisible para B/anon | PASS |
| 3 | Publicada pública legible por B/anon; no editable | PASS |
| 4 | B no modifica rutas de A; tampoco puede apropiárselas | PASS |
| 5 | A agrega GPS; B no puede | PASS |
| 6 | GPS recuperado por sequence_no y duplicados rechazados | PASS |
| 7 | Cinco tipos manuales conservan todos sus datos | PASS |
| 8 | Cuatro servicios y disponibilidad; sin duplicados | PASS |
| 9 | Pausa abierta/cerrada, duración y privacidad | PASS |
| 10 | Resumen, posiciones y estados de finalización | PASS |
| 11 | Metadatos de foto privada bloqueados para anon/B | PASS SQL; archivo HTTP pendiente |
| 12 | Metadatos de foto pública visibles; ocultación revoca acceso SQL | PASS SQL; archivo HTTP pendiente |
| 13 | Mis rutas filtradas por propietario | PASS |
| 14 | Catálogo solo public + published, ILIKE y dificultad libre | PASS |
| 15 | CRUD propio/ajeno en todas las tablas hijas, incluidos cambios de padre | PASS |
| 16 | CRUD de objetos por dueño; traslado ajeno y paths inválidos rechazados | PASS SQL |
| 17 | Coordenadas, distancia, tiempos, tipos y paths inválidos rechazados | PASS |
| 18 | Perfiles básicos públicos; edición propia; trigger privilegiado no invocable | PASS |
| 19 | updated_at, RLS, índices, funciones y GRANT/TRUNCATE | PASS |
| 20 | Cascadas al borrar ruta; objetos huérfanos inaccesibles | PASS SQL |

Una prueba detectó una referencia de nombre ambigua en Storage. Se corrigió calificando explícitamente `storage.objects.name` y se repitió la suite completa con éxito.

Evidencia reproducible:

- `supabase/tests/run.mjs`: escenarios y comprobación de drift de tipos.
- `supabase/tests/security_audit.sql`: auditoría de solo lectura.
- `supabase/tests/.artifacts/results.json`: resultados locales (ignorado por Git).
- `supabase/tests/.artifacts/security-audit.json`: inventario local (ignorado por Git).
- `.expo/trekking-validation/android/`: exportación Android comprobada (ignorada por Git); no equivale a instalar/probar en dispositivo.

## Archivos entregados

- Ocho migraciones en `supabase/migrations/`.
- `supabase/config.toml`, `supabase/.gitignore`.
- `supabase/tests/package.json`, lockfile, bootstrap.sql, run.mjs, security_audit.sql.
- `src/lib/supabase.ts`, `src/lib/auth.ts`.
- `src/hooks/use-supabase-auto-refresh.ts`.
- `src/types/database.ts`, `src/types/expo-env.d.ts`.
- Modificación mínima de `src/app/_layout.tsx`.
- `.env.example`, `.gitignore`, `package.json`, lockfile, `eslint.config.js`.
- Documentación en `docs/` y enlace desde README.

No se eliminaron archivos del starter ni se desarrollaron pantallas, funciones sociales o administración.

## Pasos manuales para terminar el despliegue

1. En [Supabase Dashboard](https://supabase.com/dashboard), crear **Trekking Bolivia** y **trekking-v1** en **São Paulo / sa-east-1**, usando modalidad gratuita. Si Supabase pide pago por cuota o plan, detenerse antes de contratar.
2. Introducir la contraseña de DB directamente en Supabase. No enviarla al chat.
3. Compartir únicamente el **project ref** y habilitar acceso del conector a esa organización/proyecto. Con MCP autorizado se puede inspeccionar y migrar sin copiar credenciales al repositorio.
4. Si se prefiere CLI: ejecutar `npx supabase login` y `npx supabase link --project-ref REF_REAL` localmente. No guardar tokens en Git.
5. Inspeccionar esquema e historial; revisar `db push --dry-run` antes de aplicar. Comandos completos en la documentación principal.
6. Configurar .env.local con EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY (publishable o anon). No usar service_role ni secret.
7. Ejecutar las pruebas HTTP y de dispositivo descritas abajo.

### Verificación real pendiente

En un proyecto de pruebas, con dos cuentas A/B y una sesión sin login:

- Registrarse e iniciar sesión con Auth; confirmar perfil y metadata. Si se exige confirmación de email, completarla antes del login.
- Crear ruta privada de A y comprobar REST como A/B/anon; publicar y repetir; rechazar escritura de B.
- Subir una imagen real en el path canónico; descargar como A; denegar B/anon cuando es privada; permitir lectura pública publicada. Probar también upsert, rename y delete ajenos.
- Comprobar que `getPublicUrl` no sirve un archivo del bucket privado. Si se introducen URLs firmadas, probar su ventana de expiración, porque un enlace ya emitido no se revoca al privatizar.
- Guardar datos/puntos/pausas, cerrar y abrir la aplicación, y verificar continuidad de sesión y consultas.
- Probar signOut y el refresh al pasar a background/foreground en Android/iOS.
- Ejecutar Advisors remotos y revisar avisos antes de dar el despliegue por validado.

Hasta completar esas comprobaciones no se declara operativa la integración remota.
