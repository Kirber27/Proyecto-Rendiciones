# 06 · Personas y pagos — Requisitos

Cuenta corriente por persona. Referencia: `vPersonas`.

## R1. Resumen

- **R1.1** EL SISTEMA DEBERÁ mostrar KPIs: Empresa debe (suma de saldos > 1), Fondos por rendir (suma de saldos < −1, en positivo), Personas con saldo.
- **R1.2** EL SISTEMA DEBERÁ listar personas con: Rendiciones, Último Nº, Nº faltantes, Rendido, Pagado, Saldo (color: positivo warn, negativo danger), Situación (Por pagar · N rend. / Pendiente por rendir / Al día), Por aprobar. Orden: |saldo| descendente. Buscador por nombre con "N de M personas".

## R2. Detalle de persona

- **R2.1** CUANDO se seleccione una persona, EL SISTEMA DEBERÁ mostrar sus movimientos en orden cronológico (rendiciones y pagos) con columnas Fecha, Movimiento, Detalle, Rendido, Pagado, **Saldo acumulado**, Estado.
- **R2.2** EL SISTEMA DEBERÁ permitir eliminar un pago manual con confirmación (los pagos conciliados con banco se desvinculan desde Banco).

## R3. Registrar pago o anticipo

- **R3.1** EL SISTEMA DEBERÁ ofrecer un formulario: Tipo (Pago, Anticipo, No genera pago, Devolución de la persona), Fecha (hoy), Pagado por (medio de pago, por defecto "Banco Internacional HGI "), Monto (por defecto el saldo si es positivo), Rendiciones a las que aplica (opcional, multi-selección de sus pendientes).
- **R3.2** CUANDO el tipo sea Devolución de la persona, EL SISTEMA DEBERÁ guardar el monto en negativo.
- **R3.3** SI el monto está vacío o es 0, ENTONCES EL SISTEMA DEBERÁ enfocar el campo sin guardar.
- **R3.4** Tras registrar, EL SISTEMA DEBERÁ recalcular estados de pago (los ve también la persona en su carpeta).
