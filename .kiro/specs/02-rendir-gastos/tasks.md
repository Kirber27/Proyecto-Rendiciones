# 02 · Rendir gastos — Tareas

Requiere: 01 completo (auth, catálogos, esquema, storage).

## Primera versión (con lectura IA)

Las tareas marcadas ~~reemplazada~~ quedaron sin efecto con el rediseño del 2026-10-26 (ver abajo); el código se eliminó en 2.9–2.10.

- [x] **2.1 Dominio de rendición: validar y limpiar**
  - `validarRendicion(borrador, { esTesoreria, personasActivas })`, `limpiarRendicion()` y `lineaVacia()` en `src/domain/rendicion.ts`; tipos `BorradorRendicion`, `LineaBorrador`, `RendicionPayload` en `src/types/rendicion.ts`.
  - Tests: falta Nº, línea sin monto, no cuadra, tesorería sin subcuenta.

- [x] **2.2 Componentes del editor**
  - `MoneyInput`, `DatosFormulario`, `LineasTable` (tabla + tarjetas móviles), `CuadreTotales`, `RespaldosGrid`, `RendicionEditor` con slot de acciones.
  - Catálogos por props (`types/catalogos.ts`); demo con `src/dev/catalogosDemo.ts` (personas ficticias).

- [x] **2.3 FotoDrop + recortes** — ~~reemplazada~~: `FotoDrop` pasa a `RespaldosDrop` y los recortes se eliminan (2.9).

- [x] **2.4 Dominio de lectura** — ~~reemplazada~~: se elimina (2.9). `montoATexto` se conserva en `domain/formato.ts`.

- [x] **2.5 Edge Function `leer-rendicion`** — ~~reemplazada~~: se elimina del repo y de Supabase Cloud (2.10). Costo medido: ≈ US$ 0,043 por lectura con `claude-opus-5-5`.

- [x] **2.6 Store `useRendirStore` + RendirView** — ~~reemplazada~~ por 2.9 (sin lectura; formulario desde el inicio). Se conservan: solicitante fijo, borrador en el navegador por usuario, Descartar con confirmación en línea.

- [x] **2.7 RPC `enviar_rendicion` + envío** — probado el 2026-10-26
  - Migración `20261026000011_rpc_enviar_rendicion.sql`: crea o reenvía en una transacción, valida dueño/tesorería, estado (solo en revisión u observada), respaldos dentro de `<persona>/<rendición>/`, evento Enviada/Reenviada con resumen.
  - `services/rendiciones.ts`: fotos reducidas a 2400 px, un reintento, "ya existe" = subida; si falla alguna, avisa cuál y no envía; el reintento usa el mismo id y solo sube las que faltan.

- [x] **2.8 Corregir y reenviar**
  - `rendir.cargarParaCorregir(id)` (usa `abrirRendicion`): borrador con su id, respaldos guardados visibles (no se pueden quitar) y el motivo de tesorería; el envío conserva el id y queda como Reenviada.
  - Se abre desde Mis rendiciones → "Corregir y reenviar".

## Rediseño 2026-10-26: formulario manual + respaldos adjuntos

Cada tarea deja `build`, `lint` y `test` en verde.

- [x] **2.9 Formulario manual sin IA (frontend)** _(R1, R3.3, R3.5, R3.6, R6.1)_
  - `domain/rendicion.ts`: `borradorNuevo()` y `tieneDatos()` con tests. `montoATexto` a `domain/formato.ts`.
  - `domain/recortes.ts` → `domain/respaldos.ts` (`LADO_MAXIMO`, `escalaPara`, `separarImagenes` por ahora); `lib/imagenes.ts` solo con `reducirImagen`.
  - `stores/rendir.ts` sin lectura: `iniciar()`, borrador desde el inicio, guardado en el navegador solo si `tieneDatos`, Descartar/enviar dejan un formulario vacío.
  - `RendirView`: pasos nuevos y el editor desde el principio; las fotos se adjuntan con `RespaldosDrop` (antes `FotoDrop`, sin estado "leyendo") en el slot `#respaldos` del editor; prop `respaldos` del editor (antes `fotos`).
  - Eliminar: `domain/lectura.ts`, `services/lectura.ts`, `@shared/lectura` (y el alias `@shared` en Vite/TS), `prepararImagenes`, `dudas`/`documentosLeidos` del borrador, aviso de documentos/dudas del editor, sección de IA de `/_estilos`, estilos `.reading`/`.dot` y sus tests.
  - Hecho: `RendirView.test.ts` nuevo (formulario directo, validación, Descartar); 326 tests en verde.

- [x] **2.10 Quitar la lectura del backend** _(R6.1)_ — aplicada el 2026-10-26
  - Borrar `supabase/functions/` (`leer-rendicion`, `_shared`) y `[functions.leer-rendicion]` de `config.toml`; dependencia `zod` (solo la usaba la lectura).
  - Migración `20261026000016_quitar_lectura_ia.sql` (`drop table lecturas_ia`); `db:probar`, `db:push`, `db:types`.
  - En Supabase Cloud: `functions delete leer-rendicion` y `secrets unset ANTHROPIC_API_KEY` (era el único secreto propio). Verificado: sin funciones ni secretos de Anthropic; 0016 aplicada; `database.types.ts` sin `lecturas_ia`.
  - Pendiente del usuario: revocar la clave en la consola de Anthropic.

- [x] **2.11 Servidor: respaldo obligatorio y PDF** _(R2.5, R3.2)_ — aplicada el 2026-10-27
  - Migración `20261026000017_respaldos_pdf_obligatorio.sql`: bucket con `application/pdf`; `enviar_rendicion` con extensión `.jpg`/`.pdf`, mime por extensión y al menos un respaldo.
  - Casos nuevos en `db:probar` (bucket con PDF, sin respaldos falla sin dejar nada a medias, mime de foto y PDF, extensión no permitida, reenvío con respaldos guardados) y envíos de prueba de Por aprobar con respaldo. `db:push` hecho.

- [x] **2.12 Adjuntos PDF y respaldo obligatorio en la app** _(R2.1–R2.6, R3.1, R3.2, R3.4)_
  - `domain/respaldos.ts`: `TAMANO_MAXIMO`, `tipoRespaldo`, `revisarArchivos` (con tests).
  - `RespaldosDrop` acepta PDF (avisos de descartados); `RespaldosGrid` con ficha PDF; `Respaldo.tipo`.
  - `services/rendiciones.ts`: PDF sin reducir, `.pdf` y `application/pdf`. `abrirRendicion` devuelve `respaldos` con `tipo` (Por aprobar, libro, corregir).
  - `validarRendicion(…, { respaldos })` en Rendir gastos.
  - Hecho: `tipoArchivo` reconoce PDF sin mime por el nombre (algunos celulares); `respaldosGuardados()` compartido por store y `abrirRendicion`; el reporte del libro usa solo las fotos hasta la 2.13. 340 tests.

- [x] **2.13 Reporte PDF con respaldos PDF** _(R5.1, R5.2)_
  - `pdf-lib` (carga diferida). Páginas reservadas en jsPDF + `embedPdf`/`drawPage`. `DetalleLibro` pasa `{ url, tipo }`.
  - Tests: reporte con un PDF de 2 páginas (total de páginas y numeración), PDF ilegible deja aviso, orden imagen/PDF.
  - Hecho: `pdf-lib@1.17.1` en un chunk aparte (≈ 518 kB, solo si hay PDF); salida sin object streams. Revisado visualmente (página vertical y apaisada escaladas dentro de la caja, encabezado "Respaldo k de n · pág. j de m", numeración). 343 tests.

- [ ] **2.14 Prueba en el navegador** _(todo)_ — requiere iniciar sesión con una cuenta real (código por correo)
  - Celular: completar, adjuntar foto (cámara) y PDF, enviar; recargar a mitad y recuperar; observar → corregir y reenviar.
  - Escritorio (tesorería): ver y abrir el PDF en Por aprobar, aprobar y descargar el reporte con el PDF adentro.
