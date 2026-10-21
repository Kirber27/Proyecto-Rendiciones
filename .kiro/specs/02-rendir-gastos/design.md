# 02 · Rendir gastos — Diseño

## Componentes

```
RendirView
├── PasosRendir                (3 pasos)
├── FotoDrop                   (input file multiple + capture, drag&drop, miniaturas, estado leyendo)
├── LecturaEstado              (alerta de error con reintentar / empezar de nuevo)
└── RendicionEditor  mode="persona" | "aprobar" | "libro"
    ├── DatosFormulario        (solicitante, Nº, fecha, empresa, fondo, total formulario)
    ├── AvisoLectura           (N documentos, dudas)
    ├── LineasTable            (tabla ≥ md, tarjetas < md; MoneyInput para montos)
    ├── CuadreTotales
    ├── RespaldosGrid          (miniaturas: fotos locales + respaldos guardados con URL firmada)
    └── slot #acciones         (cada modo pone sus botones)
```

`RendicionEditor` es el mismo para los tres modos (como `editor()` del prototipo). Recibe `v-model` del borrador y `mode`; muestra Cuenta/C.C. solo si `mode !== 'persona'`.

## Estado: `useRendirStore`

```ts
fotos: { id: string; file: File; url: string }[]
borrador: Borrador | null          // tipo de dominio con montos como string mientras se edita
leyendo: boolean; abort: AbortController | null
errorLectura: { tipo: 'info'|'warn'|'bad'; texto: string } | null
mensajeEnvio: ...
acciones: agregarFotos, quitarFoto, leer, cancelarLectura, descartar, enviar, cargarParaCorregir(id)
```

Persistencia del borrador: `watch(borrador)` → `localStorage('rendir:borrador')` con try/catch (sin fotos).

## Dominio (`src/domain/lectura.ts`)

- `construirPrompt({ subcuentas, personas, empresas, notaImagenes })` → string (porta `buildPrompt` literal).
- `RespuestaLecturaSchema` (zod): todos los campos opcionales/tolerantes (`z.coerce`), `lineas` array.
- `aBorrador(respuesta, ctx)` → `Borrador` (porta el mapeo de `leer()`: `raw()` contra listas, empresa por defecto HGI, C.C. de la empresa, cuenta sugerida, `num()`, `parseDate()`, limpieza de `numero`). Testeado con respuestas fijas.

## Recortes (`composables/useImageTiles.ts`)

Porta `prepImages(files, max)`: `createImageBitmap(file, { imageOrientation: 'from-image' })`, canvas, JPEG 0.9, lado máx 2400. Además **reduce la foto completa** a lado máx 2400 / JPEG 0.85 para no exceder límites de tamaño. Devuelve `{ imagenes: Blob[], nota: string }`.

## Edge Function `leer-rendicion`

```
POST /functions/v1/leer-rendicion
Authorization: Bearer <jwt usuario>
Body: { imagenes: [{ media_type, data(base64) }], nota: string }
→ 200 { respuesta: RespuestaLectura, documentos: number }
→ 4xx/5xx { code: 'rate_limited' | 'image_rejected' | 'invalid_json' | 'unauthorized' | 'error' }
```

1. Verifica JWT (`supabase.auth.getUser`), obtiene persona y rol.
2. Revisa cupo diario en `lecturas_ia`.
3. Construye el prompt **en el servidor** (las listas se leen de la base; así el cliente no puede alterarlo). El prompt vive en `supabase/functions/_shared/prompt.ts`, compartido con el test de dominio.
4. Llama a la API de Messages de Anthropic con las imágenes como bloques `image` base64 + texto. Pide respuesta solo JSON. Modelo desde `ANTHROPIC_MODEL`.
5. Extrae el JSON (tolerando ```json fences), valida con zod; si falla → `invalid_json`.
6. Inserta fila en `lecturas_ia` (tokens, ok/error).
7. CORS para el origen del frontend.

Constantes: `MAX_IMAGENES = 20` por lectura (el cliente usa este valor como `max` para los recortes).

## Envío

`services/rendiciones.ts → enviar(borrador, fotos)`:

1. Genera `rendicion_id = crypto.randomUUID()` (o el existente si es reenvío).
2. Sube cada foto a `respaldos/<persona_id>/<rendicion_id>/<uuid>.jpg` (comprimida a 2400 px).
3. `rpc('enviar_rendicion', { p: { id, persona_id, nro, fecha, empresa_id, fondo, total_formulario, lineas: [...], respaldos: [paths] } })`.

RPC `enviar_rendicion` (migración `0009_rpc_enviar.sql`):
- Verifica que `persona_id = mi_persona_id()` o `es_tesoreria()`.
- Si `id` existe: debe ser de la persona y estar `en_revision` u `observada` (si no → error "Esta rendición ya fue revisada").
- Upsert cabecera, borra y reinserta líneas, inserta respaldos nuevos, recalcula total.
- Estado → `en_revision`, `editado_en = now()`; evento `Enviada` (nuevo) o `Reenviada`.

## Errores de usuario

Mapa `code → mensaje` en `domain/lectura.ts` (mismos textos del prototipo, cambiando "permiso de Claude" por mensajes de sesión).
