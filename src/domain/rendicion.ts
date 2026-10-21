// Totales, validación y limpieza de rendiciones
// (porta lineTotal, rendTotal, T, blankLine, validate y clean del prototipo).
import type {
  BorradorRendicion,
  ConLineas,
  LineaBorrador,
  MontosLinea,
  RendicionPayload,
} from '@/types/rendicion'
import { num, tr } from './formato'

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

/** Total del formulario del borrador como número, o null si está vacío. */
export function totalFormularioDe(d: Pick<BorradorRendicion, 'totalFormulario'>): number | null {
  return tr(d.totalFormulario) === '' ? null : num(d.totalFormulario)
}

/** Línea nueva: boleta, con la fecha y el C.C. que se le pasen (por defecto los del formulario). */
export function lineaVacia(base: Partial<LineaBorrador> = {}): LineaBorrador {
  return {
    fecha: '',
    tipo: 'Boleta',
    proveedor: '',
    rut: '',
    numero: '',
    neto: '',
    iva: '',
    exento: '',
    otros: '',
    detalle: '',
    subcuentaId: null,
    cuentaId: null,
    centroCostoId: null,
    ...base,
  }
}

export interface ContextoValidacion {
  /** Tesorería además exige subcuenta y cuenta en cada línea. */
  esTesoreria: boolean
  /** Ids de las personas activas que se pueden elegir como solicitante. */
  personasActivas: readonly string[]
}

/**
 * Problemas que impiden enviar, aprobar o guardar (todos juntos, en el orden del formulario).
 * Lista vacía = se puede guardar.
 */
export function validarRendicion(d: BorradorRendicion, ctx: ContextoValidacion): string[] {
  const p: string[] = []
  if (!d.personaId || !ctx.personasActivas.includes(d.personaId)) {
    p.push('Elige el solicitante de la lista.')
  }
  const nro = tr(d.nro)
  if (!nro) p.push('Falta el Nº de rendición.')
  else if (!/^\d+$/.test(nro) || Number(nro) <= 0) p.push('El Nº de rendición debe ser un número.')
  if (!d.fecha) p.push('Falta la fecha.')
  if (!d.lineas.length) p.push('Agrega al menos un gasto.')
  d.lineas.forEach((l, i) => {
    if (totalLinea(l) === 0) p.push(`Línea ${i + 1}: falta el monto.`)
    if (ctx.esTesoreria && l.subcuentaId == null) p.push(`Línea ${i + 1}: elige la subcuenta.`)
    if (ctx.esTesoreria && l.cuentaId == null) p.push(`Línea ${i + 1}: elige la cuenta.`)
  })
  if (cuadra(sumaLineas(d), totalFormularioDe(d)) === false) {
    p.push('La suma de los gastos no cuadra con el total del formulario.')
  }
  return p
}

/**
 * Borrador → payload para la base: textos recortados, montos numéricos y fecha de línea
 * por defecto = fecha del formulario. Llamar solo después de `validarRendicion` sin problemas.
 */
export function limpiarRendicion(d: BorradorRendicion): RendicionPayload {
  if (!d.personaId) throw new Error('limpiarRendicion: falta personaId (validar antes)')
  return {
    ...(d.id ? { id: d.id } : {}),
    persona_id: d.personaId,
    nro: Number(tr(d.nro)) || 0,
    fecha: d.fecha,
    empresa_id: d.empresaId,
    fondo: tr(d.fondo),
    total_formulario: totalFormularioDe(d),
    lineas: d.lineas.map((l, i) => ({
      orden: i + 1,
      fecha: l.fecha || d.fecha,
      tipo: l.tipo,
      proveedor: tr(l.proveedor),
      rut: tr(l.rut),
      numero: tr(l.numero),
      neto: num(l.neto),
      iva: num(l.iva),
      exento: num(l.exento),
      otros: num(l.otros),
      detalle: tr(l.detalle),
      subcuenta_id: l.subcuentaId,
      cuenta_id: l.cuentaId,
      centro_costo_id: l.centroCostoId,
    })),
  }
}
