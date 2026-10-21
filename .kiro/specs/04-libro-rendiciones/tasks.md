# 04 · Libro de rendiciones — Tareas

Requiere: 01 (historial importado), 03.

- [ ] **4.1 `asignacion.ts` (FIFO) + tests** _(R1.1, R1.2)_ — incluye test de saldos del historial.
- [ ] **4.2 Store `useLibroStore` + servicio de pagos (lectura)** _(R1)_
- [ ] **4.3 LibroView: KPIs, filtros, buscador, tabla paginada** _(R2.1–R2.3)_
- [ ] **4.4 Detalle + edición en el libro** _(R2.4, R2.5)_ — RPC `editar_rendicion`.
- [ ] **4.5 Anular, eliminar, restaurar** _(R3.1, R3.2)_ — RPCs + `ConfirmInline`.
- [ ] **4.6 Exportación a Excel** _(R4.1–R4.4)_
  - Instalar SheetJS desde `https://cdn.sheetjs.com/xlsx-<versión>/xlsx-<versión>.tgz`.
  - `domain/exportar.ts` con test que compara encabezados exactos (con espacios finales) y una rendición de 3 líneas con pago en la última.
- [ ] **4.7 Reporte PDF** _(R3.3)_ — `jspdf` + `jspdf-autotable`, fotos con URL firmada, numeración de páginas. Probar con DHE-042 y una rendición histórica sin fotos.
