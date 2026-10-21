# 08 · Perfiles (administración) — Requisitos

Referencia: `vConfig`, `savePersona`, `setFuncionPersona`, `sugerirCodigo`.

## R1. Resumen de funciones

- **R1.1** EL SISTEMA DEBERÁ mostrar 3 tarjetas (Administrador · Gestiona perfiles y ve todo; Tesorero · Aprueba, ingresa, concilia y paga; Solicitante · Solo sube sus rendiciones) con la cantidad de personas.

## R2. Personas

- **R2.1** EL SISTEMA DEBERÁ listar personas activas: Persona, Código, Correo (editable), Función (selector), Rendiciones, Origen (Historial / Nueva), Cuenta (vinculada / sin vincular / invitación enviada), Eliminar. Buscador por nombre o correo. Orden: función y nombre.
- **R2.2** CUANDO se edite un correo, EL SISTEMA DEBERÁ validar el formato y que no lo use otra persona.
- **R2.3** CUANDO se asigne **Tesorero**, EL SISTEMA DEBERÁ dejar al tesorero anterior como Solicitante y avisarlo.
- **R2.4** EL SISTEMA DEBERÁ impedir quitar o eliminar al último Administrador ("Debe quedar al menos un Administrador.").
- **R2.5** **Eliminar** con confirmación en línea ("Su historial se mantiene."): marca `eliminada_en`, desvincula la cuenta y la saca de las listas.
- **R2.6** EL SISTEMA DEBERÁ listar personas eliminadas (plegable) con fecha y botón **Restaurar**.

## R3. Agregar persona

- **R3.1** EL SISTEMA DEBERÁ ofrecer el formulario Nombre (nombre y apellido), Correo, Código (sugerido automáticamente mientras no se edite), Función.
- **R3.2** Validaciones: nombre con al menos 2 palabras; no repetida (por `norm`); correo válido; código `^[A-Z]{2,4}$` y único.
- **R3.3** CUANDO se agregue, EL SISTEMA DEBERÁ dejarla disponible de inmediato en todas las listas y, si tiene correo, permitirle ingresar.

## R4. Cuentas

- **R4.1** EL SISTEMA DEBERÁ mostrar (plegable) las cuentas de usuario existentes con su persona vinculada, permitiendo re-vincular manualmente, y las cuentas sin persona.
- **R4.2** (Opcional) EL SISTEMA DEBERÁ permitir **Enviar invitación** al correo de una persona.
