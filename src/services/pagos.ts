// Pagos (lectura): compartido por Carpetas, Libro y, más adelante, Personas y Banco.
// RLS hace que un solicitante solo reciba sus pagos.
import { supabase } from '@/lib/supabase'
import type { PagoParaAsignar, TipoPago } from '@/types/pagos'

export interface Pago extends PagoParaAsignar {
  medioPagoId: number | null
  descripcion: string
}

type FilaPago = {
  id: string
  persona_id: string
  fecha: string | null
  monto: number
  tipo: TipoPago
  medio_pago_id: number | null
  descripcion: string
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
})

const COLUMNAS_PAGO =
  'id, persona_id, fecha, monto, tipo, medio_pago_id, descripcion, pago_rendiciones(rendicion_id)'

/** Pagos de una persona o, sin `personaId`, todos los visibles. */
export async function leerPagos(personaId?: string): Promise<Pago[]> {
  let q = supabase.from('pagos').select(COLUMNAS_PAGO)
  q = personaId ? q.eq('persona_id', personaId) : q.limit(10000)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return ((data ?? []) as FilaPago[]).map(aPago)
}
