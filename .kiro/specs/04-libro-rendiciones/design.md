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

`src/domain/reporte.ts`: arma el modelo del reporte (filas, totales, meta) — puro. `services/pdf.ts` dibuja con jsPDF + autotable y agrega las fotos (descargadas con URL firmada → canvas → JPEG 0.82, lado 1800).

## Store `useLibroStore`

- Carga rendiciones aprobadas (+ líneas) y pagos (+ vínculos) de una vez (≈ 200 rendiciones / año; paginar en el servidor si supera 2.000).
- `asignacion` = `computed(() => asignarPagos(rendiciones, pagos))` compartido por Libro, Personas, Carpetas y Banco.
- Realtime sobre `rendiciones` y `pagos` para refrescar.

## RPC (migración `0011_rpc_libro.sql`)

`editar_rendicion(id, p, version)`, `anular_aprobacion(id, nota)`, `eliminar_rendicion(id, nota)`, `restaurar_rendicion(id)`, `marcar_exportadas(ids[])`. Todas `es_tesoreria()` y escriben evento.

## Descargas

`utils/descargar(blob, nombre)` con `URL.createObjectURL` + `<a download>` (ya no hay restricción de artifact).

## UI

```
LibroView
├── KpiTile × 4
├── barra: filtros (btn-group) · buscador · [Excel (nuevas)] [Excel (todas)]
├── tabla paginada (50 por página)
└── DetalleRendicion
    ├── encabezado: folio · persona · Nº · AppChip estado · [PDF] [Anular aprobación] [Eliminar]
    ├── ConfirmInline
    ├── resumen (.sum)
    ├── Timeline
    └── RendicionEditor mode="libro"
```
