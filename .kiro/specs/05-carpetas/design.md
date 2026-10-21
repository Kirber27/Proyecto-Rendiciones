# 05 · Carpetas — Diseño

## Dominio (`src/domain/carpeta.ts`)

```ts
itemsCarpeta(rendiciones: RendicionCarpeta[], pagos: Map<id, EstadoPagoRendicion>) → ItemCarpeta[]
  // { id, etiqueta (folio o "Envío 042"), nro, fecha, total, respaldos, actual, grupo, eventos, puedeCorregir, notaTesoreria }
grupoDe(actual) → 'En revisión' | 'Observadas o rechazadas' | 'Por pagar' | 'Pagadas' | 'Eliminadas' | 'Otras'
gruposDeCarpeta(items) · filtrarCarpeta(items, seleccion) · ordenarCarpetas(carpetas, busqueda)
```

- Eventos = `rendicion_eventos` **ordenados por fecha** (los sin fecha al final) + evento de pago calculado si está aprobada: Pagada ("Pagado $X", fecha del último pago), Pago parcial ("Pagado $X · falta $Y") o Pendiente de pago ("Falta $Y").
- Estado actual = **estado guardado** de la rendición (no se recorre la lista de eventos como en el prototipo, que mostraba "Observada" en una rendición ya reenviada):
  - `en_revision` → "Aprobación anulada" si `aprobacion_anulada`, "Reenviada" si el último evento es Reenviada, si no "En revisión".
  - `observada` / `rechazada` / `eliminada` → su nombre.
  - `aprobada` → estado de pago; si no tiene monto: "Aprobada" (App) o "Ingresada (historial)" (Histórico), grupo "Otras".
- Histórico: el importador crea el evento "Ingresada (historial)"; después se suma el evento de pago.

## Servicios

- Solicitante: `rendiciones` + `rendicion_eventos` + `respaldos(count)` + `pagos` propios (RLS filtra). `asignarPagos` sobre ese subconjunto.
- Tesorería: reutiliza `useLibroStore` + rendiciones no aprobadas (en_revision/observada/rechazada/eliminada) para el conteo y las carpetas.

## Rutas

- `/mis` — solicitante: su carpeta; tesorería: índice de carpetas.
- `/mis/:personaId` — carpeta de una persona (solo tesorería).
- Filtros en la query (`?f=por-pagar,pagadas`) para que se mantengan al volver.

## UI

`CarpetaIndex` (cards + buscador) · `CarpetaPersona` (resumen, filtros tipo KpiTile con checkbox, grilla de `RendicionCard` con `Timeline` desplegable, panel Devueltas, `details` de pagos).
