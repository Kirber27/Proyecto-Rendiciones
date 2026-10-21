// Lectura de rendiciones con IA: prompt, forma de la respuesta y extracción del JSON.
// Compartido entre la Edge Function `leer-rendicion` (Deno) y el frontend (tests y validación).
// Debe quedar puro: sin APIs de Deno ni del navegador. Única dependencia: zod
// (en Deno se resuelve con el import map de supabase/functions/deno.json).
// Porta buildPrompt() de CLAUDE/app/rendiciones-heca.html.
import { z } from 'zod'

/** Listas que el modelo debe usar (texto exacto). Las arma el servidor desde la base. */
export interface ListasPrompt {
  subcuentas: readonly string[]
  solicitantes: readonly string[]
  empresas: readonly string[]
}

const tr = (s: string) => s.replace(/\s+/g, ' ').trim()

/** Prompt de lectura. `notaImagenes` explica qué es cada imagen (foto completa o recorte). */
export function construirPrompt(listas: ListasPrompt, notaImagenes = ''): string {
  return `Eres el asistente de tesorería de Heca Chile. Las imágenes son la foto de un formulario de RENDICIÓN DE GASTOS (código POE-GLO-FIN-003) y, a veces, fotos de las boletas o facturas que lo respaldan.

${notaImagenes}
El formulario tiene: FECHA, EMPRESA, Nº RENDICION, NOMBRE SOLICITANTE, un título tipo "FONDOS POR RENDIR ...", y tres tablas: COMPRAS C/FACTURAS (fecha, proveedor, factura, neto, IVA, total, detalle), COMPRAS C/BOLETAS (fecha, proveedor, boleta, monto, detalle) y TRANSFERENCIAS REALIZADAS (fecha, descripción, monto). Al final está el TOTAL RENDICION.

MUY IMPORTANTE: una misma foto puede contener VARIOS documentos (varias boletas, tickets, vouchers o facturas puestos uno al lado del otro o encima de una hoja). Antes de responder, recorre cada imagen completa, de arriba abajo y de izquierda a derecha, y haz un inventario de TODOS los documentos que aparecen, aunque estén cortados, chicos o girados. Cada boleta o factura distinta es un documento distinto, aunque sean del mismo comercio. Dos documentos son el mismo solo si coinciden número, fecha y monto.

Reglas:
- Si hay formulario: las líneas salen de las tablas del formulario (una línea por fila con datos). Usa los documentos del inventario para completar o corregir esas líneas (proveedor, RUT, número, neto/IVA). Si un documento de las fotos no está en el formulario, agrégalo como línea nueva y avísalo en "dudas". Si una fila del formulario no tiene documento en las fotos, déjala y avísalo en "dudas".
- Si no hay formulario: una línea por cada documento del inventario.
- Nunca dupliques un mismo documento.
- Montos en pesos chilenos, enteros. En Chile el punto separa miles: "70.389" = 70389.
- Fechas en formato YYYY-MM-DD (el formulario usa DD-MM-YYYY).
- tipo: "Factura" (tabla de facturas), "Boleta" (tabla de boletas), "Boleta de honorarios" o "Transferencia" (tabla de transferencias).
- Factura: neto e iva por separado, exento solo si la factura lo muestra. Boleta, honorarios y transferencia: el monto total va en "exento" y neto e iva quedan en 0.
- "detalle": el texto de la columna DETALLE o DESCRIPCIÓN tal como está escrito.
- "subcuenta": elige la que mejor calce de esta lista (copia el texto exacto): ${listas.subcuentas.map(tr).join(' | ')}.
- "solicitante": elige de esta lista el nombre que calce con NOMBRE SOLICITANTE (texto exacto), o escribe el nombre leído si no está: ${listas.solicitantes.map(tr).join(' | ')}.
- "empresa": una de: ${listas.empresas.map(tr).join(' | ')}.
- Si algo no se lee bien o no calza, completa tu mejor lectura y explícalo en "dudas" (frases cortas en español).

Responde SOLO con un JSON con esta forma ("documentos" es tu inventario: uno por cada documento distinto que viste en las fotos, sin contar el formulario):
{"documentos":[{"foto":1,"tipo":"Boleta","proveedor":"","numero":"","fecha":"2026-10-14","monto":70389}],
 "solicitante":"","nro":42,"fecha":"2026-10-14","empresa":"","fondo":"FONDOS POR RENDIR CDA","totalFormulario":70389,
 "lineas":[{"fecha":"2026-10-14","tipo":"Boleta","proveedor":"","rut":"","numero":"","neto":0,"iva":0,"exento":70389,"detalle":"","subcuenta":""}],
 "dudas":[]}`
}

// ---- Forma de la respuesta (tolerante: el modelo puede mandar números como texto o null) ----

const texto = z
  .union([z.string(), z.number()])
  .nullish()
  .transform((v) => (v == null ? '' : String(v)))
const monto = z.union([z.number(), z.string()]).nullish()

const DocumentoSchema = z.object({
  foto: z.union([z.number(), z.string()]).nullish(),
  tipo: texto,
  proveedor: texto,
  numero: texto,
  fecha: texto,
  monto,
})

const LineaSchema = z.object({
  fecha: texto,
  tipo: texto,
  proveedor: texto,
  rut: texto,
  numero: texto,
  neto: monto,
  iva: monto,
  exento: monto,
  detalle: texto,
  subcuenta: texto,
})

export const RespuestaLecturaSchema = z.object({
  documentos: z.array(DocumentoSchema).nullish(),
  solicitante: texto,
  nro: z.union([z.number(), z.string()]).nullish(),
  fecha: texto,
  empresa: texto,
  fondo: texto,
  totalFormulario: monto,
  lineas: z
    .array(LineaSchema)
    .nullish()
    .transform((v) => v ?? []),
  dudas: z
    .array(z.unknown())
    .nullish()
    .transform((v) => (v ?? []).map(String)),
})

export type RespuestaLectura = z.infer<typeof RespuestaLecturaSchema>
export type LineaLeida = RespuestaLectura['lineas'][number]

/** Códigos de error de la lectura (los devuelve la Edge Function y los usa el frontend). */
export type CodigoErrorLectura =
  'cancelled' | 'rate_limited' | 'image_rejected' | 'invalid_json' | 'unauthorized' | 'error'

export class ErrorLectura extends Error {
  readonly codigo: CodigoErrorLectura
  constructor(codigo: CodigoErrorLectura, mensaje?: string) {
    super(mensaje ?? codigo)
    this.name = 'ErrorLectura'
    this.codigo = codigo
  }
}

/**
 * Extrae y valida el JSON de la respuesta del modelo (tolera ```json y texto alrededor).
 * Lanza ErrorLectura('invalid_json') si no se puede.
 */
export function extraerRespuesta(salida: string): RespuestaLectura {
  const sinCercas = salida.replace(/```(?:json)?/gi, '')
  const ini = sinCercas.indexOf('{')
  const fin = sinCercas.lastIndexOf('}')
  if (ini < 0 || fin <= ini) throw new ErrorLectura('invalid_json', 'La respuesta no trae JSON')
  let datos: unknown
  try {
    datos = JSON.parse(sinCercas.slice(ini, fin + 1))
  } catch {
    throw new ErrorLectura('invalid_json', 'JSON mal formado')
  }
  const r = RespuestaLecturaSchema.safeParse(datos)
  if (!r.success) throw new ErrorLectura('invalid_json', r.error.message)
  return r.data
}
