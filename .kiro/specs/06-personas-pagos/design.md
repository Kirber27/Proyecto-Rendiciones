# 06 · Personas y pagos — Diseño

- Datos: `useLibroStore().asignacion.porPersona` + conteo de `en_revision` por persona.
- `domain/cuentaCorriente.ts`: `movimientosPersona(personaId, rendiciones, pagos, asignacion)` → filas con saldo acumulado (rendición antes que pago en la misma fecha). Testeado.
- RPC `registrar_pago(p jsonb)` (migración `0012_rpc_pagos.sql`): inserta pago + `pago_rendiciones`; signo según tipo; `origen = 'App'`. `eliminar_pago(id)`: solo si `movimiento_id is null`.
- Ya no hace falta `syncEstados()` del prototipo: el estado de pago se calcula siempre a partir de pagos (la persona lee sus propios pagos por RLS).

UI: `PersonasView` → KpiTile × 3, buscador, tabla clickeable, panel `DetallePersona` (tabla de movimientos + `FormPago`).
