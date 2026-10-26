# 04 · Libro de rendiciones — Tareas

Requiere: 01 (historial importado), 03.

- [x] **4.1 `asignacion.ts` (FIFO) + tests** _(R1.1, R1.2)_ — incluye test de saldos del historial.
  - `asignarPagos(rendiciones, pagos)`, `estadoPago`, `faltantesCorrelativo`; tipos en `src/types/pagos.ts`.
  - Paridad con `alloc()` del prototipo en 200 escenarios aleatorios y en el historial 2026 (totales y 6 saldos documentados).
- [x] **4.2 Store `useLibroStore` + servicio de pagos (lectura)** _(R1)_
  - `services/pagos.ts` (`leerPagos`, compartido con Carpetas), `services/libro.ts` (`listarLibro` sobre `v_rendiciones`, `leerLineas`), `stores/libro.ts` (asignación FIFO compartida, refresco con Realtime de rendiciones, limpieza al salir).
- [x] **4.3 LibroView: KPIs, filtros, buscador, tabla paginada** _(R2.1–R2.3)_
  - `domain/libro.ts` (`kpisLibro`, `filtrarLibro`, `paginar` de 50) + tests. Filtro extra "Eliminadas" (solo si hay).
- [x] **4.4 Detalle + edición en el libro** _(R2.4, R2.5)_ — RPC `editar_rendicion`.
  - Migración `20261026000013_rpc_libro.sql`; `components/libro/DetalleLibro.vue` (resumen, movimientos, editor modo libro). Concurrencia optimista con `editado_en`; el folio cambia solo si cambian persona o Nº.
- [x] **4.5 Anular, eliminar, restaurar** _(R3.1, R3.2)_ — RPCs + confirmación en línea.
  - `anular_aprobacion` (solo origen App, conserva folio), `eliminar_rendicion` (guarda `estado_previo`), `restaurar_rendicion` (vuelve al estado previo). Probado en `db:probar`.
- [x] **4.6 Exportación a Excel** _(R4.1–R4.4)_
  - [x] SheetJS 0.20.3 instalado desde `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`.
  - [x] `domain/exportar.ts` (`filasExcel`, `seleccionarParaExportar`, encabezados/formatos/anchos) + `services/excel.ts` (`construirLibroExcel`, `descargarExcel`) + `lib/descargar.ts`.
  - [x] Tests: encabezados exactos, rendición de 3 líneas con pago en la última, archivo .xlsx leído de vuelta, paridad con el prototipo en las 612 filas del historial.
  - [x] Botones "Excel (nuevas)/(todas)" en LibroView y `marcar_exportadas` tras descargar (`useLibroStore.exportarExcel`, `rendicionesParaExcel`, `pagosParaExcel`).
- [ ] **4.7 Reporte PDF** _(R3.3)_ — 🟡 falta probar en el navegador
  - [x] jsPDF 4.2 + jspdf-autotable 5.0; `domain/reporte.ts` (`modeloReporte`, `nombreArchivoReporte`) + `services/pdf.ts` (`generarReportePdf`, `descargarReportePdf`, cargador de fotos inyectable).
  - [x] Tests: modelo (datos, filas, totales, notas, nombre), PDF sin fotos, paginación con 60 líneas, foto que falla, foto real DHE-042 (página por respaldo). Revisado visualmente.
  - [x] Botón "Descargar reporte PDF" en el detalle del libro con progreso, con URLs firmadas de Storage (`entradaReporte` arma la entrada desde lo guardado).
  - [ ] Verificar en el navegador que las URLs firmadas de Storage permiten CORS (la foto entra al PDF).
