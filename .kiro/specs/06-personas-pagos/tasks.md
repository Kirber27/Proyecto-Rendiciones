# 06 · Personas y pagos — Tareas

Requiere: 04.

- [x] **6.1 `domain/cuentaCorriente.ts` + tests** _(R2.1)_
  - `movimientosPersona` (saldo acumulado; rendiciones antes que pagos en la misma fecha; `eliminable` si el pago no viene de cartola), `situacionPersona`, `resumenPersonas` (KPIs), `ordenarPorSaldo`.
  - Verificado con el historial: cada cuenta termina en el saldo de la persona.
- [x] **6.2 RPC `registrar_pago` / `eliminar_pago` + tests SQL** _(R2.2, R3.2)_
  - Migración `20261026000014_rpc_pagos.sql`: signo según tipo (devolución negativa, resto positivo), vínculos solo a aprobadas de la misma persona, fecha de hoy por defecto; `eliminar_pago` rechaza los de cartola. `pagos` en la publicación de Realtime. Probado en `db:probar`.
  - `services/pagos.ts`: `registrarPago`, `eliminarPago`, `movimientoId` en `Pago`.
- [x] **6.3 PersonasView: KPIs, tabla, buscador** _(R1.1, R1.2)_
  - Datos de `useLibroStore`; columna Por aprobar con `porAprobarPorPersona()`. Incluye a las personas activas sin movimientos (para registrar un anticipo a alguien nuevo).
- [x] **6.4 Detalle de persona + FormPago** _(R2, R3)_
  - `components/personas/DetallePersona.vue` (movimientos con saldo acumulado, eliminar con confirmación en línea; los de cartola dicen "Cartola") y `FormPago.vue` (rendiciones pendientes a marcar; el monto propuesto es el saldo o la suma de las marcadas). `pendientesDePago` y `montoSugerido` en `domain/cuentaCorriente.ts` con tests.
