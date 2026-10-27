# 05 · Carpetas — Tareas

Requiere: 02, 03, 04 (asignación FIFO y Timeline).

- [x] **5.1 `domain/carpeta.ts` + tests** _(agrupación y estado actual)_
  - `estadoActual`, `grupoDe`, `ordenarEventos`, `eventoDePago`, `itemsCarpeta`, `gruposDeCarpeta`, `filtrarCarpeta`, `ordenarCarpetas`; tipos `EstadoRendicion` y `EventoRendicion` en `types/rendicion.ts`.
- [x] **5.2 `RendicionCard` con línea de tiempo desplegable** _(R1.1, R1.2)_ — `components/carpetas/RendicionCard.vue` (usa `LineaTiempo`).
- [x] **5.3 Mi carpeta (solicitante)** _(R1.1–R1.5)_ — `components/carpetas/CarpetaPersona.vue` + `services/carpetas.ts` (`leerCarpeta`: rendiciones, eventos, pagos con vínculos, estado FIFO). Devueltas → Corregir y reenviar (2.8).
- [x] **5.4 Índice de carpetas y carpeta por persona (tesorería)** _(R2.1–R2.3)_ — `leerIndiceCarpetas` (conteos, por aprobar, saldo); `/mis/:personaId` con Rendido/Pagado/Saldo; se refresca con Realtime.
- [ ] **5.5 Verificación de RLS** _(R1.6)_ — 🟡 verificado con usuarios simulados (`npm run db:probar`: un solicitante no ve rendiciones, líneas, eventos ni pagos ajenos; `v_rendiciones` respeta RLS). Falta confirmarlo con una cuenta real de solicitante.
