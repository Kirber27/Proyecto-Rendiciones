# 04 · Libro de rendiciones — Diseño

## Dominio

`src/domain/asignacion.ts` (porta `alloc()` tal cual, sobre tipos de dominio):

```ts
asignarPagos(rendiciones: RendicionLibro[], pagos: Pago[]): {
  porRendicion: Map<string, { pagado: number; saldo: number; estado: EstadoPago; ultimo: string }>
  porPersona:   Map<string, { personaId; nombre; rendido; pagado; saldo; n; max; faltantes: number[]; anticipos }>
}
```

Solo entran rendiciones `aprobada`. Nota: en el historial el correlativo de David Herce llega al Nº 35 (faltan 20, 21, 27, 28); el "36 a 41" de CLAUDE.md aparece al sumar la DHE-042 aprobada en la app. Tests obligatorios: pago vinculado exacto, pago agrupado a 2 rendiciones, anticipo que cubre la más antigua, devolución negativa, rendición sin monto, faltantes del correlativo. Validar además contra el historial: saldos al cargar (Dailin Arellano −471.991, Raúl Díaz −17.220, Abel Kottwitz +202.214, Tomás Castro +188.980, Brigitte Moran +71.188, Pia Cotronea +5.072; resto al día).

`src/domain/exportar.ts`: `filasExcel(rendiciones, pagos, catalogos)` → `(string|number|null)[][]` (pura, testeada). La escritura con SheetJS va en `services/excel.ts` con `import('xlsx')`.

`src/domain/reporte.ts`: `modeloReporte(entrada)` arma el contenido (datos, filas, totales, notas, nombre de archivo) — puro. `services/pdf.ts → generarReportePdf(modelo, fotos, { cargarImagen, onProgreso })` dibuja con jsPDF + autotable (tabla de gastos con anchos fijos para montos y Nº doc.) y agrega una página por foto (URL firmada → canvas → JPEG 0.82, lado 1800) y, desde la 2.13, una por cada página de los respaldos PDF (pdf-lib, ver spec 02 §Reporte). Los cargadores de fotos y PDF son inyectables para tests.

## Store `useLibroStore`

- Carga rendiciones aprobadas (+ líneas) y pagos (+ vínculos) de una vez (≈ 200 rendiciones / año; paginar en el servidor si supera 2.000).
- `asignacion` = `computed(() => asignarPagos(rendiciones, pagos))` compartido por Libro, Personas, Carpetas y Banco.
- Realtime sobre `rendiciones` y `pagos` para refrescar.

## RPC (migración `20261026000013_rpc_libro.sql`)

`editar_rendicion(id, p, version)`, `anular_aprobacion(id, nota)`, `eliminar_rendicion(id, nota)`, `restaurar_rendicion(id)`, `marcar_exportadas(ids[])`. Todas `es_tesoreria()`; todas menos `marcar_exportadas` escriben evento.

- `editar_rendicion`: solo `aprobada`; exige subcuenta y cuenta; `version` = `editado_en` visto al abrir (no pisa otra edición); recalcula el folio solo si cambian persona o Nº.
- `anular_aprobacion`: solo origen `App` (el historial no tiene aprobación que anular; se elimina).
- `eliminar_rendicion` guarda el estado en `rendiciones.estado_previo`; `restaurar_rendicion` lo devuelve tal cual.

## Descargas

`lib/descargar(blob, nombre)` con `URL.createObjectURL` + `<a download>` (ya no hay restricción de artifact).

## UI

```
LibroView
├── KpiTile × 4
├── barra: filtros (btn-group) · buscador · [Excel (nuevas)] [Excel (todas)]
├── tabla paginada (50 por página)
└── DetalleRendicion
    ├── encabezado: folio · persona · Nº · AppChip estado · [PDF] [Anular aprobación] [Eliminar]
    ├── confirmación en línea (con motivo opcional)
    ├── resumen (.sum)
    ├── LineaTiempo
    └── RendicionEditor modo="libro"
```
