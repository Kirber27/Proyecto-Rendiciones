# 07 · Banco y conciliación — Tareas

Requiere: 04, 06.

- [x] **7.1 `domain/cartola.ts` + tests** _(R1.2, R1.3)_
  - `detectarEncabezados`, `adivinarColumnas`, `construirMovimientos`, `resumenMovimientos`, `claveMovimiento`, `separarDuplicados` (R1.6, cuenta repeticiones); tipos en `src/types/banco.ts`.
  - Paridad con GUESS/leerCartola/buildMovs del prototipo en 200 cartolas generadas (5 formatos).
- [x] **7.2 `domain/conciliacion.ts` + tests** _(R2.1, R2.2, R3.1)_
  - `proponer` (3 niveles, sin reutilizar), `marcadaPorDefecto`, `candidatas` (selector manual, máx. 30), `personasParaAnticipo`, `coincidenciaNombre`.
  - Paridad con `proposals()` del prototipo en 300 escenarios aleatorios.
- [ ] **7.3 Cargar y guardar cartola (UI + servicio)** _(R1.1–R1.6)_ — 🟡 falta probar con cartolas reales
  - [x] `services/banco.ts` (`leerFilasArchivo` con SheetJS diferido, `guardarCartola` por RPC atómica, `leerCartolas` paginado de a 1.000) y `components/banco/CargarCartola.vue` (banco, mapeo con "(no tiene)", resumen, vista previa de 5, aviso de duplicados: no se guardan de nuevo).
  - [ ] Probar con cartolas reales de los 3 bancos y resolver la deuda de montos con punto decimal (ver DEUDA.md).
- [x] **7.4 RPCs de banco + tests SQL** _(R2.3, R3.2, R3.3, R4.1)_
  - Migración `20261026000015_rpc_banco.sql`: `guardar_cartola`, `confirmar_conciliacion` (todo o nada; cargo ya asignado o ignorado → error), `ignorar_movimiento`, `deshacer_asignacion` (borra el pago creado desde Banco, `obs = 'Banco'`, o desvincula el que ya existía), `eliminar_cartola`. Probado en `db:probar`.
- [x] **7.5 Propuestas y confirmación** _(R2)_
  - `stores/banco.ts` (propuestas sobre `useLibroStore`), `PropuestasConciliacion.vue` (no vuelve a marcar lo que tesorería desmarcó al recalcular), `domain/banco.ts` + tests.
- [x] **7.6 Cargos sin asignar + deshacer** _(R3)_
  - `CargosSinAsignar.vue` (de a 50; candidatas, anticipo, "No es de rendiciones") y lista plegable "Cargos asignados o ignorados" con Deshacer.
- [x] **7.7 Lista de cartolas + eliminar** _(R4.1)_
  - Conciliados "X de Y", confirmación en línea y aviso de cuántos pagos se borraron.
