# Stack técnico

## Frontend

| Pieza | Elección | Notas |
| --- | --- | --- |
| Framework | **Vue 3** (Composition API, `<script setup lang="ts">`) | Sin Options API. |
| Lenguaje | **TypeScript 6** (`strict: true`; sin `baseUrl`, deprecado en TS 6) | Tipos de la base generados con `supabase gen types`. |
| Build | **Vite 8** | Alias `@` → `src/` y `@shared` → `supabase/functions/_shared/` (código puro compartido con las Edge Functions). Variables de entorno con prefijo `VITE_`. |
| Estilos | **SCSS** + **Bootstrap 5.3** (compilado desde fuente SCSS, no por CDN) | Variables de Bootstrap sobreescritas con los tokens del diseño (ver `ui.md`). Modo oscuro con `data-bs-theme`. |
| Íconos | `bootstrap-icons` | |
| JS de Bootstrap | Import selectivo (`Modal`, `Toast`, `Dropdown`, `Collapse`) envuelto en componentes Vue | Nada de jQuery. |
| Estado | **Pinia 4** (setup stores) | Un store por dominio. |
| Rutas | **Vue Router 5** | Guards por función (`meta.roles`). |
| Validación | **zod** | Para la respuesta de la IA, formularios y payloads de RPC. |
| Excel | **SheetJS** (`xlsx`, instalado desde el tarball oficial `cdn.sheetjs.com`, no la versión vieja de npm) | Leer cartolas y exportar libro. Carga diferida (`import()`). |
| PDF | **jsPDF** + `jspdf-autotable` | Reporte por rendición. Carga diferida. |
| Fuentes | IBM Plex Sans + IBM Plex Mono (`@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-mono`) | Self-hosted, sin Google Fonts en runtime. |
| Tests | **Vitest** + `@vue/test-utils` | La lógica de dominio (`src/domain/`) se testea siempre. |
| Calidad | ESLint (flat config, `eslint-plugin-vue`, `typescript-eslint`) + Prettier | `npm run lint` y `npm run typecheck` deben pasar. |

## Backend: Supabase

| Pieza | Uso |
| --- | --- |
| **Postgres** | Todo el modelo de datos (ver `data-model.md`). Migraciones SQL versionadas en `supabase/migrations/`. |
| **RLS** | Activado en **todas** las tablas. El acceso real a datos lo dan las políticas, no la UI. |
| **RPC (funciones SQL)** | Toda transición de estado (enviar, aprobar, observar, rechazar, anular, eliminar, registrar pago, conciliar) pasa por una función `security definer` que valida la función del usuario y escribe la línea de tiempo en la misma transacción. |
| **Auth** | Login por correo con código/enlace (OTP). Solo pueden entrar correos registrados en `personas` (registro abierto desactivado; alta vía invitación o hook). Microsoft (Azure AD) como proveedor opcional futuro, porque Heca usa M365. |
| **Storage** | Bucket privado `respaldos` para fotos. Se muestran con URLs firmadas de corta duración. |
| **Edge Functions** (Deno) | `leer-rendicion`: recibe las imágenes, llama a la API de Claude con visión y devuelve el JSON validado. La API key de Anthropic **solo** vive como secreto de la función. |
| **Realtime** | Contador de "Por aprobar" y refresco de carpetas. |

## Lectura con IA

- Proveedor: API de Anthropic con el SDK oficial `@anthropic-ai/sdk` (fijado en `deno.json`). Modelo por defecto `claude-opus-5-5` (secreto `ANTHROPIC_MODEL`), esfuerzo `medium` (`ANTHROPIC_EFFORT`). Salida con **structured outputs** (`output_config.format` = `ESQUEMA_SALIDA` de `_shared/lectura.ts`) y **fallbacks `"default"`** ante rechazos por política. Antes de cambiar la llamada, consultar la skill `claude-api` (la API cambia seguido).
- El prompt y las reglas de lectura se portan de `buildPrompt()` del prototipo (ver `business-rules.md` §Lectura).
- Los recortes ampliados (cuadrantes / mitades) se generan en el **cliente** con `<canvas>` antes de enviar (porta `prepImages()`).
- Límite de uso por usuario (tabla `lecturas_ia`) para controlar costo.

## Entornos y secretos

- `.env.local` (no se commitea): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- Secretos de Edge Functions (`supabase secrets set`): `ANTHROPIC_API_KEY` (obligatorio), `ANTHROPIC_MODEL`, `ANTHROPIC_EFFORT`, `LIMITE_LECTURAS_DIA` (opcionales). Despliegue: `npx supabase functions deploy leer-rendicion --use-api`.
- La `service_role` key **nunca** va al frontend; solo se usa en scripts locales (`scripts/`) y funciones.
- **Sin Docker local**: se trabaja contra un proyecto en **Supabase Cloud** (creado desde la web). Migraciones con `supabase link` + `supabase db push`. Si más adelante se separan entornos, un proyecto de desarrollo y otro de producción. Frontend estático (Vercel/Netlify/Cloudflare Pages, por decidir).

## Requisitos

- **Node 22.12 o superior** (`.nvmrc` = 22; `engines` en `package.json`). Vite 8 y supabase-js en scripts de Node lo exigen.

## Comandos esperados

```bash
npm run dev          # Vite
npm run build        # typecheck + vite build en paralelo (falla si hay errores de tipos)
npm run test         # vitest run  (test:watch para modo watch)
npm run lint         # eslint . --fix  (lint:check sin corregir)
npm run typecheck    # vue-tsc --build
npm run format       # prettier --write src/
npm run db:types     # supabase gen types typescript --linked > src/lib/database.types.ts
npm run db:push      # supabase db push (aplica migraciones pendientes al proyecto vinculado)
npm run db:probar    # aplica las migraciones sobre PGlite y prueba RLS/triggers (sin Docker)
npm run db:datos     # regenera la migración de datos iniciales desde CLAUDE/datos
npm run db:historial # importa el historial 2026 (requiere SUPABASE_SECRET_KEY en la terminal; --ensayo no escribe)
```

## Restricciones

- No usar `alert/confirm/prompt` nativos: confirmaciones en línea o modal de Bootstrap.
- Las librerías pesadas (xlsx, jspdf) se cargan con `import()` solo cuando se usan.
- Mobile first: el solicitante usa la app desde el celular. Tablas anchas con scroll horizontal propio.
