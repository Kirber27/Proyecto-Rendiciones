# 04 · Libro de rendiciones — Tareas

Requiere: 01 (historial importado), 03.

- [x] **4.1 `asignacion.ts` (FIFO) + tests** _(R1.1, R1.2)_ — incluye test de saldos del historial.
  - `asignarPagos(rendiciones, pagos)`, `estadoPago`, `faltantesCorrelativo`; tipos en `src/types/pagos.ts`.
  - Paridad con `alloc()` del prototipo en 200 escenarios aleatorios y en el historial 2026 (totales y 6 saldos documentados).
- [ ] **4.2 Store `useLibroStore` + servicio de pagos (lectura)** _(R1)_
- [ ] **4.3 LibroView: KPIs, filtros, buscador, tabla paginada** _(R2.1–R2.3)_
- [ ] **4.4 Detalle + edición en el libro** _(R2.4, R2.5)_ — RPC `editar_rendicion`.
- [ ] **4.5 Anular, eliminar, restaurar** _(R3.1, R3.2)_ — RPCs + `ConfirmInline`.
- [ ] **4.6 Exportación a Excel** _(R4.1–R4.4)_ — 🟡 parcial
  - [x] SheetJS 0.20.3 instalado desde `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`.
  - [x] `domain/exportar.ts` (`filasExcel`, `seleccionarParaExportar`, encabezados/formatos/anchos) + `services/excel.ts` (`construirLibroExcel`, `descargarExcel`) + `lib/descargar.ts`.
  - [x] Tests: encabezados exactos, rendición de 3 líneas con pago en la última, archivo .xlsx leído de vuelta, paridad con el prototipo en las 612 filas del historial.
  - [ ] Botones "Excel (nuevas)/(todas)" en LibroView y `marcar_exportadas` tras descargar (requiere Supabase, 4.3 y RPC).
- [ ] **4.7 Reporte PDF** _(R3.3)_ — `jspdf` + `jspdf-autotable`, fotos con URL firmada, numeración de páginas. Probar con DHE-042 y una rendición histórica sin fotos.
