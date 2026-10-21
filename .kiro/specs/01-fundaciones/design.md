# 01 · Fundaciones — Diseño

## Scaffold

`npm create vite@latest . -- --template vue-ts` y luego:

```
dependencias:   vue-router pinia @supabase/supabase-js bootstrap @popperjs/core bootstrap-icons zod
                @fontsource/ibm-plex-sans @fontsource/ibm-plex-mono
dev:            sass-embedded vitest @vue/test-utils jsdom vue-tsc eslint eslint-plugin-vue
                typescript-eslint @vue/eslint-config-typescript prettier eslint-config-prettier supabase
diferidas:      xlsx (tarball cdn.sheetjs.com) jspdf jspdf-autotable   ← se instalan en sus specs
```

`vite.config.ts`: alias `@`, `css.preprocessorOptions.scss.silenceDeprecations: ['import','global-builtin','color-functions','mixed-decls']` (Bootstrap 5.3 aún usa `@import`), `test.environment: 'jsdom'`.

## SCSS

```scss
// main.scss
@use "tokens";                 // solo variables Sass + mapa de tokens
@import "bootstrap-vars";      // $primary: tokens.$accent; $body-bg…; $font-family-sans-serif…
@import "bootstrap/scss/bootstrap";
@import "dark";                // [data-bs-theme=dark] { --bs-body-bg: …; --bs-primary: …; }
@import "components";          // .label-caps, .chip-*, .kpi, .drop, .thumbs, td.n, .mono…
```

- Los tokens claros se pasan a variables Sass de Bootstrap; los oscuros se aplican como CSS custom properties bajo `[data-bs-theme=dark]` (Bootstrap 5.3 color modes).
- `ThemeToggle`: lee `localStorage('tema')` (`claro|oscuro|sistema`), aplica `document.documentElement.dataset.bsTheme`, escucha `matchMedia('(prefers-color-scheme: dark)')`. Todo dentro de `try/catch`.

## Supabase

- `supabase init` → `supabase/config.toml`. En `[auth]`: `enable_signup = true` pero bloqueado por hook; `[auth.email] enable_confirmations = false`, OTP de 6 dígitos.
- Cliente único `src/lib/supabase.ts` tipado con `Database`.

### Restricción de ingreso (R3.3)

Opción elegida: **Auth Hook "before user created"** (función SQL `hook_validar_correo`) que rechaza si el correo no existe en `personas` activas. Alternativa si el hook no está disponible en el plan: `signInWithOtp({ shouldCreateUser: false })` + alta de usuarios por invitación desde Perfiles (Edge Function admin). En el cliente, antes de pedir el código se llama a la RPC pública `correo_habilitado(correo)` para mostrar el mensaje amable.

### Vínculo cuenta → persona (R3.4)

Trigger `after insert on auth.users` → `update personas set user_id = new.id where correo = new.email and user_id is null`.

### Helpers de rol

```sql
create function mi_persona_id() returns uuid language sql stable security definer set search_path = public
as $$ select id from personas where user_id = auth.uid() and eliminada_en is null $$;
create function mi_rol() returns rol_app ... coalesce((select rol ...), 'solicitante')
create function es_tesoreria() returns bool ... mi_rol() in ('tesorero','administrador')
create function es_admin() returns bool ... mi_rol() = 'administrador'
```

## Migraciones (orden)

1. `0001_extensiones_enums.sql` — `citext`, `unaccent`, enums.
2. `0002_catalogos.sql`
3. `0003_personas.sql` — tabla, trigger `nombre_norm` (`lower(unaccent(regexp_replace(trim(nombre),'\s+',' ','g')))`), índice único tesorero, helpers de rol, trigger de vínculo, hook de correo.
4. `0004_rendiciones.sql` — rendiciones, líneas, eventos, respaldos, trigger de `total`.
5. `0005_pagos_banco.sql`
6. `0006_lecturas_ia.sql`
7. `0007_rls.sql` — `enable row level security` + políticas.
8. `0008_storage.sql` — bucket `respaldos` privado + políticas sobre `storage.objects`.
9. `0009_rpc_*.sql` — se agregan en los specs de cada pantalla.

`seed.sql`: catálogos + personas (sin correos; se completan en Perfiles) + una persona administradora de desarrollo (`admin@local.test`).

## Auth store y router

```ts
// stores/auth.ts
state: session, persona (id, nombre, codigo, rol), cargando
getters: rol, esTesoreria, esAdmin, nombre
actions: init() (getSession + onAuthStateChange), pedirCodigo(correo), verificarCodigo(correo, token), salir()
```

```ts
// router: meta.roles
{ path: '/rendir',     component: RendirView,     meta: { roles: ['*'] } }
{ path: '/mis',        component: CarpetasView,   meta: { roles: ['*'] } }
{ path: '/aprobar',    component: PorAprobarView, meta: { roles: ['tesorero','administrador'] } }
{ path: '/libro',      component: LibroView,      meta: { roles: ['tesorero','administrador'] } }
{ path: '/personas',   component: PersonasView,   meta: { roles: ['tesorero','administrador'] } }
{ path: '/banco',      component: BancoView,      meta: { roles: ['tesorero','administrador'] } }
{ path: '/perfiles',   component: PerfilesView,   meta: { roles: ['administrador'] } }
{ path: '/ingresar',   component: LoginView,      meta: { publica: true } }
```

Guard: espera `auth.init()`; sin sesión → `/ingresar`; rol no permitido → `/rendir`. Vistas con lazy import.

## Store de catálogos

`useCatalogosStore`: carga una vez empresas, centros de costo, cuentas, subcuentas, medios de pago y personas activas. Expone `opciones*` con `{ value: id, label: tr(nombre) }` y `cuentaSugerida(subcuentaId)`.

## Importador del historial

`scripts/importar-historial.ts` (ejecutar con `npx tsx`, variables `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`):

1. Lee `CLAUDE/datos/historial_2026/*.json` (ops `set` de colecciones `rendiciones` y `pagos`).
2. Resuelve persona por `norm(solicitante)` (crea si falta, código de `codes.json`).
3. Resuelve catálogos por `norm`; si no calza, deja `null` y lo reporta.
4. Upsert de rendición por `folio` (= `doc_id`), reemplaza líneas solo si la rendición es `Histórico` y no tiene eventos posteriores a la importación.
5. Upsert de pagos por `codigo_hist`, con `pago_rendiciones` según `rends`.
6. Imprime totales y la lista de anomalías conocidas (RDI-031 sin cuenta, AKO-008 IVA sin neto, 7 pagos sin fecha o 2025).

## Riesgos / decisiones abiertas

- **Hosting del frontend**: por definir (Vercel/Netlify/Cloudflare Pages).
- **Correos de las personas**: el historial no los trae; hay que cargarlos en Perfiles antes de que cada uno pueda entrar.
- **Microsoft login**: posible fase 2.
