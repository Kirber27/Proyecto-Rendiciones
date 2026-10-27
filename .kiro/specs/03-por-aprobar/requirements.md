# 03 · Por aprobar — Requisitos

Bandeja de tesorería para revisar envíos. Referencia: `porAprobar`, `vAprobar`, `setEstado`.

## R1. Bandeja

- **R1.1** EL SISTEMA DEBERÁ listar las rendiciones `en_revision` (nuevas, reenviadas y con aprobación anulada), de la más antigua a la más nueva.
- **R1.2** Columnas: Enviada, Solicitante, Nº, Fecha, Gastos (nº líneas), Total, Formulario (Cuadra / No cuadra / —), Marca (En revisión / Reenviada / Aprobación anulada).
- **R1.3** SI ya existe en el libro una rendición aprobada con el mismo folio calculado, ENTONCES EL SISTEMA DEBERÁ advertir "Ya existe ese Nº en el libro" bajo el nombre.
- **R1.4** EL SISTEMA DEBERÁ mostrar en la pestaña un badge con la cantidad pendiente, actualizado en tiempo real.
- **R1.5** SI no hay pendientes, ENTONCES EL SISTEMA DEBERÁ mostrar "No hay rendiciones esperando aprobación."

## R2. Revisión

- **R2.1** CUANDO tesorería seleccione una fila, EL SISTEMA DEBERÁ abrir el editor en modo `aprobar` (con Cuenta y C.C.) y los respaldos con zoom.
- **R2.2** EL SISTEMA DEBERÁ mostrar la línea de tiempo de la rendición (envíos, observaciones previas).

## R3. Decisiones

- **R3.1** CUANDO tesorería presione **Aprobar e ingresar**, EL SISTEMA DEBERÁ validar en modo tesorería (subcuenta y cuenta obligatorias), guardar las correcciones, asignar folio (`CODIGO-NNN`, con sufijo si existe), pasar a `aprobada` y registrar el evento **Aprobada**.
- **R3.2** CUANDO tesorería presione **Devolver para corregir**, EL SISTEMA DEBERÁ exigir el motivo (lo verá la persona), pasar a `observada` y registrar el evento **Observada** con la nota.
- **R3.3** CUANDO tesorería presione **Rechazar**, EL SISTEMA DEBERÁ pasar a `rechazada` con la nota escrita o "Rechazada por tesorería." y registrar el evento.
- **R3.4** Tras cualquier decisión, EL SISTEMA DEBERÁ cerrar el editor y quitar la fila de la bandeja.
- **R3.5** SI otra persona de tesorería ya decidió esa rendición, ENTONCES EL SISTEMA DEBERÁ rechazar la acción con "Esta rendición ya fue revisada" y refrescar.
