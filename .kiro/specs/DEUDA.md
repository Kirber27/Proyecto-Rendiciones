# Deuda técnica y pendientes

Registro de lo que quedó en pausa, temporal o por resolver. Al cerrar un ítem: marcarlo `[x]` con la fecha y la tarea que lo resolvió.

## Bloqueos (esperan algo externo)

- [ ] **Proyecto en Supabase Cloud** _(desde 2026-10-21)_ — lo crea el usuario desde la web (región sugerida `sa-east-1`).
  - Bloquea: **1.5–1.10** (esquema, RLS, seed, auth, catálogos, historial), **2.5** (Edge Function de lectura), **2.6–2.8** (flujo real de Rendir gastos), y todo lo que guarda o lee datos en 03–08.
  - Se necesita: `project ref`, URL, `anon key` (→ `.env.local`) y `service_role key` solo en variables de entorno locales para el importador del historial (nunca en el repo ni en el chat).
  - Al desbloquear: `supabase init` → `supabase link` → migraciones (1.5) → seguir el orden del índice.

## Código temporal (eliminar o reemplazar)

| Qué | Dónde | Se resuelve en |
| --- | --- | --- |
| Selector "Dev: rol" para probar funciones sin auth | `src/components/layout/DevRolSelector.vue`, usado en `AppHeader.vue` | 1.8 (eliminar) |
| `useAuthStore` mínimo (solo `rol`, empieza en `solicitante`) | `src/stores/auth.ts` | 1.8 (sesión real + persona vinculada) |
| Guard sin verificación de sesión (no redirige a `/ingresar`) | `src/router/index.ts` | 1.8 |
| `LoginView` placeholder | `src/views/LoginView.vue` | 1.8 |
| Catálogos de demo con personas ficticias | `src/dev/catalogosDemo.ts` (lo usan `/_estilos` y tests) | 1.9 (store real; la demo puede quedar solo para tests) |
| Vistas "En construcción" | `src/views/*View.vue` | cada spec |
| Página de muestra `/_estilos` (solo dev) | `src/views/EstilosView.vue` | revisar al terminar el hito 1: dejarla como catálogo de componentes o borrarla |

## Pendientes técnicos

- [ ] **`supabase/functions/deno.json`** con import map `"zod": "npm:zod@4"` para que `_shared/lectura.ts` funcione en Deno — en 2.5.
- [ ] **Scripts de instalación bloqueados por npm** (`fsevents`, `@parcel/watcher`): no afectan hoy; si falla el watch de Sass, `npm approve-scripts`.
- [ ] **Tabla de gastos ancha en escritorio**: con Cuenta y C.C. scrollea horizontal (igual que el prototipo). Evaluar en el ajuste de UI (columnas compactas o detalle desplegable).
- [ ] **Recortes con fotos de baja resolución**: no se agrandan, así que aportan poco en fotos de ~1200 px. Evaluar con fotos reales de celular cuando funcione la lectura (2.5).
- [ ] **Prueba en navegador real**: para lógica de canvas/archivos se usó un script CDP en el scratchpad (no versionado). Si se necesita seguido, evaluar Playwright para tests e2e (`tests/`).
- [ ] **Fecha de pago aproximada en el pozo FIFO**: cuando una rendición se paga con el pozo se usa la fecha del último pago que lo alimentó, no necesariamente el que la cubrió. Si tesorería necesita exactitud, modelar el pozo como cola de pagos (4.x o 6.x).

## Decisiones abiertas

Ver "Decisiones abiertas" en [README.md](README.md) (hosting, login con Microsoft 365, notificaciones por correo, fecha de corte con el prototipo).
