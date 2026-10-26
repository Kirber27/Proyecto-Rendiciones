# 02 · Rendir gastos — Tareas

Requiere: 01 completo (auth, catálogos, esquema, storage).

- [x] **2.1 Dominio de rendición: validar y limpiar** _(R4.1)_
  - `validarRendicion(borrador, { esTesoreria, personasActivas })`, `limpiarRendicion()` y `lineaVacia()` en `src/domain/rendicion.ts`; tipos `BorradorRendicion`, `LineaBorrador`, `RendicionPayload` en `src/types/rendicion.ts`.
  - Tests: falta Nº, línea sin monto, no cuadra, tesorería sin subcuenta.

- [x] **2.2 Componentes del editor** _(R3.1–R3.5)_
  - `MoneyInput`, `DatosFormulario`, `LineasTable` (tabla + tarjetas móviles), `CuadreTotales`, `RespaldosGrid`, `RendicionEditor` con slot de acciones.
  - Probar en `/_estilos` con un borrador de ejemplo (DHE-042: ISP, boleta 2026101400444231, $70.389, "CDA IMP ADEOR 07").
  - Hecho: catálogos por props (`types/catalogos.ts`); demo con `src/dev/catalogosDemo.ts` (personas ficticias) hasta la 1.9.

- [x] **2.3 FotoDrop + recortes** _(R1.1–R1.3, R2.2)_
  - Selector, cámara, drag&drop, miniaturas con quitar y zoom.
  - Recortes: `domain/recortes.ts` (plan, cajas, nota; con tests) + `lib/imagenes.ts` (`prepararImagenes`, `reducirImagen` con canvas).
  - Verificado en Chrome real con `ejemplo_formulario_DHE-042.jpg`: 1 foto → 5 imágenes, 3 → 15, 5 → 15, 8 → 8.

- [x] **2.4 Dominio de lectura** _(R2.4, R2.6, R2.7)_
  - `construirPrompt`, `RespuestaLecturaSchema`, `extraerRespuesta`, `ErrorLectura` en `supabase/functions/_shared/lectura.ts` (compartido, alias `@shared`); `aBorrador`, `montoATexto`, `mensajeErrorLectura` en `src/domain/lectura.ts`.
  - Test de paridad: el prompt es idéntico al `buildPrompt()` del prototipo (se lee del archivo original).
  - Tests con 2–3 respuestas JSON de ejemplo (con formulario, sin formulario, solicitante desconocido).

- [x] **2.5 Edge Function `leer-rendicion`** _(R2.3, R2.8)_ — probada el 2026-10-26
  - [x] Consultada la skill `claude-api`: SDK oficial `@anthropic-ai/sdk@0.133.0` (fijado), modelo `claude-opus-5-5` (secreto `ANTHROPIC_MODEL` para cambiarlo), esfuerzo `medium` (`ANTHROPIC_EFFORT`), **structured outputs** (`output_config.format` con `ESQUEMA_SALIDA`), y **fallbacks `"default"`** (beta `server-side-fallback-2026-07-01`) ante rechazos por política.
  - [x] `supabase/functions/leer-rendicion/index.ts` + `deno.json` (import map) + `[functions.leer-rendicion]` en `config.toml` (`verify_jwt = false`: la función valida la sesión con `getUser`). Sesión, cupo diario (`LIMITE_LECTURAS_DIA`, 30), listas desde la base, máx. 20 imágenes, errores con código, registro en `lecturas_ia`.
  - [x] Desplegada con `supabase functions deploy --use-api` (sin Docker). Verificado: sin sesión → `unauthorized`; CORS OK. Tipos revisados con TypeScript y el SDK real.
  - [x] Frontend: `services/lectura.ts` (`leerFotos`: base64, `functions.invoke`, códigos de error, Detener) y botón **Leer con IA** en `/_estilos`.
  - [x] Prueba real con `ejemplo_formulario_DHE-042.jpg`: 16 s, 5 imágenes, 9.206 tokens de entrada / 329 de salida ≈ US$ 0,043 por lectura. Se mantiene `claude-opus-5-5` con esfuerzo `medium`.

- [x] **2.6 Store `useRendirStore` + RendirView** _(R2.1, R2.5, R2.9, R4.5, R4.6)_
  - `stores/rendir.ts`: lectura automática al subir fotos (indicador inmediato), Detener, solicitante fijo si no es tesorería, "Volver a leer" cuando hay fotos nuevas, aviso si hay más de 20 fotos, borrador guardado en el navegador por usuario (se recupera al volver; se limpia en memoria al cambiar de usuario sin tocar lo guardado del otro), Descartar con confirmación en línea.
  - "Completar a mano" como salida si la lectura falla (no es el camino principal).
  - `views/RendirView.vue`. "Enviar rendición" valida y muestra los problemas; el envío real es 2.7.

- [x] **2.7 RPC `enviar_rendicion` + envío** _(R4.2–R4.4)_ — probado el 2026-10-26
  - [x] Migración `20261026000011_rpc_enviar_rendicion.sql` (aplicada): crea o reenvía en una transacción, valida dueño/tesorería, estado (solo en revisión u observada), fotos dentro de `<persona>/<rendición>/`, evento Enviada/Reenviada con resumen ("2 gasto(s) por $ 25.000"). 15 casos en `npm run db:probar`.
  - [x] `services/rendiciones.ts`: fotos reducidas a 2400 px, un reintento, "ya existe" = subida; si falla alguna, avisa cuál y no envía; el reintento usa el mismo id y solo sube las que faltan.
  - [x] Store y pantalla: progreso en el botón, mensaje "Rendición Nº X enviada por $ Y…", limpia el borrador.
  - [x] Prueba real: Nº 42 por $ 70.389 en revisión, 1 foto en Storage y en `respaldos`, evento Enviada.

- [x] **2.8 Corregir y reenviar** _(R5.1)_
  - `rendir.cargarParaCorregir(id)` (usa `abrirRendicion`): borrador con su id, fotos guardadas visibles (no se pueden quitar) y el motivo de tesorería; el envío conserva el id y queda como Reenviada.
  - Se abre desde Mis rendiciones → "Corregir y reenviar".
