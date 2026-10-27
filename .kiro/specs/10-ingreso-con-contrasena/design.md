# 10 · Ingreso con contraseña — Diseño

## Flujo

```
Administrador (Perfiles) ── Crear cuenta / Nueva contraseña ──► Edge Function `cuentas` (clave de servicio)
        │                                                          └─ auth.admin.createUser / updateUserById
        └─ ve la contraseña temporal una vez y se la entrega          user_metadata.debe_cambiar_clave = true
Persona ── correo + contraseña temporal ──► signInWithPassword ──► guard: /clave ("Elige tu contraseña")
        └─ updateUser({ password, data: { debe_cambiar_clave: false } }) ──► app normal
```

Ningún paso envía correos.

## Supabase (panel, una vez)

Authentication → Sign In / Providers:

- **Allow new users to sign up: OFF.** Imprescindible: con el registro abierto, cualquiera con la clave pública podría crear la cuenta de un correo registrado antes que su dueño. `auth.admin.createUser` no se ve afectado.
- Email: habilitado (correo + contraseña). "Confirm email" da lo mismo (las cuentas se crean con `email_confirm: true`).
- Minimum password length: **8**.
- El hook *Before User Created* (`hook_validar_correo`) sigue activo.

`supabase/config.toml` se alinea (`enable_signup = false`, `minimum_password_length = 8`) solo como referencia: no se hace `config push` (pisaría el resto de la configuración del panel).

## Edge Function `cuentas`

```
POST /functions/v1/cuentas            Authorization: Bearer <jwt del administrador>
Body: { accion: 'crear' | 'restablecer', personaId: uuid }
→ 200 { clave: "K7QM-4XPR-2HTW" }
→ 401 sin sesión · 403 no es administrador · 404 persona inexistente o eliminada
→ 409 ya tiene cuenta / aún no tiene cuenta / correo con otra cuenta · 400 sin correo o cuerpo inválido
   { message } en español en todos los errores
```

1. `getUser(jwt)`; con el cliente de servicio verifica que sea persona activa con rol `administrador` (misma regla que `es_admin()`).
2. Lee la persona (`correo`, `user_id`, `eliminada_en`).
3. Genera la clave temporal: 12 caracteres de `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (sin 0/O, 1/I/L), con muestreo por rechazo, en grupos de 4.
4. `crear` → `auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { debe_cambiar_clave: true } })`; el trigger `after insert on auth.users` la vincula. `restablecer` → `auth.admin.updateUserById(user_id, { password, user_metadata: { debe_cambiar_clave: true } })`.
5. CORS como la función anterior. `verify_jwt = false` en `config.toml` (con las claves nuevas la función valida la sesión con `getUser`). Sin secretos propios: usa `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` que Supabase ya inyecta.

Despliegue: `npx supabase functions deploy cuentas --use-api` (sin Docker).

## Frontend

- `src/domain/acceso.ts`: `LARGO_MINIMO_CLAVE = 8`, `validarCambioClave({ nueva, repetida, actual?, pideActual })` → problemas juntos.
- `stores/auth.ts`: `entrar(correo, clave)` (`signInWithPassword`), `cambiarClave(nueva, actual?)` (si hay `actual`, se verifica con `signInWithPassword` antes; luego `updateUser`), `debeCambiarClave` (de `session.user.user_metadata`), `mensajeErrorIngreso` y `mensajeErrorClave` en español. Se eliminan `pedirCodigo` y `verificarCodigo`.
- `LoginView`: correo + contraseña (con botón mostrar/ocultar), "¿Olvidaste tu contraseña?" despliega la explicación de R3.1.
- `CambiarClaveView` (ruta `/clave`, cualquier sesión, sin pestaña): modo **obligatorio** (contraseña temporal: nueva + repetir) o **voluntario** (actual + nueva + repetir, con "Volver").
- Router: después de exigir sesión, `if (auth.debeCambiarClave && to.name !== 'clave') return { name: 'clave' }`.
- `AppHeader`: botón con ícono de llave → `/clave`.
- `services/cuentas.ts`: `crearCuenta(personaId)` y `nuevaClave(personaId)` con `functions.invoke('cuentas')`; el `message` del error de la función llega a la pantalla.
- `PerfilesView`, columna Cuenta: sin correo → chip "Sin correo"; con correo sin cuenta → botón **Crear cuenta**; con cuenta → chip "Con cuenta" + **Nueva contraseña** (confirmación en línea). La clave temporal se muestra en un aviso con **Copiar** hasta la siguiente acción o cerrarlo.

## Recuperación desde la terminal

`scripts/clave-temporal.mjs <correo>` (`npm run cuenta:clave -- <correo>`), con `SUPABASE_SECRET_KEY` solo en la terminal (como `db:historial`): busca la cuenta por correo (o la crea si la persona está registrada), le asigna una clave temporal con `debe_cambiar_clave` y la imprime en la terminal. Sirve para la cuenta que ya existía (entraba con código) y si el único administrador olvida su contraseña.
