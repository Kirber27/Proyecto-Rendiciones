// Libro de rendiciones (spec 04): lista, líneas para el Excel y acciones de tesorería (RPC de la migración 13).
import type { FilaLibro, LineaBase } from '@/domain/libro'
import { limpiarRendicion } from '@/domain/rendicion'
import type { Json } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'
import type { BorradorRendicion } from '@/types/rendicion'

const lanzar = (error: { message: string } | null) => {
  if (error) throw new Error(error.message)
}

/** Aprobadas y eliminadas (las eliminadas, para el filtro "Eliminadas" y restaurar). */
export async function listarLibro(): Promise<FilaLibro[]> {
  const { data, error } = await supabase
    .from('v_rendiciones')
    .select(
      'id, folio, persona_id, persona_nombre, nro, fecha, empresa_id, total, estado, origen, exportada, decidido_en, n_respaldos',
    )
    .in('estado', ['aprobada', 'eliminada'])
    .limit(10000)
  lanzar(error)
  return (data ?? []).map((r) => ({
    id: r.id!,
    folio: r.folio ?? '',
    personaId: r.persona_id!,
    personaNombre: r.persona_nombre ?? '',
    nro: r.nro ?? 0,
    fecha: r.fecha ?? '',
    empresaId: r.empresa_id,
    total: Number(r.total ?? 0),
    estado: r.estado as FilaLibro['estado'],
    origen: r.origen ?? 'App',
    exportada: !!r.exportada,
    decididoEn: r.decidido_en,
    nRespaldos: r.n_respaldos ?? 0,
  }))
}

/** Líneas de varias rendiciones (en lotes para no alargar demasiado la URL). */
export async function leerLineas(ids: readonly string[]): Promise<Map<string, LineaBase[]>> {
  const mapa = new Map<string, LineaBase[]>()
  for (let i = 0; i < ids.length; i += 80) {
    const { data, error } = await supabase
      .from('rendicion_lineas')
      .select(
        'rendicion_id, orden, fecha, tipo, proveedor, numero, neto, iva, exento, otros, detalle, subcuenta_id, cuenta_id, centro_costo_id',
      )
      .in('rendicion_id', ids.slice(i, i + 80))
    lanzar(error)
    for (const { rendicion_id, ...l } of data ?? []) {
      const lista = mapa.get(rendicion_id) ?? []
      lista.push(l)
      mapa.set(rendicion_id, lista)
    }
  }
  return mapa
}

/** Guarda la edición en el libro y devuelve el folio (cambia si cambian persona o Nº). */
export async function editarRendicion(id: string, b: BorradorRendicion, version: string | null) {
  const p = { ...limpiarRendicion(b), id: undefined } as unknown as Json
  const { data, error } = await supabase.rpc('editar_rendicion', {
    p_id: id,
    p,
    p_version: version as string,
  })
  lanzar(error)
  return data as string
}

export async function anularAprobacion(id: string, nota?: string) {
  const { error } = await supabase.rpc('anular_aprobacion', { p_id: id, p_nota: nota })
  lanzar(error)
}

export async function eliminarRendicion(id: string, nota?: string) {
  const { error } = await supabase.rpc('eliminar_rendicion', { p_id: id, p_nota: nota })
  lanzar(error)
}

export async function restaurarRendicion(id: string) {
  const { error } = await supabase.rpc('restaurar_rendicion', { p_id: id })
  lanzar(error)
}

/** Marca como exportadas y devuelve cuántas marcó. */
export async function marcarExportadas(ids: readonly string[]) {
  const { data, error } = await supabase.rpc('marcar_exportadas', { p_ids: [...ids] })
  lanzar(error)
  return data as number
}
