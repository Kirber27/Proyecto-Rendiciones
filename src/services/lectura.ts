// Llamada a la Edge Function `leer-rendicion` (lectura de fotos con IA).
import { FunctionsHttpError } from '@supabase/supabase-js'
import {
  ErrorLectura,
  RespuestaLecturaSchema,
  type CodigoErrorLectura,
  type RespuestaLectura,
} from '@shared/lectura'
import { supabase } from '@/lib/supabase'

/** Máximo de imágenes por lectura (igual que la función). */
export const MAX_IMAGENES_LECTURA = 20

const CODIGOS: CodigoErrorLectura[] = [
  'cancelled',
  'rate_limited',
  'image_rejected',
  'invalid_json',
  'unauthorized',
  'error',
]

/** Blob → base64 sin el prefijo data:… */
export async function aBase64(b: Blob): Promise<string> {
  const bytes = new Uint8Array(await b.arrayBuffer())
  let bin = ''
  const TROZO = 0x8000 // evita "Maximum call stack size" con imágenes grandes
  for (let i = 0; i < bytes.length; i += TROZO) {
    bin += String.fromCharCode(...bytes.subarray(i, i + TROZO))
  }
  return btoa(bin)
}

/**
 * Envía las imágenes (ya preparadas con prepararImagenes) y devuelve la respuesta validada.
 * Lanza ErrorLectura con un código para mostrar el mensaje adecuado (mensajeErrorLectura).
 */
export async function leerFotos(
  imagenes: readonly Blob[],
  nota: string,
  signal?: AbortSignal,
): Promise<RespuestaLectura> {
  const cuerpo = {
    imagenes: await Promise.all(
      imagenes.map(async (b) => ({ media_type: b.type || 'image/jpeg', data: await aBase64(b) })),
    ),
    nota,
  }
  if (signal?.aborted) throw new ErrorLectura('cancelled')

  const { data, error } = await supabase.functions.invoke('leer-rendicion', {
    body: cuerpo,
    signal,
  })
  if (signal?.aborted) throw new ErrorLectura('cancelled')
  if (error) {
    let codigo: CodigoErrorLectura = 'error'
    if (error instanceof FunctionsHttpError) {
      const j = await (error.context as Response).json().catch(() => null)
      if (CODIGOS.includes(j?.code)) codigo = j.code
    }
    throw new ErrorLectura(codigo, error.message)
  }
  const r = RespuestaLecturaSchema.safeParse((data as { respuesta?: unknown })?.respuesta)
  if (!r.success) throw new ErrorLectura('invalid_json', r.error.message)
  return r.data
}
