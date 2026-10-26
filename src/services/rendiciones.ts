// Envío de rendiciones (spec 02, 2.7): fotos a Storage (bucket privado `respaldos`) + RPC enviar_rendicion.
import { limpiarRendicion, sumaLineas } from '@/domain/rendicion'
import type { Json } from '@/lib/database.types'
import { reducirImagen } from '@/lib/imagenes'
import { supabase } from '@/lib/supabase'
import type { BorradorRendicion } from '@/types/rendicion'

export const BUCKET_RESPALDOS = 'respaldos'

/** Ruta de una foto: <persona_id>/<rendicion_id>/<uuid>.jpg (la exigen las políticas de Storage y la RPC). */
export const rutaRespaldo = (personaId: string, rendicionId: string, nombre: string) =>
  `${personaId}/${rendicionId}/${nombre}.jpg`

export interface FotoParaEnviar {
  /** Id local estable de la foto (se usa como nombre del archivo para no duplicar en reintentos). */
  id: string
  file: File
}

export interface OpcionesEnvio {
  /** Id de la rendición: el de la existente (reenvío) o uno generado una vez por el store (nueva). */
  rendicionId: string
  /** Fotos ya subidas en un intento anterior (id local → ruta). Se actualiza aquí. */
  subidas: Map<string, string>
  onProgreso?: (texto: string) => void
}

export interface ResultadoEnvio {
  id: string
  nro: number
  total: number
  reenvio: boolean
}

async function subirConReintento(ruta: string, archivo: Blob): Promise<boolean> {
  for (let intento = 0; intento < 2; intento++) {
    const { error } = await supabase.storage
      .from(BUCKET_RESPALDOS)
      .upload(ruta, archivo, { contentType: 'image/jpeg', upsert: false })
    // "Ya existe": llegó en un intento anterior aunque no recibimos la respuesta.
    if (!error || /exists|duplicate/i.test(error.message)) return true
  }
  return false
}

/**
 * Sube las fotos que falten (reducidas a 2400 px) y envía la rendición.
 * Si alguna foto no se pudo subir, no envía y avisa cuál (R4.4); el reintento solo sube las que faltan.
 */
export async function enviarRendicion(
  borrador: BorradorRendicion,
  fotos: readonly FotoParaEnviar[],
  { rendicionId, subidas, onProgreso }: OpcionesEnvio,
): Promise<ResultadoEnvio> {
  const reenvio = !!borrador.id
  const payload = limpiarRendicion({ ...borrador, id: rendicionId })

  const fallidas: number[] = []
  for (let i = 0; i < fotos.length; i++) {
    const f = fotos[i]!
    if (subidas.has(f.id)) continue
    onProgreso?.(`Guardando foto ${i + 1} de ${fotos.length}…`)
    const ruta = rutaRespaldo(payload.persona_id, rendicionId, f.id)
    const blob = await reducirImagen(f.file, 2400, 0.85)
    if (await subirConReintento(ruta, blob)) subidas.set(f.id, ruta)
    else fallidas.push(i + 1)
  }
  if (fallidas.length) {
    throw new Error(
      `No se pudo guardar la foto ${fallidas.join(', ')}. Revisa tu conexión e intenta de nuevo; la rendición todavía no se envió.`,
    )
  }

  onProgreso?.('Enviando…')
  const nuevas = fotos.map((f) => subidas.get(f.id)!)
  const { error } = await supabase.rpc('enviar_rendicion', {
    // El payload es JSON plano; el tipo Json generado no acepta interfaces sin índice.
    p: { ...payload, respaldos: [...borrador.respaldos, ...nuevas] } as unknown as Json,
  })
  if (error) throw new Error(error.message)
  return { id: rendicionId, nro: payload.nro, total: sumaLineas(borrador), reenvio }
}
