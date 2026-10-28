// Envío de rendiciones (spec 02): respaldos (fotos y PDF) a Storage (bucket privado `respaldos`)
// + RPC enviar_rendicion.
import { limpiarRendicion, sumaLineas } from '@/domain/rendicion'
import { tipoRespaldo } from '@/domain/respaldos'
import type { Json } from '@/lib/database.types'
import { reducirImagen } from '@/lib/imagenes'
import { supabase } from '@/lib/supabase'
import type { BorradorRendicion, TipoDocumento, TipoRespaldo } from '@/types/rendicion'

export const BUCKET_RESPALDOS = 'respaldos'

/**
 * Ruta de un respaldo: <persona_id>/<rendicion_id>/<uuid>.jpg o .pdf
 * (la carpeta la exigen las políticas de Storage y la RPC; la extensión dice el tipo).
 */
export const rutaRespaldo = (
  personaId: string,
  rendicionId: string,
  nombre: string,
  tipo: TipoRespaldo = 'imagen',
) => `${personaId}/${rendicionId}/${nombre}.${tipo === 'pdf' ? 'pdf' : 'jpg'}`

export interface ArchivoParaEnviar {
  /** Id local estable del archivo (se usa como nombre en Storage para no duplicar en reintentos). */
  id: string
  file: File
}

export interface OpcionesEnvio {
  /** Id de la rendición: el de la existente (reenvío) o uno generado una vez por el store (nueva). */
  rendicionId: string
  /** Archivos ya subidos en un intento anterior (id local → ruta). Se actualiza aquí. */
  subidas: Map<string, string>
  onProgreso?: (texto: string) => void
}

export interface ResultadoEnvio {
  id: string
  nro: number
  total: number
  reenvio: boolean
}

async function subirConReintento(ruta: string, archivo: Blob, contentType: string): Promise<boolean> {
  for (let intento = 0; intento < 2; intento++) {
    const { error } = await supabase.storage
      .from(BUCKET_RESPALDOS)
      .upload(ruta, archivo, { contentType, upsert: false })
    // "Ya existe": llegó en un intento anterior aunque no recibimos la respuesta.
    if (!error || /exists|duplicate/i.test(error.message)) return true
  }
  return false
}

/**
 * Sube los respaldos que falten (fotos reducidas a 2400 px; PDF tal cual) y envía la rendición.
 * Si alguno no se pudo subir, no envía y avisa cuál (R3.4); el reintento solo sube los que faltan.
 */
export async function enviarRendicion(
  borrador: BorradorRendicion,
  archivos: readonly ArchivoParaEnviar[],
  { rendicionId, subidas, onProgreso }: OpcionesEnvio,
): Promise<ResultadoEnvio> {
  const reenvio = !!borrador.id
  const payload = limpiarRendicion({ ...borrador, id: rendicionId })

  const fallidos: number[] = []
  for (let i = 0; i < archivos.length; i++) {
    const a = archivos[i]!
    if (subidas.has(a.id)) continue
    onProgreso?.(`Guardando respaldo ${i + 1} de ${archivos.length}…`)
    const tipo = tipoRespaldo(a.file.type || a.file.name)
    const ruta = rutaRespaldo(payload.persona_id, rendicionId, a.id, tipo)
    const subido =
      tipo === 'pdf'
        ? await subirConReintento(ruta, a.file, 'application/pdf')
        : await subirConReintento(ruta, await reducirImagen(a.file, 2400, 0.85), 'image/jpeg')
    if (subido) subidas.set(a.id, ruta)
    else fallidos.push(i + 1)
  }
  if (fallidos.length) {
    throw new Error(
      `No se pudo guardar el respaldo ${fallidos.join(', ')}. Revisa tu conexión e intenta de nuevo; la rendición todavía no se envió.`,
    )
  }

  onProgreso?.('Enviando…')
  const nuevas = archivos.map((a) => subidas.get(a.id)!)
  const { error } = await supabase.rpc('enviar_rendicion', {
    // El payload es JSON plano; el tipo Json generado no acepta interfaces sin índice.
    p: { ...payload, respaldos: [...borrador.respaldos, ...nuevas] } as unknown as Json,
  })
  if (error) throw new Error(error.message)
  // El Nº lo asigna el servidor (correlativo por persona): se lee el definitivo.
  const { data } = await supabase.from('rendiciones').select('nro').eq('id', rendicionId).maybeSingle()
  return { id: rendicionId, nro: data?.nro ?? payload.nro, total: sumaLineas(borrador), reenvio }
}

/**
 * Si el documento (RUT del proveedor + tipo + Nº) ya está en otra rendición no eliminada ni rechazada.
 * `excluir` = la rendición que se está editando. La base solo responde sí o no.
 */
export async function documentoRepetido(
  rut: string,
  tipo: TipoDocumento,
  numero: string,
  excluir?: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('documento_repetido', {
    p_rut: rut,
    p_tipo: tipo,
    p_numero: numero,
    ...(excluir ? { p_excluir: excluir } : {}),
  })
  if (error) throw new Error(error.message)
  return !!data
}

/** Nº que tendría la próxima rendición de la persona (mayor Nº + 1). Lo confirma el servidor al enviar. */
export async function siguienteNro(personaId: string): Promise<number> {
  const { data, error } = await supabase.rpc('siguiente_nro', { p_persona: personaId })
  if (error) throw new Error(error.message)
  return data
}
