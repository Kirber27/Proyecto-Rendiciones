// Filas para el Excel de tesorería (porta exportar() del prototipo, sin la escritura del archivo).
// Columnas idénticas a la hoja "Rendiciones" del Excel original, con sus espacios finales,
// para que calcen con las tablas dinámicas existentes.
import { dnum, mes, semana } from './formato'
import { totalLinea } from './rendicion'

export const ENCABEZADOS_EXCEL = [
  'Nombre Solicitante',
  'Nro Rend.',
  'Fecha ',
  'Semana',
  'Mes',
  'C.C.',
  'Cuenta ',
  'Detalle',
  'Concepto ',
  'Tipo Doc',
  'Monto Neto ',
  'Monto Exento ',
  'Iva',
  'Total ',
  'Pagado por ',
  'Fecha de Pago ',
  'Monto ',
] as const

/** Índices de columnas con formato (los usa la escritura del archivo). */
export const COLUMNAS_FECHA = [2, 15] as const
export const COLUMNAS_MONTO = [10, 11, 12, 13, 16] as const
/** Anchos de columna (caracteres), como el prototipo. */
export const ANCHOS_EXCEL = [
  22, 8, 11, 13, 10, 7, 16, 24, 30, 12, 11, 11, 10, 11, 22, 11, 11,
] as const

/** Línea con los nombres de catálogo ya resueltos (grafía exacta de la base). */
export interface LineaExport {
  fecha: string
  tipo: string
  proveedor: string
  numero: string
  neto: number
  iva: number
  exento: number
  otros: number
  detalle: string
  subcuenta: string
  cuenta: string
  centroCosto: string
}

export interface RendicionExport {
  id: string
  /** Folio del libro (DHE-042); ordena las rendiciones de la misma fecha. */
  folio: string
  /** Nombre del solicitante con la grafía exacta ("David Herce "). */
  solicitante: string
  nro: number
  fecha: string
  exportada: boolean
  lineas: readonly LineaExport[]
}

export interface PagoExport {
  rendicionIds: readonly string[]
  /** Medio de pago con la grafía exacta ("Banco Internacional HGI "). */
  medioPago: string
  fecha: string
  monto: number
}

export type CeldaExcel = string | number | null

/** Fecha "YYYY-MM-DD" → número de serie de Excel (días desde 1899-12-30). */
export const serialExcel = (fecha: string): number | null => (fecha ? dnum(fecha) + 25569 : null)

/** Rendiciones a exportar, por fecha y folio. `soloNuevas` = las que aún no se exportaron. */
export function seleccionarParaExportar<
  T extends Pick<RendicionExport, 'fecha' | 'folio' | 'exportada'>,
>(rendiciones: readonly T[], soloNuevas: boolean): T[] {
  return rendiciones
    .filter((r) => !soloNuevas || !r.exportada)
    .slice()
    .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || '') || a.folio.localeCompare(b.folio))
}

/**
 * Filas de la hoja (sin encabezado): una por línea de gasto.
 * - Factura: neto, IVA y exento (+ otros) por separado. Otros tipos: todo el monto en "Monto Exento".
 * - "Detalle" = subcuenta. "Concepto" = detalle · proveedor · "Doc Nº".
 * - El pago (medio y fecha del último pago, suma de los pagos vinculados) va solo en la última línea.
 */
export function filasExcel(
  rendiciones: readonly RendicionExport[],
  pagos: readonly PagoExport[],
): CeldaExcel[][] {
  const pagosDe = new Map<string, PagoExport[]>()
  for (const p of pagos) {
    for (const id of p.rendicionIds) {
      const lista = pagosDe.get(id)
      if (lista) lista.push(p)
      else pagosDe.set(id, [p])
    }
  }

  const filas: CeldaExcel[][] = []
  for (const r of rendiciones) {
    // Mejora sobre el prototipo: el "último pago" es el de fecha más reciente (no el último cargado).
    const ps = (pagosDe.get(r.id) ?? [])
      .slice()
      .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''))
    const ultimo = ps.at(-1)
    const sumaPagos = ps.reduce((s, p) => s + p.monto, 0)

    r.lineas.forEach((l, i) => {
      const factura = l.tipo === 'Factura'
      const neto = factura ? l.neto : 0
      const exento = factura ? l.exento + l.otros : totalLinea(l)
      const iva = factura ? l.iva : 0
      const fecha = l.fecha || r.fecha
      const conPago = i === r.lineas.length - 1 && ultimo
      const concepto = [l.detalle, l.proveedor, l.numero ? 'Doc ' + l.numero : '']
        .filter(Boolean)
        .join(' · ')
      filas.push([
        r.solicitante,
        r.nro,
        serialExcel(fecha),
        fecha ? semana(fecha) : '',
        fecha ? mes(fecha) : '',
        l.centroCosto || '',
        l.cuenta || '',
        l.subcuenta || '',
        concepto,
        l.tipo,
        neto || null,
        exento || null,
        iva || null,
        neto + exento + iva,
        conPago ? ultimo.medioPago : null,
        conPago && ultimo.fecha ? serialExcel(ultimo.fecha) : null,
        conPago ? sumaPagos : null,
      ])
    })
  }
  return filas
}

/** Nombre del archivo: Rendiciones_YYYY-MM-DD.xlsx */
export const nombreArchivoExcel = (hoy: string) => `Rendiciones_${hoy}.xlsx`
