# 07 · Banco y conciliación — Diseño

## Dominio

- `domain/cartola.ts`: `detectarEncabezados(filas)`, `adivinarColumnas(encabezados)` (regex `GUESS` del prototipo como `PATRONES_COLUMNA`), `construirMovimientos(datos, mapa)` (porta `buildMovs`), `resumenMovimientos`, `separarDuplicados` (por fecha + montos + glosa normalizada, contando repeticiones). Tests con cartolas **ficticias** (no usar datos reales en el repo de tests).
- `domain/conciliacion.ts`: `proponer({ movimientos, rendiciones, pagos, asignacion, nombres })` → `{ propuestas, sinAsignar, pendientes }` (porta `proposals()`, incluido el subconjunto de hasta 12 por máscara de bits; `nombres` = mapa personaId → nombre para buscarlo en la glosa) y `candidatas(mov, pendientes, asignacion, nombres)` para el selector manual. Cada propuesta trae `marcada` (las "solo por monto" van sin marcar). Tests para cada uno de los 3 niveles, "no reutilizar" y paridad.

## Datos

- Lectura del archivo: SheetJS en el cliente (`import('xlsx')`, `cellDates: true`).
- Guardado: insert `cartolas` + bulk insert `cartola_movimientos` (lotes de 500).
- Movimiento asignado = existe `pagos.movimiento_id`. Ignorado = `ignorado = true`.

## RPC (migración `0013_rpc_banco.sql`)

```sql
confirmar_conciliacion(p jsonb)  -- [{ movimiento_id, tipo: 'link'|'rend'|'anticipo', pago_id?, rendicion_ids?, persona_id? }]
ignorar_movimiento(id uuid, valor bool)
deshacer_asignacion(movimiento_id uuid)
eliminar_cartola(id uuid) returns int  -- pagos eliminados
```

Pagos creados: `fecha = mov.fecha`, `medio_pago_id = cartola.medio_pago_id`, `monto = mov.cargo`, `descripcion = mov.descripcion`, `origen = 'App'`, `obs = 'Banco'`.

## UI

`BancoView` → `CargarCartola` (selector banco + archivo + `MapeoColumnas` + vista previa) · `PropuestasConciliacion` (tabla con checkboxes) · `CargosSinAsignar` (paginado de a 50) · `details` Cartolas cargadas.
