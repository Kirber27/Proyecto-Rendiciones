# Stack técnico

## Frontend

| Pieza | Elección | Notas |
| --- | --- | --- |
| Framework | **Vue 3** (Composition API, `<script setup lang="ts">`) | Sin Options API. |
| Lenguaje | **TypeScript 6** (`strict: true`; sin `baseUrl`, deprecado en TS 6) | Tipos de la base generados con `supabase gen types`. |
| Build | **Vite 8** | Alias `@` → `src/`. Variables de entorno con prefijo `VITE_`. |
| Estilos | **SCSS** + **Bootstrap 5.3** (compilado desde fuente SCSS, no por CDN) | Variables de Bootstrap sobreescritas con los tokens del diseño (ver `ui.md`). Modo oscuro con `data-bs-theme`. |
| Íconos | `bootstrap-icons` | |
| JS de Bootstrap | Import selectivo (`Modal`, `Toast`, `Dropdown`, `Collapse`) envuelto en componentes Vue | Nada de jQuery. |
| Estado | **Pinia 4** (setup stores) | Un store por dominio. |
| Rutas | **Vue Router 5** | Guards por función (`meta.roles`). |
| Excel | **SheetJS** (`xlsx`, instalado desde el tarball oficial `cdn.sheetjs.com`, no la versión vieja de npm) | Leer cartolas y exportar libro. Carga diferida (`import()`). |
| PDF | **jsPDF** + `jspdf-autotable`; **pdf-lib** | Reporte por rendición (jsPDF) e incrustación de los respaldos PDF en ese reporte (pdf-lib, solo si la rendición tiene PDF). Carga diferida. |
| Fuentes | IBM Plex Sans + IBM Plex Mono (`@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-mono`) | Self-hosted, sin Google Fonts en runtime. |
| Tests | **Vitest** + `@vue/test-utils` | La lógica de dominio (`src/domain/`) se testea siempre. |
| Calidad | ESLint (flat config, `eslint-plugin-vue`, `typescript-eslint`) + Prettier | `npm run lint` y `npm run typecheck` deben pasar. |

## Backend: Supabase

| Pieza | Uso |
| --- | --- |
| **Postgres** | Todo el modelo de datos (ver `data-model.md`). Migraciones SQL versionadas en `supabase/migrations/`. |
| **RLS** | Activado en **todas** las tablas. El acceso real a datos lo dan las políticas, no la UI. |
| **RPC (funciones SQL)** | Toda transición de estado (enviar, aprobar, observar, rechazar, anular, eliminar, registrar pago, conciliar) pasa por una función `security definer` que valida la función del usuario y escribe la línea de tiempo en la misma transacción. |
| **Auth** | Login con **correo y contraseña**. No se envían correos (no hay SMTP): las cuentas las crea el administrador en Perfiles con una contraseña temporal que la persona cambia al entrar; recuperar contraseña = el administrador asigna otra temporal. Registro abierto desactivado; el hook `hook_validar_correo` sigue como segunda barrera. Ver spec 10. Microsoft (Azure AD) como proveedor opcional futuro, porque Heca usa M365. |
| **Storage** | Bucket privado `respaldos` para los respaldos (fotos y PDF, máx. 10 MB). Se muestran con URLs firmadas de corta duración. |
| **Edge Functions** (Deno) | `cuentas` (solo administrador): crea cuentas y asigna contraseñas temporales con la clave de servicio. Sin secretos propios (usa los que Supabase inyecta). Despliegue: `npx supabase functions deploy cuentas --use-api`. (La de lectura con IA, `leer-rendicion`, se eliminó el 2026-10-26.) |
| **Realtime** | Contador de "Por aprobar" y refresco de carpetas. |

## Sin IA

La primera versión leía las fotos con la API de Anthropic (Edge Function `leer-rendicion`). Se eliminó el 2026-10-26 porque la API cobra por cada imagen leída: los datos se ingresan a mano y las fotos/PDF quedan solo como respaldo. No hay dependencias, secretos ni tablas de IA. Si se retoma, partir del commit `3af03a4` y del spec 02 (versión anterior en git).

## Entornos y secretos

- `.env.local` (no se commitea): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- La `service_role` key **nunca** va al frontend; solo se usa en scripts locales (`scripts/`) y en la Edge Function `cuentas`.
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
npm run cuenta:clave -- <correo>  # contraseña temporal para una cuenta (requiere SUPABASE_SECRET_KEY en la terminal)
```

## Restricciones

- No usar `alert/confirm/prompt` nativos: confirmaciones en línea o modal de Bootstrap.
- Las librerías pesadas (xlsx, jspdf, pdf-lib) se cargan con `import()` solo cuando se usan.
- Mobile first: el solicitante usa la app desde el celular. Tablas anchas con scroll horizontal propio.
