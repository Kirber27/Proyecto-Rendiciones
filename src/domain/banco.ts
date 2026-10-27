// Pantalla Banco: estado de los movimientos guardados, resumen de cada cartola y armado de las
// asignaciones que se confirman (las reglas de las propuestas están en conciliacion.ts).
import type { AsignacionCargo, CartolaGuardada, MovimientoGuardado } from '@/types/banco'
import type { MovimientoParaConciliar, Propuesta } from './conciliacion'

/** Marca como asignados los movimientos que respalda algún pago. */
export function movimientosParaConciliar(
  movimientos: readonly MovimientoGuardado[],
  pagos: readonly { movimientoId: string | null }[],
): (MovimientoParaConciliar & MovimientoGuardado)[] {
  const asignados = new Set(pagos.map((p) => p.movimientoId).filter(Boolean))
  return movimientos.map((m) => ({ ...m, asignado: asignados.has(m.id) }))
}

/** Lo que se envía a `confirmar_conciliacion` por cada propuesta marcada. */
export function asignacionDePropuesta(p: Propuesta): AsignacionCargo {
  return p.tipo === 'pago-existente'
    ? { movimientoId: p.movimiento.id, tipo: 'pago', pagoId: p.pagoId }
    : { movimientoId: p.movimiento.id, tipo: 'rendiciones', rendicionIds: p.rendicionIds }
}

/** Asignación manual elegida en el selector: "r:<rendición>", "a:<persona>" o "x" (no es de rendiciones). */
export function leerEleccionManual(
  movimientoId: string,
  valor: string,
): AsignacionCargo | 'ignorar' | null {
  if (valor === 'x') return 'ignorar'
  if (valor.startsWith('r:'))
    return { movimientoId, tipo: 'rendiciones', rendicionIds: [valor.slice(2)] }
  if (valor.startsWith('a:')) return { movimientoId, tipo: 'anticipo', personaId: valor.slice(2) }
  return null
}

export interface ResumenCartola extends CartolaGuardada {
  movimientos: number
  cargos: number
  /** Cargos asignados a un pago o marcados como "No es de rendiciones". */
  conciliados: number
}

/** Una fila por cartola, de la más nueva a la más antigua. */
export function resumenCartolas(
  cartolas: readonly CartolaGuardada[],
  movimientos: readonly (MovimientoGuardado & { asignado: boolean })[],
): ResumenCartola[] {
  return cartolas
    .map((c) => {
      const ms = movimientos.filter((m) => m.cartolaId === c.id)
      const cargos = ms.filter((m) => m.cargo > 0)
      return {
        ...c,
        movimientos: ms.length,
        cargos: cargos.length,
        conciliados: cargos.filter((m) => m.asignado || m.ignorado).length,
      }
    })
    .sort((a, b) => b.creadoEn.localeCompare(a.creadoEn))
}

/** Cargos ya resueltos (asignados o ignorados), del más nuevo al más antiguo, para poder deshacer. */
export function cargosResueltos<T extends MovimientoGuardado & { asignado: boolean }>(
  movimientos: readonly T[],
): T[] {
  return movimientos
    .filter((m) => m.cargo > 0 && (m.asignado || m.ignorado))
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || a.idx - b.idx)
}
