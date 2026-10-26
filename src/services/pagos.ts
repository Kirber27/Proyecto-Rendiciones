// Pagos: lectura compartida por Carpetas, Libro, Personas y (más adelante) Banco.
// RLS hace que un solicitante solo reciba sus pagos. Registrar y eliminar: RPC de la migración 14.
import type { Json } from '@/lib/database.types'
import { traerTodo } from '@/lib/paginado'
import { supabase } from '@/lib/supabase'
import type { PagoParaAsignar, TipoPago } from '@/types/pagos'

export interface Pago extends PagoParaAsignar {
  medioPagoId: number | null
  descripcion: string
  /** Cargo de cartola que lo respalda (null = pago manual). */
  movimientoId: string | null
}

type FilaPago = {
  id: string
  persona_id: string
  fecha: string | null
  monto: number
  tipo: TipoPago
  medio_pago_id: number | null
  descripcion: string
  movimiento_id: string | null
  pago_rendiciones: { rendicion_id: string }[]
}

export const aPago = (p: FilaPago): Pago => ({
  id: p.id,
  personaId: p.persona_id,
  fecha: p.fecha ?? '',
  monto: Number(p.monto),
  tipo: p.tipo,
  rendicionIds: p.pago_rendiciones.map((x) => x.rendicion_id),
  medioPagoId: p.medio_pago_id,
  descripcion: p.descripcion,
  movimientoId: p.movimiento_id,
})

const COLUMNAS_PAGO =
  'id, persona_id, fecha, monto, tipo, medio_pago_id, descripcion, movimiento_id, pago_rendiciones(rendicion_id)'

/** Pagos de una persona o, sin `personaId`, todos los visibles. */
export async function leerPagos(personaId?: string): Promise<Pago[]> {
  const filas = await traerTodo<FilaPago>((desde, hasta) => {
    const q = supabase.from('pagos').select(COLUMNAS_PAGO)
    return (personaId ? q.eq('persona_id', personaId) : q).order('id').range(desde, hasta)
  })
  return filas.map(aPago)
}

export interface NuevoPago {
  personaId: string
  tipo: TipoPago
  fecha: string
  medioPagoId: number | null
  /** En positivo; la base lo guarda negativo si es devolución. */
  monto: number
  descripcion?: string
  rendicionIds: readonly string[]
}

/** Registra un pago manual y devuelve su id. */
export async function registrarPago(n: NuevoPago): Promise<string> {
  const p = {
    persona_id: n.personaId,
    tipo: n.tipo,
    fecha: n.fecha,
    medio_pago_id: n.medioPagoId,
    monto: n.monto,
    descripcion: n.descripcion ?? '',
    rendicion_ids: [...n.rendicionIds],
  } satisfies Json
  const { data, error } = await supabase.rpc('registrar_pago', { p })
  if (error) throw new Error(error.message)
  return data
}

/** Elimina un pago manual (los de cartola se desvinculan en Banco). */
export async function eliminarPago(id: string) {
  const { error } = await supabase.rpc('eliminar_pago', { p_id: id })
  if (error) throw new Error(error.message)
}
