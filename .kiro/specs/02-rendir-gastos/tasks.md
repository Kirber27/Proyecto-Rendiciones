# 02 · Rendir gastos — Tareas

Requiere: 01 completo (auth, catálogos, esquema, storage).

- [x] **2.1 Dominio de rendición: validar y limpiar** _(R4.1)_
  - `validarRendicion(borrador, { esTesoreria, personasActivas })`, `limpiarRendicion()` y `lineaVacia()` en `src/domain/rendicion.ts`; tipos `BorradorRendicion`, `LineaBorrador`, `RendicionPayload` en `src/types/rendicion.ts`.
  - Tests: falta Nº, línea sin monto, no cuadra, tesorería sin subcuenta.

- [x] **2.2 Componentes del editor** _(R3.1–R3.5)_
  - `MoneyInput`, `DatosFormulario`, `LineasTable` (tabla + tarjetas móviles), `CuadreTotales`, `RespaldosGrid`, `RendicionEditor` con slot de acciones.
  - Probar en `/_estilos` con un borrador de ejemplo (DHE-042: ISP, boleta 2026101400444231, $70.389, "CDA IMP ADEOR 07").
  - Hecho: catálogos por props (`types/catalogos.ts`); demo con `src/dev/catalogosDemo.ts` (personas ficticias) hasta la 1.9.

- [ ] **2.3 FotoDrop + useImageTiles** _(R1.1–R1.3, R2.2)_
  - Selector, cámara, drag&drop, miniaturas con quitar y zoom.
  - Composable de recortes con test unitario de las cajas generadas (4 cuadrantes / 2 mitades).

- [ ] **2.4 Dominio de lectura** _(R2.4, R2.6, R2.7)_
  - `construirPrompt`, `RespuestaLecturaSchema`, `aBorrador`, mapa de errores.
  - Tests con 2–3 respuestas JSON de ejemplo (con formulario, sin formulario, solicitante desconocido).

- [ ] **2.5 Edge Function `leer-rendicion`** _(R2.3, R2.8)_
  - Consultar la skill `claude-api` antes de escribir la llamada (modelo, formato de imágenes, límites).
  - Auth, cupo diario, prompt desde la base, llamada, validación, registro en `lecturas_ia`, CORS.
  - `supabase functions serve` local + prueba con `CLAUDE/datos/original/ejemplo_formulario_DHE-042.jpg`.

- [ ] **2.6 Store `useRendirStore` + RendirView** _(R2.1, R2.5, R2.9, R4.5, R4.6)_
  - Flujo completo hasta mostrar el borrador; Detener con `AbortController`; persistencia del borrador.

- [ ] **2.7 RPC `enviar_rendicion` + envío** _(R4.2–R4.4)_
  - Migración de la RPC con validaciones; servicio de subida a Storage con reintento; mensaje de éxito.
  - Test SQL: un solicitante no puede enviar a nombre de otra persona ni reenviar una aprobada.

- [ ] **2.8 Corregir y reenviar** _(R5.1)_
  - `cargarParaCorregir(id)`: trae cabecera, líneas y respaldos; envío marca Reenviada.
  - (Se conecta desde Mis rendiciones en el spec 05.)
