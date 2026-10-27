// Lectura de cartolas bancarias ya convertidas a filas (porta GUESS, leerCartola y buildMovs del prototipo).
// La lectura del archivo (xlsx/csv) con SheetJS va en la capa de servicios (7.3).
import {
  CAMPOS_CARTOLA,
  type CampoCartola,
  type MapeoCartola,
  type MovimientoCartola,
} from '@/types/banco'
import { norm, num, parseDate, tr } from './formato'

type Celda = unknown
type Fila = readonly Celda[]

/** Cómo reconocer cada columna por su encabezado (en este orden). */
export const PATRONES_COLUMNA: Record<CampoCartola, RegExp> = {
  fecha: /fecha/i,
  descripcion: /descrip|glosa|detalle|concepto|movimiento/i,
  cargo: /cargo|d[eé]bito|giro|egreso|retiro/i,
  abono: /abono|cr[eé]dito|dep[oó]sito|ingreso/i,
  monto: /^monto|importe/i,
  referencia: /operaci|documento|n[°º.]|folio|referencia/i,
}

export const LARGO_DESCRIPCION = 140
export const LARGO_REFERENCIA = 40

/**
 * Fila de encabezados = primera que tenga una celda con "fecha" (los bancos suelen poner
 * títulos y datos de la cuenta arriba). Si no hay, la primera fila.
 */
export function detectarEncabezados(filas: readonly Fila[]): {
  indice: number
  encabezados: string[]
  datos: Fila[]
} {
  let indice = filas.findIndex((f) => f.some((c) => /fecha/i.test(String(c ?? ''))))
  if (indice < 0) indice = 0
  const encabezados = (filas[indice] ?? []).map((x) => String(x ?? '').trim())
  return { indice, encabezados, datos: filas.slice(indice + 1) }
}

/** Adivina qué columna es cada campo; una columna no se asigna a dos campos. */
export function adivinarColumnas(encabezados: readonly string[]): MapeoCartola {
  const mapa = {} as MapeoCartola
  const usadas = new Set<number>()
  for (const campo of CAMPOS_CARTOLA) {
    const j = encabezados.findIndex((h, i) => PATRONES_COLUMNA[campo].test(h) && !usadas.has(i))
    mapa[campo] = j
    if (j >= 0) usadas.add(j)
  }
  return mapa
}

const celda = (fila: Fila, j: number): Celda => (j >= 0 ? fila[j] : undefined)

/**
 * Filas → movimientos. Descarta filas sin fecha o sin monto.
 * Si no hay columnas de cargo ni abono, usa "monto": negativo = cargo, positivo = abono.
 */
export function construirMovimientos(
  datos: readonly Fila[],
  mapa: MapeoCartola,
): MovimientoCartola[] {
  const out: MovimientoCartola[] = []
  for (const fila of datos) {
    const fecha = parseDate(celda(fila, mapa.fecha))
    if (!fecha) continue
    let cargo = mapa.cargo >= 0 ? Math.abs(num(celda(fila, mapa.cargo) as string)) : 0
    let abono = mapa.abono >= 0 ? Math.abs(num(celda(fila, mapa.abono) as string)) : 0
    if (mapa.cargo < 0 && mapa.abono < 0 && mapa.monto >= 0) {
      const v = num(celda(fila, mapa.monto) as string)
      if (v < 0) cargo = -v
      else abono = v
    }
    if (!cargo && !abono) continue
    out.push({
      fecha,
      descripcion: tr(String(celda(fila, mapa.descripcion) ?? '')).slice(0, LARGO_DESCRIPCION),
      referencia: tr(String(celda(fila, mapa.referencia) ?? '')).slice(0, LARGO_REFERENCIA),
      cargo,
      abono,
    })
  }
  return out
}

/** Resumen para mostrar antes de guardar: "N movimientos · M cargos por $ X". */
export function resumenMovimientos(movs: readonly MovimientoCartola[]) {
  const cargos = movs.filter((m) => m.cargo > 0)
  return {
    movimientos: movs.length,
    cargos: cargos.length,
    totalCargos: cargos.reduce((s, m) => s + m.cargo, 0),
    abonos: movs.length - cargos.length,
  }
}

/** Clave para reconocer el mismo movimiento en dos cartolas (misma fecha, montos y glosa). */
export function claveMovimiento(m: MovimientoCartola): string {
  return [m.fecha, Math.round(m.cargo), Math.round(m.abono), norm(m.descripcion)].join('|')
}

/**
 * Separa los movimientos nuevos de los que ya están en cartolas guardadas
 * (p. ej. al subir dos cartolas que se traslapan en fechas). Cuenta repeticiones:
 * si ya había 1 cargo idéntico y llegan 2, solo 1 es duplicado (dos estacionamientos el mismo día).
 */
export function separarDuplicados(
  nuevos: readonly MovimientoCartola[],
  existentes: Iterable<MovimientoCartola>,
): { nuevos: MovimientoCartola[]; duplicados: MovimientoCartola[] } {
  const vistas = new Map<string, number>()
  for (const m of existentes) {
    const k = claveMovimiento(m)
    vistas.set(k, (vistas.get(k) ?? 0) + 1)
  }
  const r = { nuevos: [] as MovimientoCartola[], duplicados: [] as MovimientoCartola[] }
  for (const m of nuevos) {
    const k = claveMovimiento(m)
    const n = vistas.get(k) ?? 0
    if (n > 0) {
      vistas.set(k, n - 1)
      r.duplicados.push(m)
    } else r.nuevos.push(m)
  }
  return r
}
