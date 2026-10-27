# 02 · Rendir gastos — Diseño

> Rediseño 2026-10-26: formulario manual + respaldos adjuntos (imágenes y PDF). La lectura con IA (Edge Function `leer-rendicion`, recortes, prompt, `lecturas_ia`) se eliminó; su diseño queda en el historial de git (commit `3af03a4`).

## Componentes

```
RendirView
├── pasos                      (.steps: Completa · Adjunta · Envía)
└── RendicionEditor  modo="persona" | "aprobar" | "libro"
    ├── DatosFormulario        (solicitante, Nº, fecha, empresa, fondo, total formulario)
    ├── LineasTable            (tabla ≥ md, tarjetas < md; MoneyInput para montos)
    ├── CuadreTotales
    ├── slot #respaldos        (por defecto: RespaldosGrid de solo lectura, si hay respaldos)
    │   └── RespaldosDrop      (lo pone RendirView: selector + cámara + arrastrar, con RespaldosGrid adentro)
    └── slot #acciones         (cada modo pone sus botones)
```

- `RendicionEditor` es el mismo para los tres modos (como `editor()` del prototipo). Recibe `v-model` del borrador y `modo`; muestra Cuenta/C.C. solo si `modo !== 'persona'`. La prop `respaldos: Respaldo[]` reemplaza a `fotos`.
- `RespaldosDrop` (antes `FotoDrop`, sin estado "leyendo"): `accept="image/*,application/pdf"`; botón "Adjuntar fotos o PDF" + "Cámara" (solo móvil, `capture="environment"`); avisos de archivos descartados (`revisarArchivos`).
- `RespaldosGrid`: `Respaldo = { url, tipo: 'imagen' | 'pdf', nombre?, quitable? }`. Imagen → miniatura 96×120 con zoom en `AppLightbox`. PDF → ficha del mismo tamaño con ícono `bi-file-earmark-pdf` y nombre, que abre `url` en otra pestaña (`target="_blank" rel="noopener"`; sirve con `blob:` y con URL firmada).

## Estado: `useRendirStore`

```ts
borrador: BorradorRendicion | null      // se crea al entrar (borradorNuevo) o se recupera del navegador
archivos: { id; file; url; tipo }[]      // adjuntos locales aún no enviados
guardados: { path; url; tipo }[]         // respaldos ya en Storage (corregir y reenviar)
aviso, avisoEnvio: { tipo; texto } | null
enviando, progresoEnvio
acciones: iniciar, agregarArchivos, quitarArchivo, descartar, enviar, cargarParaCorregir(id)
```

- `iniciar()` (al montar la vista): carga catálogos; si no hay borrador, intenta recuperar el guardado y si no, crea uno con `borradorNuevo()`.
- Persistencia: `watch(borrador)` → `localStorage('rendir:borrador:<user_id>')` solo si `tieneDatos(borrador)`; si no, se borra la clave. Al recuperar se avisa que hay que volver a adjuntar los archivos. Al cambiar de usuario se limpia la memoria sin tocar lo guardado del otro (igual que antes).
- `descartar()` y el envío exitoso dejan un `borradorNuevo()` (no `null`).

## Dominio

`src/domain/rendicion.ts`:

- `borradorNuevo({ catalogos, personaFija, hoy })` → solicitante fijo o vacío, fecha de hoy, empresa *Hecaglobal Instruments SPA* (o la primera), una `lineaVacia` con fecha y C.C. de la empresa. Reemplaza a `completarAMano()` y a `aBorrador()`.
- `tieneDatos(borrador)` → `true` si tiene Nº, fondo, total del formulario, respaldos guardados, más de una línea o alguna línea con proveedor, RUT, Nº doc., detalle, subcuenta o monto.
- `validarRendicion(d, { esTesoreria, personasActivas, respaldos? })`: con `respaldos` (cantidad de guardados + nuevos) exige al menos uno: "Adjunta al menos un respaldo: la foto del formulario o de las boletas." Solo Rendir gastos lo pasa (el libro tiene rendiciones del historial sin respaldos).

`src/domain/formato.ts`: `montoATexto` (movido desde `domain/lectura.ts`; lo usa `aBorradorDesdeBase`).

`src/domain/respaldos.ts` (reemplaza a `recortes.ts`):

- `LADO_MAXIMO = 2400`, `escalaPara(ancho, alto, lado)` (lo usan la subida y el PDF).
- `TAMANO_MAXIMO = 10 MB` (igual que el bucket).
- `tipoRespaldo(mimeORuta)` → `'pdf'` si es `application/pdf` o termina en `.pdf`; si no `'imagen'`.
- `tipoArchivo(file)` → `'imagen' | 'pdf' | null` (un PDF sin mime, como lo entregan algunos celulares, se reconoce por el nombre).
- `revisarArchivos(archivos)` → `{ aceptados, aviso }`: descarta lo que no es imagen ni PDF y los PDF > 10 MB, con un aviso que junta los motivos.

`services/aprobacion.ts`: `abrirRendicion()` devuelve `respaldos: RespaldoGuardado[]` (`{ path, url, tipo }`, antes `fotos`); `respaldosGuardados(paths, urls)` lo comparten el store y Por aprobar/libro.

`src/lib/imagenes.ts` queda solo con `reducirImagen()`. `BorradorRendicion` pierde `dudas` y `documentosLeidos`.

## Envío

`services/rendiciones.ts → enviarRendicion(borrador, archivos, opciones)`:

1. `rendicion_id` = el existente (reenvío) o uno generado una vez por el store (reintentos en la misma carpeta).
2. Cada adjunto que falte se sube a `respaldos/<persona_id>/<rendicion_id>/<id>.<ext>`:
   - imagen → `reducirImagen` (2400 px, JPEG 0,85) → `.jpg`, `image/jpeg`;
   - PDF → tal cual → `.pdf`, `application/pdf`.
   Un reintento; "ya existe" cuenta como subido. Si alguno falla, avisa cuál y no envía.
3. `rpc('enviar_rendicion', { p: { …payload, respaldos: [guardados…, nuevos…] } })`.

## Servidor (migraciones nuevas)

- `20261026000016_quitar_lectura_ia.sql`: `drop table public.lecturas_ia` (sus políticas caen con la tabla).
- `20261026000017_respaldos_pdf_obligatorio.sql`:
  - bucket `respaldos`: `allowed_mime_types` suma `application/pdf` (sigue en 10 MB).
  - `enviar_rendicion` (`create or replace`, misma firma): cada ruta debe terminar en `.jpg` o `.pdf`; `mime` según la extensión; después de insertar, si la rendición no tiene ningún respaldo → `raise exception 'Adjunta al menos un respaldo: la foto del formulario o de las boletas.'` (la transacción se revierte).
- Casos nuevos en `npm run db:probar`: PDF guardado con su mime, sin respaldos falla, reenvío sin nuevos pero con guardados pasa, extensión no permitida falla.

Limpieza remota (2.10): `supabase functions delete leer-rendicion`, `supabase secrets unset ANTHROPIC_API_KEY ANTHROPIC_MODEL ANTHROPIC_EFFORT LIMITE_LECTURAS_DIA` (los que existan), `db push`, `db:types`. La clave de Anthropic se revoca en su consola (lo hace el usuario).

## Reporte PDF con respaldos PDF (`services/pdf.ts`)

`generarReportePdf(modelo, respaldos: { url, tipo }[], { cargarImagen, cargarPdf, onProgreso })`:

1. Si hay algún PDF, carga `pdf-lib` con `import()` junto con jsPDF.
2. jsPDF arma el reporte como antes y, por cada respaldo en orden: imagen → su página; PDF → lo abre (`cargarPdf(url)` → bytes, por defecto `fetch`; `PDFDocument.load` sin `ignoreEncryption`) y deja **una página reservada por cada página del PDF**, con el encabezado "<folio> · Respaldo k de n · pág. j de m"; PDF que no abre (dañado o con contraseña) → página con aviso. La numeración "Página i de n" la sigue poniendo jsPDF sobre el total final.
3. Si hubo páginas reservadas: `pdf-lib` abre la salida de jsPDF y dibuja cada página del respaldo (`embedPdf` + `drawPage`) escalada dentro de la misma caja que las fotos. Guarda sin object streams y devuelve los bytes.

Así el orden de respaldos y la numeración no cambian y `pdf-lib` solo se descarga cuando hay PDF.
