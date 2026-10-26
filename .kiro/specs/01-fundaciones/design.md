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

Opción elegida: **Auth Hook "Before User Created"** (función SQL `public.hook_validar_correo`) que rechaza con 403 y el mensaje "Tu correo no está habilitado…" si el correo no existe en `personas` activas. **Se activa a mano en el panel** (Authentication → Hooks). El cliente muestra ese mensaje cuando `signInWithOtp` devuelve error. Se descartó la RPC pública `correo_habilitado` porque permitiría a cualquiera averiguar qué correos están registrados. Alternativa si el hook no está disponible en el plan: `shouldCreateUser: false` + invitaciones desde Perfiles.

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

Archivos `supabase/migrations/20261026000001…08`:
1. `extensiones_tipos` — `citext`, `unaccent`, enums y `public.normalizar()` (equivale a `norm()`).
2. `catalogos` — centros de costo, cuentas, subcuentas (cuenta sugerida), empresas (C.C. por defecto), medios de pago.
3. `personas_y_acceso` — personas (`nombre_norm` columna generada), índice único de tesorero, helpers `mi_persona_id/mi_rol/es_tesoreria/es_admin`, trigger de vínculo por correo, hook de correo.
4. `rendiciones` — rendiciones, líneas, eventos, respaldos y trigger que mantiene `total`.
5. `pagos_banco` — cartolas, movimientos, pagos (devolución ≤ 0), `pago_rendiciones`, `lecturas_ia`.
6. `rls` — RLS en todas las tablas y políticas (funciones envueltas en `select` para evaluarse una vez).
7. `storage` — bucket privado `respaldos` (10 MB, solo imágenes) y políticas por carpeta `<persona_id>/…`.
8. `datos_iniciales` — **generada** por `scripts/generar-datos-iniciales.mjs` (catálogos, 26 personas del historial sin correo, administrador inicial).
Las RPC de cada pantalla se agregan como migraciones nuevas en sus specs.

Verificación sin Docker: `npm run db:probar` (`scripts/probar-migraciones.mjs`, PGlite).

## Auth store y router

```ts
// stores/auth.ts
state: session, persona (id, nombre, codigo, rol), cargando
getters: rol, esTesoreria, esAdmin, nombre
actions: init() (getSession + onAuthStateChange; idempotente, el guard la espera), pedirCodigo(correo), verificarCodigo(correo, token), salir()
// sin persona vinculada → rol 'solicitante' y aviso en pantalla (RLS no le muestra datos)
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

`scripts/importar-historial.mjs` (`npm run db:historial`; lee `VITE_SUPABASE_URL` de `.env.local` y `SUPABASE_SECRET_KEY` de la terminal; `--ensayo` no escribe):

1. Lee `CLAUDE/datos/historial_2026/*.json` (ops `set` de colecciones `rendiciones` y `pagos`).
2. Resuelve persona por `norm(solicitante)` (crea si falta, código de `codes.json`).
3. Resuelve catálogos por `norm`; si no calza, deja `null` y lo reporta.
4. Rendición por `folio` (= `doc_id`): si ya existe **no se toca** (no pisa ediciones); si no, inserta cabecera (aprobada, Histórico), líneas y evento "Ingresada (historial)"; si falla una parte, borra la cabecera para reintentar limpio.
5. Pago por `codigo_hist`: igual criterio; vínculos en `pago_rendiciones` según `rends`. Banco "No informado" → sin medio de pago y nota en `obs`.
6. Imprime totales y la lista de anomalías conocidas (RDI-031 sin cuenta, AKO-008 IVA sin neto, 7 pagos sin fecha o 2025).

## Riesgos / decisiones abiertas

- **Hosting del frontend**: por definir (Vercel/Netlify/Cloudflare Pages).
- **Correos de las personas**: el historial no los trae; hay que cargarlos en Perfiles antes de que cada uno pueda entrar.
- **Microsoft login**: posible fase 2.
