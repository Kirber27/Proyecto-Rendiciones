# 01 · Fundaciones — Tareas

Marcar con `[x]` al terminar. Cada tarea deja el proyecto compilando (`npm run build`) y con tests en verde.

- [x] **1.1 Scaffold del proyecto** _(R1.1, R1.2, R1.3)_
  - Crear proyecto Vite `vue-ts` en la raíz (sin pisar `CLAUDE/`, `.kiro/`, `README.md`).
  - Instalar dependencias base (ver design). Configurar alias `@`, `tsconfig` strict.
  - ESLint flat + Prettier, scripts `lint`, `typecheck`, `test`.
  - `.gitignore` (node_modules, dist, .env*, supabase/.temp) y `.env.example`.
  - Verificar: `npm run dev` muestra la página por defecto; `build`, `lint`, `test` pasan.

- [x] **1.2 Tema SCSS + Bootstrap** _(R2.1, R2.2, R2.3)_
  - `_tokens.scss`, `_bootstrap-vars.scss`, `_dark.scss`, `_components.scss`, `main.scss`.
  - Fuentes IBM Plex vía `@fontsource`.
  - `ThemeToggle` + composable `useTheme`.
  - Página temporal `/_estilos` con botones, chips, tabla, alertas, inputs, en claro y oscuro, para comparar con la maqueta.

- [x] **1.3 Layout: AppHeader + AppTabs + router** _(R2.4, R4.2)_
  - Marca, pestañas (`nav-pills`) con badge, contenedor 1160px.
  - Rutas con `meta.roles` y vistas placeholder (EmptyState "En construcción").
  - Componentes ui base: `AppChip`, `EmptyState`, `KpiTile`, `AppLightbox`.

- [x] **1.4 Dominio base portado** _(R7.1)_
  - `src/domain/formato.ts` y `src/domain/rendicion.ts` (totales).
  - Tests con casos reales: `num("70.389")=70389`, `num("1.234,50")=1234.5`, `clp(-500)="-$ 500"`, `parseDate(46000)`, `parseDate("14-10-2026")`, `semana("2026-10-07")="Del 05 al 09"`, `norm("  Rodrigo  Ibañez ")="rodrigo ibanez"`.

- [x] **1.5 Supabase + migraciones de esquema** _(R5.1)_ — aplicadas el 2026-10-26
  - [x] Proyecto de desarrollo `vyornqwlmoqatjoverlh`; `.env.local`; CLI `supabase` (devDependency); `supabase init`.
  - [x] Migraciones `20261026000001…07` (extensiones/tipos, catálogos, personas y acceso, rendiciones, pagos/banco/lecturas_ia, RLS, storage).
  - [x] `npm run db:probar`: aplica todo sobre PGlite y verifica triggers, hook, vínculo y RLS (sin Docker).
  - [x] `supabase link` (usuario), `npm run db:push` (8 migraciones) y `npm run db:types` → `src/lib/database.types.ts`.
  - Migraciones 0001–0006 de design (enums, catálogos, personas, rendiciones, pagos/banco, lecturas_ia).
  - `npm run db:types` genera `src/lib/database.types.ts`.

- [x] **1.6 RLS + Storage** _(R4.3, R4.4)_ — aplicadas; RLS en todas las tablas (25 políticas); anónimo no ve datos (verificado por REST). Probado con usuarios simulados en `npm run db:probar`; la prueba con usuarios reales queda en 1.8.
  - Migraciones 0007 (políticas) y 0008 (bucket `respaldos`).
  - Tests SQL (`supabase test db` con pgTAP) mínimos: un solicitante no ve rendiciones de otro; un solicitante no puede insertar directo en `rendiciones`; solo un tesorero activo.

- [x] **1.7 Seed de catálogos y personas** _(R5.2, R5.3)_ — aplicado (27 personas, 62 subcuentas, 11 cuentas, 9 C.C., 4 empresas, 6 medios de pago)
  - Hecho como **migración** (`20261026000008_datos_iniciales.sql`) para que `db push` la aplique en Cloud; se genera con `npm run db:datos -- --admin-nombre "…" --admin-correo …` (`scripts/generar-datos-iniciales.mjs`). Administrador inicial: Kirber Pineda (KPI).
  - Verificar grafía exacta (espacios finales) con una consulta.

- [x] **1.8 Autenticación** _(R3.1–R3.5, R4.1)_ — probada con correo real el 2026-10-26 (ingreso como Administrador)
  - [x] `lib/supabase.ts` (cliente tipado), `stores/auth.ts` (sesión, persona vinculada, rol, `pedirCodigo`, `verificarCodigo`, `salir`, mensajes en español), `LoginView` (correo → código; el enlace del correo también sirve).
  - [x] Guard: sin sesión → `/ingresar?volver=…`; con sesión `/ingresar` → inicio. Header con nombre, función y Salir. Aviso si la cuenta no tiene persona vinculada. Eliminado el selector "Dev: rol".
  - [x] Hook verificado en Supabase real: un correo no registrado recibe "Tu correo no está habilitado…".
  - [x] Se descartó la RPC `correo_habilitado` (expondría qué correos están registrados); el mensaje lo da el hook.
  - [x] Ingreso real con kjpr.2904@gmail.com → Administrador.

- [x] **1.9 Store de catálogos** _(soporte de R5)_
  - `services/catalogos.ts` (`leerCatalogos` en paralelo + `aCatalogos` filas → dominio) y `stores/catalogos.ts` (carga única compartida, `recargar`, `limpiar` al salir, `personasActivas`). Medios de pago agregados a `Catalogos`.
  - `/_estilos` usa los catálogos reales: el borrador DHE-042 se arma con `aBorrador` desde una respuesta IA simulada. La cuenta sugerida sale de `domain/catalogos.ts`.

- [ ] **1.10 Importador del historial 2026** _(R6.1–R6.3)_
  - `scripts/importar-historial.ts` idempotente.
  - Correr contra el proyecto de desarrollo, comparar totales con los esperados, correr dos veces y verificar que no duplica.
