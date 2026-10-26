# 03 · Por aprobar — Tareas

Requiere: 01, 02 (editor y envío).

- [x] **3.1 Vista `v_rendiciones` y servicio de bandeja** _(R1.1, R1.2)_ — vista con `security_invoker` (respeta RLS); `services/aprobacion.ts` (bandeja, folios existentes, contador, abrir con fotos firmadas).
- [x] **3.2 RPC de decisiones + `generar_folio`** _(R3.1–R3.3, R3.5)_
  - Migración `20261026000012_por_aprobar.sql` (aplicada): `aprobar_rendicion` (exige subcuenta y cuenta, folio con sufijo si existe, evento con el folio), `observar_rendicion` (motivo obligatorio), `rechazar_rendicion` (motivo por defecto), concurrencia por `editado_en`, Realtime en `rendiciones`. 18 casos en `npm run db:probar`.
- [x] **3.3 Componente `LineaTiempo`** _(R2.2)_ — reutilizable en Carpetas y Libro.
- [x] **3.4 PorAprobarView** _(R1.3, R1.5, R2.1, R3.4)_ — tabla, editor modo aprobar con fotos, movimientos, Aprobar / Devolver (motivo) / Rechazar (confirmación), aviso de Nº repetido; se refresca sola con Realtime.
- [x] **3.5 Badge en tiempo real** _(R1.4)_ — `stores/porAprobar.ts` (activo solo para tesorería; agrupa ráfagas de cambios).
- [ ] **Prueba real** de punta a punta: enviar desde Rendir gastos → aparece en Por aprobar (contador) → aprobar / devolver / rechazar.
