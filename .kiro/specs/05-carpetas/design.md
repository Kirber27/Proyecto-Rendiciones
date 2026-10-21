# 05 · Carpetas — Diseño

## Dominio (`src/domain/carpeta.ts`)

```ts
itemsCarpeta(rendiciones, eventos, asignacion) → ItemCarpeta[]
  // { id, folio, nro, fecha, total, respaldos, eventos: Evento[], actual: string, grupo: GrupoCarpeta }
grupoDe(item) → 'En revisión' | 'Observadas o rechazadas' | 'Por pagar' | 'Pagadas' | 'Eliminadas'
```

- Eventos = `rendicion_eventos` + evento de pago calculado (si aprobada: Pagada con fecha del último pago, o Pago parcial / Pendiente de pago).
- Estado actual = último evento que no sea "Reenviada" (`estadoActual`), salvo que la rendición esté aprobada → estado de pago.
- Histórico: evento "Ingresada (historial)" + estado de pago.

## Servicios

- Solicitante: `rendiciones` + `rendicion_eventos` + `respaldos(count)` + `pagos` propios (RLS filtra). `asignarPagos` sobre ese subconjunto.
- Tesorería: reutiliza `useLibroStore` + rendiciones no aprobadas (en_revision/observada/rechazada/eliminada) para el conteo y las carpetas.

## Rutas

- `/mis` — solicitante: su carpeta; tesorería: índice de carpetas.
- `/mis/:personaId` — carpeta de una persona (solo tesorería).
- Filtros en la query (`?f=por-pagar,pagadas`) para que se mantengan al volver.

## UI

`CarpetaIndex` (cards + buscador) · `CarpetaPersona` (resumen, filtros tipo KpiTile con checkbox, grilla de `RendicionCard` con `Timeline` desplegable, panel Devueltas, `details` de pagos).
