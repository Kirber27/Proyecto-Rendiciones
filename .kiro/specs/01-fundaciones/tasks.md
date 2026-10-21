# 01 · Fundaciones — Tareas

Marcar con `[x]` al terminar. Cada tarea deja el proyecto compilando (`npm run build`) y con tests en verde.

- [ ] **1.1 Scaffold del proyecto** _(R1.1, R1.2, R1.3)_
  - Crear proyecto Vite `vue-ts` en la raíz (sin pisar `CLAUDE/`, `.kiro/`, `README.md`).
  - Instalar dependencias base (ver design). Configurar alias `@`, `tsconfig` strict.
  - ESLint flat + Prettier, scripts `lint`, `typecheck`, `test`.
  - `.gitignore` (node_modules, dist, .env*, supabase/.temp) y `.env.example`.
  - Verificar: `npm run dev` muestra la página por defecto; `build`, `lint`, `test` pasan.

- [ ] **1.2 Tema SCSS + Bootstrap** _(R2.1, R2.2, R2.3)_
  - `_tokens.scss`, `_bootstrap-vars.scss`, `_dark.scss`, `_components.scss`, `main.scss`.
  - Fuentes IBM Plex vía `@fontsource`.
  - `ThemeToggle` + composable `useTheme`.
  - Página temporal `/_estilos` con botones, chips, tabla, alertas, inputs, en claro y oscuro, para comparar con la maqueta.

- [ ] **1.3 Layout: AppHeader + AppTabs + router** _(R2.4, R4.2)_
  - Marca, pestañas (`nav-pills`) con badge, contenedor 1160px.
  - Rutas con `meta.roles` y vistas placeholder (EmptyState "En construcción").
  - Componentes ui base: `AppChip`, `EmptyState`, `KpiTile`, `Lightbox`.

- [ ] **1.4 Dominio base portado** _(R7.1)_
  - `src/domain/formato.ts` y `src/domain/rendicion.ts` (totales).
  - Tests con casos reales: `num("70.389")=70389`, `num("1.234,50")=1234.5`, `clp(-500)="-$ 500"`, `parseDate(46000)`, `parseDate("14-10-2026")`, `semana("2026-10-07")="Del 05 al 09"`, `norm("  Rodrigo  Ibañez ")="rodrigo ibanez"`.

- [ ] **1.5 Supabase local + migraciones de esquema** _(R5.1)_
  - `supabase init`, `supabase start`.
  - Migraciones 0001–0006 de design (enums, catálogos, personas, rendiciones, pagos/banco, lecturas_ia).
  - `npm run db:types` genera `src/lib/database.types.ts`.

- [ ] **1.6 RLS + Storage** _(R4.3, R4.4)_
  - Migraciones 0007 (políticas) y 0008 (bucket `respaldos`).
  - Tests SQL (`supabase test db` con pgTAP) mínimos: un solicitante no ve rendiciones de otro; un solicitante no puede insertar directo en `rendiciones`; solo un tesorero activo.

- [ ] **1.7 Seed de catálogos y personas** _(R5.2, R5.3)_
  - Generar `supabase/seed.sql` desde `CLAUDE/datos/*.json` con un script (`scripts/generar-seed.ts`) para no transcribir a mano.
  - Verificar grafía exacta (espacios finales) con una consulta.

- [ ] **1.8 Autenticación** _(R3.1–R3.5, R4.1)_
  - `lib/supabase.ts`, `stores/auth.ts`, `LoginView` (correo → código de 6 dígitos).
  - RPC `correo_habilitado`, hook/trigger de restricción y vínculo cuenta → persona.
  - Guard del router; botón "Salir" en el header; pestañas según rol.
  - Probar con 3 usuarios locales (admin, tesorero, solicitante) usando Inbucket/Mailpit de `supabase start`.

- [ ] **1.9 Store de catálogos** _(soporte de R5)_
  - `stores/catalogos.ts` con carga única y helpers de opciones / cuenta sugerida.

- [ ] **1.10 Importador del historial 2026** _(R6.1–R6.3)_
  - `scripts/importar-historial.ts` idempotente.
  - Correr en local, comparar totales con los esperados, correr dos veces y verificar que no duplica.
