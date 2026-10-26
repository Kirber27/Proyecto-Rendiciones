# 08 · Perfiles — Tareas

Requiere: 01. Puede adelantarse si se necesita cargar correos antes de abrir la app a los solicitantes.

- [x] **8.1 `domain/personas.ts` + tests** _(R3.1, R3.2)_
  - `sugerirCodigo` (paridad con el prototipo), `validarPersonaNueva` (todos los problemas juntos; avisa si la persona está eliminada), `correoValido`, `validarCorreo` (único), `cambiarFuncion` (un solo Tesorero, al menos un Administrador), `puedeEliminar`.
- [x] **8.2 RPCs de perfiles + tests SQL** _(R2.3, R2.4, R2.5, R4.1)_ — un solo tesorero, último admin.
  - Migración `20261026000010_rpc_perfiles.sql` (aplicada): `guardar_persona`, `asignar_rol`, `eliminar_persona`, `restaurar_persona`, `listar_cuentas`, `vincular_cuenta`. Al registrar un correo se vincula sola la cuenta que ya exista. Probadas en `npm run db:probar` (20 casos, incluidos rechazos a solicitantes).
- [x] **8.3 PerfilesView: tarjetas + tabla editable + buscador** _(R1, R2.1–R2.4)_ — `services/personas.ts`, `views/PerfilesView.vue` (+ tests).
- [x] **8.4 Eliminar / restaurar** _(R2.5, R2.6)_ — confirmación en línea; eliminar un tesorero libera el cupo.
- [x] **8.5 Agregar persona** _(R3)_ — `components/perfiles/FormPersonaNueva.vue` (código sugerido, todos los problemas juntos, función inicial).
- [ ] **8.6 Cuentas y vínculo manual** _(R4.1)_ — RPC listas (`listar_cuentas`, `vincular_cuenta`) y servicio; falta la sección plegable en la pantalla.
- [ ] **8.7 (Opcional) Invitaciones por correo** _(R4.2)_
