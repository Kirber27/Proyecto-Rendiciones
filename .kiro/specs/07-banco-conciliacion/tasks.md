# 07 · Banco y conciliación — Tareas

Requiere: 04, 06.

- [x] **7.1 `domain/cartola.ts` + tests** _(R1.2, R1.3)_
  - `detectarEncabezados`, `adivinarColumnas`, `construirMovimientos`, `resumenMovimientos`, `claveMovimiento`, `separarDuplicados` (R1.6, cuenta repeticiones); tipos en `src/types/banco.ts`.
  - Paridad con GUESS/leerCartola/buildMovs del prototipo en 200 cartolas generadas (5 formatos).
- [x] **7.2 `domain/conciliacion.ts` + tests** _(R2.1, R2.2, R3.1)_
  - `proponer` (3 niveles, sin reutilizar), `marcadaPorDefecto`, `candidatas` (selector manual, máx. 30), `personasParaAnticipo`, `coincidenciaNombre`.
  - Paridad con `proposals()` del prototipo en 300 escenarios aleatorios.
- [ ] **7.3 Cargar y guardar cartola (UI + servicio)** _(R1.1–R1.6)_
  - Probar con cartolas reales de los 3 bancos y resolver la deuda de montos con punto decimal (ver DEUDA.md).
- [ ] **7.4 RPCs de banco + tests SQL** _(R2.3, R3.2, R3.3, R4.1)_
- [ ] **7.5 Propuestas y confirmación** _(R2)_
- [ ] **7.6 Cargos sin asignar + deshacer** _(R3)_
- [ ] **7.7 Lista de cartolas + eliminar** _(R4.1)_
