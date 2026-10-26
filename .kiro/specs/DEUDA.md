# Deuda técnica y pendientes

Registro de lo que quedó en pausa, temporal o por resolver. Al cerrar un ítem: marcarlo `[x]` con la fecha y la tarea que lo resolvió.

## Bloqueos (esperan algo externo)

- [x] **Proyecto en Supabase Cloud** _(desde 2026-10-21; creado 2026-10-26: `vyornqwlmoqatjoverlh`, desarrollo)_ — vinculado y con las migraciones 1.5–1.7 aplicadas (2026-10-26).
  - Bloquea: **1.5–1.10** (esquema, RLS, seed, auth, catálogos, historial), **2.5** (Edge Function de lectura), **2.6–2.8** (flujo real de Rendir gastos), y todo lo que guarda o lee datos en 03–08.
  - Se necesita: `project ref`, URL, `anon key` (→ `.env.local`) y `service_role key` solo en variables de entorno locales para el importador del historial (nunca en el repo ni en el chat).
  - Al desbloquear: `supabase init` → `supabase link` → migraciones (1.5) → seguir el orden del índice.

## Código temporal (eliminar o reemplazar)

| Qué | Dónde | Se resuelve en |
| --- | --- | --- |
| ~~Selector "Dev: rol"~~ | eliminado | ✔ 1.8 (2026-10-26) |
| ~~`useAuthStore` mínimo~~ | sesión real + persona vinculada | ✔ 1.8 |
| ~~Guard sin verificación de sesión~~ | redirige a `/ingresar?volver=…` | ✔ 1.8 |
| ~~`LoginView` placeholder~~ | correo + código | ✔ 1.8 |
| ~~Catálogos de demo en `/_estilos`~~ | `/_estilos` usa el store real; `src/dev/catalogosDemo.ts` queda solo para tests | ✔ 1.9 (2026-10-26) |
| Vistas "En construcción" | `src/views/*View.vue` | cada spec |
| Página de muestra `/_estilos` (solo dev) | `src/views/EstilosView.vue` | revisar al terminar el hito 1: dejarla como catálogo de componentes o borrarla |

## Pendientes técnicos

- [x] **Clave secreta expuesta en el chat** _(2026-10-26)_: se eliminó y se creó una nueva. Regla: la clave secreta solo se escribe en la terminal (`export SUPABASE_SECRET_KEY=…` en una línea aparte), nunca en el chat ni en archivos del repo.
- [ ] **Node de la terminal**: hay un Node 20 en `/usr/local/bin` que tapa al Node 26 de Homebrew. Poner `/opt/homebrew/bin` primero en el `PATH` (`~/.zshrc`) o desinstalar el Node 20 antiguo.

- [x] **Activar el Auth Hook en el panel de Supabase** _(activado 2026-10-26)_: Authentication → Hooks → *Before User Created* → función `public.hook_validar_correo`. Sin esto, cualquier correo podría crear cuenta (aunque sin persona vinculada no ve datos). Revisar también en Authentication: *Site URL* `http://localhost:5173` (dev) y plantilla de correo en español (1.8).
- [ ] **Correo de Supabase por defecto**: tiene límite bajo de envíos por hora y en proyectos nuevos solo envía a correos del equipo del proyecto. Sirve para desarrollo; para los usuarios reales configurar SMTP propio (M365 de Heca) en *Authentication → SMTP* (9.3).
- [ ] **Plantilla del correo de acceso**: en *Authentication → Email Templates → Magic Link* incluir el código `{{ .Token }}` (además del enlace) y textos en español. Agregar `http://localhost:5173` en *URL Configuration → Redirect URLs* para que el enlace funcione en desarrollo.
- [ ] **Proyecto de producción separado**: el actual es de desarrollo. Antes de usar datos reales, crear otro proyecto y aplicar las mismas migraciones (9.1).
- [x] **Import map de la Edge Function** _(2.5)_: `supabase/functions/leer-rendicion/deno.json` (zod, SDK de Anthropic, supabase-js con versiones fijas).
- [ ] **Tamaño del cuerpo de la lectura**: hasta 20 imágenes JPEG en base64 (≈ 10–16 MB). Si Supabase rechaza el cuerpo por tamaño, bajar `MAX_IMAGENES_LECTURA` o subir las fotos a Storage antes de leer.
- [x] **Costo y tiempo de cada lectura** _(medido 2026-10-26)_: DHE-042 = 16 s, ≈ US$ 0,043 (9.206 / 329 tokens). Con ~18 rendiciones al mes, < US$ 2/mes. Se mantiene `claude-opus-5-5` + `medium`; revisar `lecturas_ia` con fotos reales de celular (más resolución = más tokens).
- [ ] **SDK de Anthropic en 0.133.0** (fijado por antigüedad ≥ 2 semanas). Existe la serie 1.x (octubre 2026): evaluar actualizar con la guía `upgrade` cuando tenga algunas semanas.
- [ ] **Scripts de instalación bloqueados por npm** (`fsevents`, `@parcel/watcher`): no afectan hoy; si falla el watch de Sass, `npm approve-scripts`.
- [ ] **Tabla de gastos ancha en escritorio**: con Cuenta y C.C. scrollea horizontal (igual que el prototipo). Evaluar en el ajuste de UI (columnas compactas o detalle desplegable).
- [ ] **Recortes con fotos de baja resolución**: no se agrandan, así que aportan poco en fotos de ~1200 px. Evaluar con fotos reales de celular cuando funcione la lectura (2.5).
- [ ] **Prueba en navegador real**: para lógica de canvas/archivos se usó un script CDP en el scratchpad, y para revisar PDFs un script Swift con PDFKit (ninguno versionado). Si se necesita seguido, evaluar Playwright para tests e2e (`tests/`).
- [ ] **Fotos de Storage en el PDF**: el cargador usa `crossOrigin = 'anonymous'`; verificar que las URLs firmadas de Supabase Storage permitan CORS al integrar 4.7.
- [ ] **Fecha de pago aproximada en el pozo FIFO**: cuando una rendición se paga con el pozo se usa la fecha del último pago que lo alimentó, no necesariamente el que la cubrió. Si tesorería necesita exactitud, modelar el pozo como cola de pagos (4.x o 6.x).
- [ ] **Montos con punto decimal en cartolas CSV** _(detectado en 7.1, también ocurre en el prototipo)_: `num("70389.00")` da 7.038.900 (lee el punto como miles). No afecta montos chilenos (`70.389`, `70.389,00`) ni celdas numéricas de Excel. Corrección propuesta: si el texto termina en `.` + 1–2 dígitos y no tiene coma, tratar el punto como decimal (en CLP un separador de miles siempre va seguido de 3 dígitos). Rompe la paridad con `num("3.5")` del prototipo, por eso queda para decidir. Validar en 7.3 con cartolas reales de Banco Internacional, BancoEstado y Scotiabank.
- [ ] **Conciliación con apellidos compartidos** _(7.2, igual que el prototipo)_: si la glosa nombra a "MARIO ROJAS" y hay pagos o rendiciones de Mario Rojas y de Laura Rojas por el mismo monto, ambos coinciden ("rojas") y no se propone nada. Mejora posible: preferir el candidato con más palabras coincidentes cuando hay uno solo con el máximo. Rompe la paridad; decidir con casos reales de tesorería.

- [ ] **Fotos huérfanas en Storage** _(2.7)_: si alguien sube fotos y nunca termina de enviar, o quita una foto después de subirla, el archivo queda en `respaldos/` sin rendición. No afecta el funcionamiento; limpiar con una tarea programada (archivos sin fila en `respaldos` con más de 7 días).

- [ ] **Editar en el libro una rendición de persona eliminada** _(4.4)_: la validación y `editar_rendicion` exigen un solicitante activo, así que no se puede guardar sin restaurar a la persona en Perfiles o cambiar el solicitante. Si molesta, aceptar la persona actual aunque esté eliminada.
- [x] **Libro sin Realtime de pagos** _(4.2 → resuelto en 6.2)_: `pagos` está en la publicación de Realtime y `usePorAprobarStore` escucha ambas tablas.
- [ ] **Límite de 1.000 filas por consulta de Supabase** _(detectado en 7.3)_: `listarLibro`, `leerPagos` y `leerIndiceCarpetas` piden todo con `.limit(10000)`, pero la API corta en 1.000 (`max_rows`). Hoy hay ~200 rendiciones y ~180 pagos; antes de llegar a 1.000 paginar con `.range()` como `leerCartolas`, o subir `max_rows` en el proyecto.
- [ ] **Índice de carpetas carga todo**: `leerIndiceCarpetas` trae todas las rendiciones y pagos (hoy ~200 + ~180) para calcular saldos. Si pasan de unos miles, mover el cálculo a una vista o función SQL.

## Decisiones abiertas

Ver "Decisiones abiertas" en [README.md](README.md) (hosting, login con Microsoft 365, notificaciones por correo, fecha de corte con el prototipo).
