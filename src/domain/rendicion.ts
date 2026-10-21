// Totales de rendición (porta lineTotal, rendTotal y T del prototipo).
import type { ConLineas, MontosLinea } from '@/types/rendicion'
import { num } from './formato'

/** Total de una línea: neto + iva + exento + otros. */
export function totalLinea(l: MontosLinea): number {
  return num(l.neto) + num(l.iva) + num(l.exento) + num(l.otros)
}

/** Suma de las líneas de una rendición. */
export function sumaLineas(r: ConLineas): number {
  return (r.lineas ?? []).reduce((a, l) => a + totalLinea(l), 0)
}

/** Total de la rendición: el guardado si existe; si no, la suma de sus líneas. */
export function totalRendicion(r: ConLineas): number {
  return r.total ?? sumaLineas(r)
}

/** Tolerancia del cuadre con el total del formulario (en pesos). */
export const TOLERANCIA_CUADRE = 1

/** Cuadre con el total escrito en el formulario: null si no hay total del formulario. */
export function cuadra(suma: number, totalFormulario: number | null | undefined): boolean | null {
  if (totalFormulario == null) return null
  return Math.abs(suma - totalFormulario) <= TOLERANCIA_CUADRE
}
