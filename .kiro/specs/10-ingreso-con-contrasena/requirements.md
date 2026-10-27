# 10 · Ingreso con contraseña — Requisitos

Reemplaza el ingreso por código de correo (spec 01, R3). Motivo: no hay servidor SMTP y el correo de Supabase por defecto tiene un límite muy bajo de envíos (y en proyectos nuevos solo envía al equipo del proyecto), lo que impide registrar y hacer entrar a varios usuarios. **La app no envía correos de ningún tipo.**

## R1. Ingreso

- **R1.1** CUANDO un usuario sin sesión abra la app, EL SISTEMA DEBERÁ mostrar la pantalla de ingreso con **correo** y **contraseña**.
- **R1.2** SI el correo o la contraseña no corresponden, ENTONCES EL SISTEMA DEBERÁ mostrar "Correo o contraseña incorrectos." sin indicar cuál de los dos falló.
- **R1.3** SI hay demasiados intentos seguidos, ENTONCES EL SISTEMA DEBERÁ pedir esperar un minuto.
- **R1.4** EL SISTEMA DEBERÁ mantener la sesión entre visitas y permitir cerrar sesión (igual que antes).
- **R1.5** La pantalla de ingreso NO DEBERÁ ofrecer crear cuenta ni ingresar con código.

## R2. Cuentas (las crea el administrador)

- **R2.1** EL SISTEMA DEBERÁ permitir al administrador, en Perfiles, **Crear cuenta** para una persona activa con correo registrado y sin cuenta.
- **R2.2** CUANDO se cree una cuenta, EL SISTEMA DEBERÁ generar una **contraseña temporal** y mostrarla una sola vez al administrador, con botón para copiarla, para que se la entregue a la persona.
- **R2.3** CUANDO se cree una cuenta, EL SISTEMA DEBERÁ vincularla con la persona del mismo correo (trigger existente).
- **R2.4** SI ya existe una cuenta con ese correo sin vincular, ENTONCES EL SISTEMA DEBERÁ avisar que se vincule en "Cuentas de usuario".
- **R2.5** Solo un administrador DEBERÁ poder crear cuentas o asignar contraseñas; la validación se hace en el servidor (Edge Function con la clave de servicio).
- **R2.6** El registro abierto (crear cuenta desde la API pública) DEBERÁ estar desactivado en Supabase; el hook `hook_validar_correo` se mantiene como segunda barrera.

## R3. Recuperar contraseña

- **R3.1** CUANDO el usuario toque "¿Olvidaste tu contraseña?", EL SISTEMA DEBERÁ explicar que el administrador le asigna una contraseña nueva desde Perfiles (sin enviar correos).
- **R3.2** EL SISTEMA DEBERÁ permitir al administrador, en Perfiles, asignar una **Nueva contraseña** temporal a una persona con cuenta, con confirmación en línea ("La actual deja de servir").
- **R3.3** SI el único administrador pierde su contraseña, ENTONCES DEBERÁ poder recuperarse desde la terminal con la clave secreta (script), sin pasar la clave por el chat ni por el repositorio.

## R4. Cambiar contraseña

- **R4.1** MIENTRAS la cuenta tenga una contraseña temporal, EL SISTEMA DEBERÁ llevar al usuario a "Elige tu contraseña" antes de cualquier otra pantalla.
- **R4.2** EL SISTEMA DEBERÁ permitir cambiar la contraseña cuando se quiera (desde el encabezado), pidiendo la contraseña actual.
- **R4.3** La contraseña nueva DEBERÁ tener al menos **8 caracteres**, repetirse igual y ser distinta de la actual; los problemas se muestran juntos.

## R5. Cuenta existente

- **R5.1** La cuenta que ya existe (administrador, creada con código) DEBERÁ conservarse con su vínculo y su función; se le asigna una contraseña con el script (R3.3) o desde Perfiles si su sesión sigue abierta.
