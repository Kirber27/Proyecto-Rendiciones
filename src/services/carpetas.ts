// Carpetas (spec 05): rendiciones de una persona con su línea de tiempo, pagos y estado de pago,
// y el índice de carpetas para tesorería. RLS hace que un solicitante solo reciba lo suyo.
import { asignarPagos, type Asignacion } from '@/domain/asignacion'
import type { RendicionCarpeta } from '@/domain/carpeta'
import { supabase } from '@/lib/supabase'
import type { RendicionParaPago } from '@/types/pagos'
import type { EventoRendicion } from '@/types/rendicion'
import { leerPagos, type Pago } from './pagos'

/** Pago tal como se muestra en la carpeta. */
export type PagoCarpeta = Pago

export interface DatosCarpeta {
  rendiciones: RendicionCarpeta[]
  pagos: PagoCarpeta[]
  asignacion: Asignacion
  /** Folio por id (para mostrar a qué rendiciones se vinculó cada pago). */
  folios: Map<string, string>
}

const lanzar = (error: { message: string } | null) => {
  if (error) throw new Error(error.message)
}

/** Solo las aprobadas cuentan para el estado de pago. */
export const paraPago = (
  rs: {
    id: string
    persona_id: string
    nro: number
    fecha: string
    total: number
    estado: string
  }[],
) =>
  rs
    .filter((r) => r.estado === 'aprobada')
    .map<RendicionParaPago>((r) => ({
      id: r.id,
      personaId: r.persona_id,
      nro: r.nro,
      fecha: r.fecha,
      total: Number(r.total),
    }))

/** Todo lo de la carpeta de una persona. */
export async function leerCarpeta(personaId: string): Promise<DatosCarpeta> {
  const [rs, ps] = await Promise.all([
    supabase
      .from('v_rendiciones')
      .select(
        'id, folio, persona_id, nro, fecha, total, estado, aprobacion_anulada, origen, n_respaldos, nota_tesoreria',
      )
      .eq('persona_id', personaId),
    leerPagos(personaId),
  ])
  lanzar(rs.error)
  const filas = (rs.data ?? []).map((r) => ({
    ...r,
    id: r.id!,
    persona_id: r.persona_id!,
    nro: r.nro ?? 0,
    fecha: r.fecha ?? '',
    total: Number(r.total ?? 0),
    estado: r.estado!,
  }))

  // Eventos de todas sus rendiciones (en lotes para no alargar demasiado la URL).
  const eventos = new Map<string, EventoRendicion[]>()
  const ids = filas.map((r) => r.id)
  for (let i = 0; i < ids.length; i += 80) {
    const { data, error } = await supabase
      .from('rendicion_eventos')
      .select('rendicion_id, evento, nota, creado_en')
      .in('rendicion_id', ids.slice(i, i + 80))
      .order('creado_en')
    lanzar(error)
    for (const e of data ?? []) {
      const lista = eventos.get(e.rendicion_id) ?? []
      lista.push({ evento: e.evento, nota: e.nota, fecha: e.creado_en })
      eventos.set(e.rendicion_id, lista)
    }
  }

  return {
    rendiciones: filas.map((r) => ({
      id: r.id,
      folio: r.folio,
      nro: r.nro,
      fecha: r.fecha,
      total: r.total,
      estado: r.estado,
      aprobacionAnulada: !!r.aprobacion_anulada,
      origen: r.origen ?? 'App',
      respaldos: r.n_respaldos ?? 0,
      notaTesoreria: r.nota_tesoreria,
      eventos: eventos.get(r.id) ?? [],
    })),
    pagos: ps,
    asignacion: asignarPagos(paraPago(filas), ps),
    folios: new Map(filas.filter((r) => r.folio).map((r) => [r.id, r.folio!])),
  }
}

export interface ResumenIndice {
  /** Por persona: cantidad de rendiciones (sin eliminadas) y en revisión. */
  conteos: Map<string, { rendiciones: number; porAprobar: number }>
  asignacion: Asignacion
}

/** Índice de carpetas (tesorería): conteos y saldos de todas las personas. */
export async function leerIndiceCarpetas(): Promise<ResumenIndice> {
  const [rs, ps] = await Promise.all([
    supabase.from('rendiciones').select('id, persona_id, nro, fecha, total, estado').limit(10000),
    leerPagos(),
  ])
  lanzar(rs.error)
  const filas = rs.data ?? []
  const conteos = new Map<string, { rendiciones: number; porAprobar: number }>()
  for (const r of filas) {
    if (r.estado === 'eliminada') continue
    const c = conteos.get(r.persona_id) ?? { rendiciones: 0, porAprobar: 0 }
    c.rendiciones++
    if (r.estado === 'en_revision') c.porAprobar++
    conteos.set(r.persona_id, c)
  }
  return {
    conteos,
    asignacion: asignarPagos(paraPago(filas), ps),
  }
}
