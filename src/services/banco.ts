// Banco (spec 07): lectura del archivo de cartola, cartolas guardadas y RPC de la migración 15.
import type { Json } from '@/lib/database.types'
import { traerTodo } from '@/lib/paginado'
import { leerFilasHoja } from './excel'
import { supabase } from '@/lib/supabase'
import type {
  AsignacionCargo,
  CartolaGuardada,
  MovimientoCartola,
  MovimientoGuardado,
} from '@/types/banco'

const lanzar = (error: { message: string } | null) => {
  if (error) throw new Error(error.message)
}

export const ERROR_LECTURA =
  'No se pudo leer el archivo. Descárgalo del banco en formato Excel o CSV.'

/** Primera hoja de la cartola (.xlsx, .xls o .csv) como filas de celdas. */
export const leerFilasArchivo = (archivo: File) => leerFilasHoja(archivo, ERROR_LECTURA)

export async function leerCartolas(): Promise<{
  cartolas: CartolaGuardada[]
  movimientos: MovimientoGuardado[]
}> {
  const cs = await supabase.from('cartolas').select('id, nombre_archivo, medio_pago_id, creado_en')
  lanzar(cs.error)
  const filas = await traerTodo((desde, hasta) =>
    supabase
      .from('cartola_movimientos')
      .select('id, cartola_id, idx, fecha, descripcion, referencia, cargo, abono, ignorado')
      .order('cartola_id')
      .order('idx')
      .range(desde, hasta),
  )
  return {
    cartolas: (cs.data ?? []).map((c) => ({
      id: c.id,
      nombreArchivo: c.nombre_archivo,
      medioPagoId: c.medio_pago_id,
      creadoEn: c.creado_en,
    })),
    movimientos: filas.map((m) => ({
      id: m.id,
      cartolaId: m.cartola_id,
      idx: m.idx,
      fecha: m.fecha,
      descripcion: m.descripcion,
      referencia: m.referencia,
      cargo: Number(m.cargo),
      abono: Number(m.abono),
      ignorado: m.ignorado,
    })),
  }
}

/** Guarda la cartola con sus movimientos (`idx` = posición en el archivo). Devuelve su id. */
export async function guardarCartola(
  nombreArchivo: string,
  medioPagoId: number | null,
  movimientos: readonly (MovimientoCartola & { idx: number })[],
): Promise<string> {
  const p = {
    nombre_archivo: nombreArchivo,
    medio_pago_id: medioPagoId,
    movimientos: movimientos.map((m) => ({ ...m })),
  } satisfies Json
  const { data, error } = await supabase.rpc('guardar_cartola', { p })
  lanzar(error)
  return data as string
}

/** Confirma asignaciones en una sola transacción. Devuelve cuántos movimientos quedaron conciliados. */
export async function confirmarConciliacion(items: readonly AsignacionCargo[]): Promise<number> {
  const p = items.map((a) =>
    a.tipo === 'pago'
      ? { movimiento_id: a.movimientoId, tipo: a.tipo, pago_id: a.pagoId }
      : a.tipo === 'rendiciones'
        ? { movimiento_id: a.movimientoId, tipo: a.tipo, rendicion_ids: a.rendicionIds }
        : { movimiento_id: a.movimientoId, tipo: a.tipo, persona_id: a.personaId },
  ) satisfies Json
  const { data, error } = await supabase.rpc('confirmar_conciliacion', { p })
  lanzar(error)
  return data as number
}

export async function ignorarMovimiento(id: string, valor: boolean) {
  const { error } = await supabase.rpc('ignorar_movimiento', { p_id: id, p_valor: valor })
  lanzar(error)
}

export async function deshacerAsignacion(movimientoId: string) {
  const { error } = await supabase.rpc('deshacer_asignacion', { p_movimiento_id: movimientoId })
  lanzar(error)
}

/** Elimina la cartola y devuelve cuántos pagos creados desde ella se borraron. */
export async function eliminarCartola(id: string): Promise<number> {
  const { data, error } = await supabase.rpc('eliminar_cartola', { p_id: id })
  lanzar(error)
  return data as number
}
