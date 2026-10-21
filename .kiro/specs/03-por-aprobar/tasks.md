# 03 · Por aprobar — Tareas

Requiere: 01, 02 (editor y envío).

- [ ] **3.1 Vista `v_rendiciones` y servicio de bandeja** _(R1.1, R1.2)_
- [ ] **3.2 RPC de decisiones + `generar_folio`** _(R3.1–R3.3, R3.5)_
  - Tests SQL: folio con sufijo si existe; solicitante no puede aprobar; concurrencia `ya_revisada`.
- [ ] **3.3 Componente `Timeline`** _(R2.2)_ — reutilizable en Carpetas y Libro.
- [ ] **3.4 PorAprobarView** _(R1.3, R1.5, R2.1, R3.4)_ — tabla, editor modo aprobar, acciones, aviso de duplicado.
- [ ] **3.5 Badge en tiempo real** _(R1.4)_ — store `usePorAprobarStore` + Realtime.
