# 07 · Banco y conciliación — Requisitos

Referencia: `vBanco`, `leerCartola`, `mapper`, `buildMovs`, `proposals`, `conciliacion`, `confirmar`, `markMov`, `GUESS`.

## R1. Cargar cartola

- **R1.1** EL SISTEMA DEBERÁ permitir elegir el medio de pago (banco) y un archivo `.xlsx`, `.xls` o `.csv`.
- **R1.2** EL SISTEMA DEBERÁ detectar la fila de encabezados y adivinar las columnas Fecha, Descripción, Cargo, Abono, Monto, Nº operación; cada una se puede corregir con un selector (incluye "(no tiene)").
- **R1.3** EL SISTEMA DEBERÁ mostrar el resumen "N movimientos · M cargos por $ X" y una vista previa de 5 filas.
- **R1.4** CUANDO se presione **Guardar cartola**, EL SISTEMA DEBERÁ guardar la cartola y sus movimientos.
- **R1.5** SI el archivo no se puede leer, ENTONCES EL SISTEMA DEBERÁ mostrar "No se pudo leer el archivo. Descárgalo del banco en formato Excel o CSV."
- **R1.6** EL SISTEMA DEBERÁ advertir si un movimiento parece duplicado de otra cartola (misma fecha, monto y glosa) y no volver a proponerlo.

## R2. Propuestas

- **R2.1** EL SISTEMA DEBERÁ calcular propuestas según `business-rules.md` §Conciliación y mostrarlas con: casilla, Fecha, Movimiento (+banco), Cargo, Corresponde a (persona · folio · saldo, o "Pago registrado a X el fecha"), Coincide por (chip ok o warn si es "solo monto").
- **R2.2** Las propuestas "Solo monto" y "Pago ya registrado · monto" DEBERÁN quedar sin marcar por defecto.
- **R2.3** CUANDO se presione **Confirmar seleccionados**, EL SISTEMA DEBERÁ crear los pagos (o vincular el pago existente al movimiento) en una sola transacción y mostrar "N movimiento(s) conciliado(s)".

## R3. Asignación manual

- **R3.1** EL SISTEMA DEBERÁ listar los cargos sin asignar con un selector: Pago de rendición (hasta 30 candidatas ordenadas por coincidencia de nombre y cercanía de monto) · Anticipo a (persona) · No es de rendiciones.
- **R3.2** CUANDO se presione **Aplicar**, EL SISTEMA DEBERÁ registrar la asignación.
- **R3.3** EL SISTEMA DEBERÁ permitir deshacer una asignación (borra el pago creado o desmarca ignorado).

## R4. Cartolas cargadas

- **R4.1** EL SISTEMA DEBERÁ listar las cartolas: archivo, banco, movimientos, "cargos conciliados X de Y", y permitir eliminarlas con confirmación (elimina también los pagos creados desde ella, avisando cuántos).
