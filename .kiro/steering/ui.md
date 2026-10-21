# Guía de UI

La referencia visual es la maqueta `CLAUDE/app/rendiciones-heca.html`. La primera versión replica ese diseño sobre Bootstrap; los ajustes finos de UI vienen después.

## Tokens (fuente: `:root` de la maqueta → `src/assets/scss/_tokens.scss`)

| Token | Claro | Oscuro | Bootstrap |
| --- | --- | --- | --- |
| bg | `#F3F5F7` | `#0F151C` | `$body-bg` / `--bs-body-bg` |
| surface | `#FFFFFF` | `#18212B` | `$card-bg`, inputs, header |
| ink | `#16202B` | `#E6ECF2` | `$body-color` |
| muted | `#5A6878` | `#9AA8B7` | `$text-muted` / `--bs-secondary-color` |
| line | `#D9DFE6` | `#2C3946` | `$border-color` |
| accent | `#1F5FBF` | `#6EA3F2` | `$primary` |
| accent-soft | `#E6EEFA` | `#1C2E47` | `$primary-bg-subtle` |
| ok / ok-soft | `#1E7A4C` / `#E3F3EA` | `#5CC38E` / `#173226` | `$success` |
| warn / warn-soft | `#9A6700` / `#FBF0D6` | `#E3B04B` / `#3A2F14` | `$warning` |
| bad / bad-soft | `#B42318` / `#FCE7E5` | `#F2877C` / `#3D1D1A` | `$danger` |

- Tipografía: **IBM Plex Sans** (texto) y **IBM Plex Mono** (montos, folios, fechas en tablas). Base 14px, line-height 1.45.
- Radio: 8px (`$border-radius`), 6px en inputs (`$input-border-radius`). Sin sombras fuertes: bordes de 1px.
- Ancho de trabajo máx. 1160px, gutter 16px (respetando `safe-area-inset`).
- Modo oscuro: seguir `prefers-color-scheme` por defecto, con toggle que fija `data-bs-theme` (recordado en `localStorage`).

## Componentes de la maqueta → implementación

| Maqueta | Implementación |
| --- | --- |
| `header.top` + `nav.tabs` con badge | `AppHeader` + `AppTabs`: marca "Rendiciones Heca" + subtítulo mono "POE-GLO-FIN-003 · RENDICIÓN DE GASTOS"; pestañas tipo `nav-pills` con fondo accent-soft al estar activas y badge con el nº por aprobar. |
| `.panel` | `.card` sin sombra, `p-3`. |
| `.btn.primary / .okb / .danger / .big / .sm` | `btn-primary`, `btn-success`, `btn-outline-danger`, `btn-lg`, `btn-sm`. |
| `.chip.ok/warn/bad/info/muted` | `AppChip` (badge `rounded-pill` con fondo `*-subtle` y texto del color). |
| `label.f` (etiqueta mayúscula 11px) | `form-label` con clase `.label-caps`. |
| `.grid` de campos | `row g-3` con `col-12 col-sm-6 col-lg-4`. |
| `.scroll > table` | `table-responsive` + `table table-sm`, encabezados 11px mayúsculas, `td.n` mono alineado a la derecha con `tabular-nums`. |
| `table.edit` | `LineasTable`: inputs `form-control-sm` dentro de celdas. En móvil, una tarjeta por línea. |
| `.drop` | `FotoDrop`: zona punteada; botones "Tomar foto" (`capture="environment"`) y "Elegir fotos". |
| `.thumbs` | miniaturas 96×120 con botón × y zoom a `Lightbox`. |
| `.kpis` | `KpiTile` (etiqueta mayúscula + monto mono 18px). |
| `.cards` / `.card` | `RendicionCard` en grilla `row-cols-1 row-cols-md-2 row-cols-lg-3`. |
| `.msg.ok/warn/bad/info` | `alert` con variantes subtle. |
| `.sum` (cuadre) | `CuadreTotales`: suma, total formulario y chip "Cuadra" / "Diferencia $ X". |
| `.reading` + `.dot` pulsante | indicador "Leyendo fotos…" con botón Detener. |
| `.empty` | `EmptyState`. |
| Línea de tiempo | `Timeline` (lista vertical: chip del evento, fecha, nota). |

## Colores por estado (`EST_CHIP` / `EV_CHIP`)

- ok: Aprobada, Pagada, Pago.
- warn: Pago parcial, Reenviada, Aprobación anulada, Anticipo.
- bad: Observada, Rechazada, Eliminada.
- info: En revisión, Enviada, Pendiente de pago.
- muted: Sin monto, Ingresada (historial), No genera pago, Devolución.

## Principios

- Mobile first en Rendir gastos y Mis rendiciones; escritorio para el resto (tesorería).
- Foco visible (outline 2px accent). Etiquetas `aria-label` en inputs de tablas. Respetar `prefers-reduced-motion`.
- Confirmaciones destructivas en línea o modal ("¿Eliminar DHE-042? Esta acción queda en el historial.") — nunca `confirm()`.
- Mensajes cortos, en español de Chile, que digan qué hacer.
