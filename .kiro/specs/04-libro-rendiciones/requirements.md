# 04 · Libro de rendiciones — Requisitos

Libro oficial (aprobadas + historial 2026), estado de pago FIFO, PDF y Excel. Referencia: `alloc`, `vLibro`, `reportePDF`, `exportar`, `semana`.

## R1. Estado de pago (FIFO)

- **R1.1** EL SISTEMA DEBERÁ calcular por rendición: pagado, saldo, estado de pago (Sin monto / Pagada / Pago parcial / Pendiente de pago) y fecha del último pago, según `business-rules.md` §FIFO.
- **R1.2** EL SISTEMA DEBERÁ calcular por persona: rendido, pagado, saldo, anticipos, Nº máximo y faltantes del correlativo.

## R2. Libro

- **R2.1** EL SISTEMA DEBERÁ mostrar KPIs: Rendiciones, Total rendido, Pendiente de pago, Sin exportar a Excel.
- **R2.2** EL SISTEMA DEBERÁ ofrecer filtros Pendiente de pago · Pago parcial · Pagada · **Todas** (abre en Todas) y un buscador por persona, folio o Nº.
- **R2.3** Columnas: Folio, Fecha, Solicitante, Nº, Total, Pagado, Por pagar (— si ≤ 1), Estado, Origen. Orden: fecha descendente. Paginado o virtualizado (el prototipo cortaba en 300).
- **R2.4** CUANDO se seleccione una fila, EL SISTEMA DEBERÁ mostrar el detalle: resumen (total, pagado, saldo, aprobada el / origen, pagos vinculados), línea de tiempo y el editor en modo `libro`.
- **R2.5** CUANDO se guarde el editor, EL SISTEMA DEBERÁ actualizar la rendición y registrar el evento **Editada por tesorería**.

## R3. Acciones

- **R3.1** **Anular aprobación** (solo origen App): confirmación en línea "Se quita del libro y vuelve a Por aprobar con sus fotos". Vuelve a `en_revision` con `aprobacion_anulada`.
- **R3.2** **Eliminar**: confirmación en línea; pasa a `eliminada` (la persona la ve como Eliminada). Debe poder restaurarse desde un filtro "Eliminadas".
- **R3.3** **Descargar reporte PDF**: según `business-rules.md` §PDF, con progreso "Agregando respaldo k de n…".

## R4. Exportación a Excel

- **R4.1** **Excel (nuevas)**: exporta las no exportadas y las marca exportadas.
- **R4.2** **Excel (todas)**: exporta todo sin marcar.
- **R4.3** Columnas, formatos y reglas idénticos a `business-rules.md` §Excel. Nombre `Rendiciones_<YYYY-MM-DD>.xlsx`.
- **R4.4** SI no hay nuevas, ENTONCES EL SISTEMA DEBERÁ avisar "No hay rendiciones nuevas para exportar."
