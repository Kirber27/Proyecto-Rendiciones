# 10 · Ingreso con contraseña — Tareas

Requiere: 01 (auth, personas, hook) y 08 (Perfiles). Reemplaza la parte de código por correo de 1.8 y la invitación opcional 8.7.

- [x] **10.1 Ingreso con correo y contraseña** _(R1, R3.1, R4)_
  - `domain/acceso.ts` (`validarCambioClave`) con tests.
  - `stores/auth.ts`: `entrar`, `cambiarClave`, `debeCambiarClave`, mensajes en español; quitar `pedirCodigo`/`verificarCodigo`.
  - `LoginView` (correo + contraseña + "¿Olvidaste tu contraseña?"), `CambiarClaveView` + ruta `/clave` + guard + botón en `AppHeader`.
  - Tests: mensajes de error, LoginView, CambiarClaveView (obligatorio y voluntario), guard.
  - Hecho: `auth.test.ts`, `LoginView.test.ts`, `CambiarClaveView.test.ts` nuevos; guard probado en `App.test.ts`. 362 tests.

- [x] **10.2 Edge Function `cuentas`** _(R2.1–R2.5, R3.2)_ — desplegada el 2026-10-27
  - `supabase/functions/cuentas/index.ts` + `deno.json` + `[functions.cuentas]` en `config.toml`.
  - Revisar tipos con TypeScript; desplegar con `--use-api`; verificar sin sesión → 401 y CORS.
  - Hecho: tipos revisados con `tsc --strict` y supabase-js 2.118.0; desplegada; sin sesión y con token falso → 401 "Tu sesión expiró…"; preflight CORS 200. `config.toml` alineado (`enable_signup = false`, largo mínimo 8) solo como referencia.

- [x] **10.3 Perfiles: crear cuenta y nueva contraseña** _(R2.1, R2.2, R2.4, R3.2)_
  - `services/cuentas.ts` + botones en la columna Cuenta, confirmación en línea, aviso con la clave temporal y Copiar.
  - Tests de la vista y del servicio (mensajes de error de la función).
  - Hecho: columna Cuenta con "Con cuenta" + Nueva contraseña (confirmación "La actual deja de servir"), Crear cuenta o "Sin correo"; aviso con la clave, Copiar y cerrar; textos de Perfiles sin "código por correo". 367 tests.

- [x] **10.4 Recuperación desde la terminal** _(R3.3, R5.1)_
  - `scripts/clave-temporal.mjs` + `npm run cuenta:clave`.
  - Hecho: asigna la temporal a la cuenta existente o la crea si el correo está en Perfiles. Probados los errores de uso y de clave faltante; el camino real requiere la clave secreta en la terminal del usuario (10.5).

- [ ] **10.5 Configuración en Supabase y prueba real** _(R2.6, R5.1)_ — la hace el usuario
  - Panel: desactivar "Allow new users to sign up", largo mínimo 8.
  - Dar contraseña a la cuenta existente (script o Perfiles) y entrar.
  - Crear la cuenta de un solicitante, entrar con la temporal desde el celular, cambiarla; probar "Nueva contraseña".
