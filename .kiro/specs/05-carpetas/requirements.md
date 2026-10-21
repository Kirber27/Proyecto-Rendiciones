# 05 · Mis rendiciones / Carpetas — Requisitos

Referencia: `vMias`, `carpeta`, `carpetaItems`, `itemCard`, `eventosEnvio`, `estadoActual`.

## R1. Mi carpeta (solicitante)

- **R1.1** EL SISTEMA DEBERÁ mostrar el nombre de la persona y todas sus rendiciones (enviadas desde la app e históricas) como tarjetas: "Nº X · fecha", chip del estado actual, monto, folio (o "Envío") y nº de respaldos. Orden: más reciente primero.
- **R1.2** CUANDO se toque una tarjeta, EL SISTEMA DEBERÁ desplegar su línea de tiempo (fecha, chip del evento, nota), incluyendo eventos de pago calculados (Pagada / Pago parcial / Pendiente de pago).
- **R1.3** EL SISTEMA DEBERÁ ofrecer filtros por casillas con conteo: En revisión · Observadas o rechazadas · Por pagar · Pagadas · Eliminadas (esta última solo si hay). Sin casillas marcadas = todas. Botón "Quitar filtros".
- **R1.4** SI hay rendiciones Observadas, ENTONCES EL SISTEMA DEBERÁ mostrar el panel "Devueltas para corregir" con el motivo y el botón **Corregir y reenviar** (abre Rendir gastos con el borrador cargado).
- **R1.5** EL SISTEMA DEBERÁ mostrar los pagos y anticipos recibidos (plegable): fecha, tipo, medio de pago, monto, folios.
- **R1.6** Un solicitante NO DEBERÁ poder ver rendiciones ni pagos de otras personas (garantizado por RLS).

## R2. Carpetas (tesorería)

- **R2.1** EL SISTEMA DEBERÁ mostrar una tarjeta por persona activa con: nombre, chip "N por aprobar", nº de rendiciones, saldo (si |saldo| > 1) y "Abrir carpeta →". Orden: más por aprobar, luego más rendiciones, luego nombre.
- **R2.2** EL SISTEMA DEBERÁ ofrecer un buscador por nombre.
- **R2.3** CUANDO se abra una carpeta, EL SISTEMA DEBERÁ mostrar lo mismo que R1 para esa persona, con resumen Rendido · Pagado · Saldo y botón "← Todas las carpetas".

## Agrupación de estados

| Estado actual | Grupo |
| --- | --- |
| En revisión, Enviada, Reenviada, Aprobación anulada | En revisión |
| Observada, Rechazada | Observadas o rechazadas |
| Aprobada + Pendiente de pago / Pago parcial | Por pagar |
| Pagada | Pagadas |
| Eliminada | Eliminadas |
