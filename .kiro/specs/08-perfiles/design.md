# 08 · Perfiles — Diseño

- `domain/personas.ts`: `sugerirCodigo(nombre, usados)` (porta el del prototipo: inicial + 2 letras del apellido; si está usado, prueba variar la 3ª letra A–Z), `validarPersonaNueva(...)`, `validarCorreo`, `cambiarFuncion` (devuelve a quién degradar si se nombra Tesorero) y `puedeEliminar`. Las mismas reglas se repiten en las RPC (la base es la que manda); el dominio sirve para avisar en la UI antes de llamar. Tests.
- RPC (migración `20261026000010_rpc_perfiles.sql`, todas exigen `es_admin()`; errores en español que la UI muestra tal cual):
  - `guardar_persona(p jsonb)` — alta/edición (nombre, correo, código); valida formato y unicidad; conserva la grafía del historial si el nombre solo cambia en espacios; vincula la cuenta existente con ese correo.
  - `asignar_rol(persona_id, rol)` — en transacción: si `rol = 'tesorero'` degrada al actual; si deja 0 administradores → `raise 'ultimo_admin'`.
  - `eliminar_persona(id)` / `restaurar_persona(id)` — soft delete; `user_id = null` al eliminar; un tesorero eliminado pasa a solicitante (libera el cupo).
  - `vincular_cuenta(user_id, persona_id)`.
  - `listar_cuentas()` — `auth.users` (id, email, last_sign_in_at) + persona vinculada; `security definer` porque `auth.users` no es accesible al cliente.
- Invitaciones (opcional): Edge Function `invitar-persona` con service role → `auth.admin.inviteUserByEmail`.

UI: `PerfilesView` → tarjetas de funciones · tabla de personas con edición en línea (guardar al `change`, toast "Correo guardado.") · `details` eliminadas · `FormPersonaNueva` · `details` cuentas.
