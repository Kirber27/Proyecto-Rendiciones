// Totales, validación y limpieza de rendiciones
// (porta lineTotal, rendTotal, T, blankLine, validate y clean del prototipo).
import type { Catalogos } from '@/types/catalogos'
import type {
  BorradorRendicion,
  ConLineas,
  LineaBorrador,
  Monto,
  MontosLinea,
  RendicionPayload,
} from '@/types/rendicion'
import { montoATexto, num, tr } from './formato'
import { normalizarRut } from './rut'

/**
 * Clave del documento de una línea: RUT del proveedor + tipo + Nº (sin importar mayúsculas ni
 * espacios), igual que `_clave_documento` en la base. Null si no tiene RUT válido o Nº.
 */
export function claveDocumento(l: Pick<LineaBorrador, 'rut' | 'tipo' | 'numero'>): string | null {
  const rut = normalizarRut(l.rut)
  const numero = tr(l.numero).toUpperCase()
  return rut && numero ? `${rut}|${l.tipo}|${numero}` : null
}

/** Líneas que repiten el documento de una línea anterior del mismo formulario: índice → índice anterior. */
export function repetidosEnFormulario(
  lineas: readonly Pick<LineaBorrador, 'rut' | 'tipo' | 'numero'>[],
): Map<number, number> {
  const primera = new Map<string, number>()
  const repetidos = new Map<number, number>()
  lineas.forEach((l, i) => {
    const k = claveDocumento(l)
    if (!k) return
    const j = primera.get(k)
    if (j === undefined) primera.set(k, i)
    else repetidos.set(i, j)
  })
  return repetidos
}

/** Tasa del IVA en Chile. */
export const TASA_IVA = 0.19

/** IVA de un neto: neto × 19 %, redondeado al peso. */
export function ivaDe(neto: Monto): number {
  return Math.round(num(neto) * TASA_IVA)
}

/**
 * IVA de una línea, como texto para el formulario: en Factura se calcula del neto; en Boleta,
 * Boleta de honorarios y Transferencia es 0 (vacío), porque todo el monto va en exento.
 */
export function ivaLinea(l: Pick<LineaBorrador, 'tipo' | 'neto'>): string {
  return l.tipo === 'Factura' ? montoATexto(ivaDe(l.neto)) : ''
}

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
    proveedorId: null,
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

/** Empresa de un formulario nuevo (como el prototipo: EMP[1]). */
export const EMPRESA_POR_DEFECTO = 'Hecaglobal Instruments SPA'

export interface ContextoBorradorNuevo {
  catalogos: Pick<Catalogos, 'empresas'>
  /** Persona vinculada que no es tesorería: el solicitante queda fijo en ella. */
  personaFija: string | null
  /** Fecha del formulario (YYYY-MM-DD). */
  hoy: string
}

/** Formulario vacío: fecha de hoy, empresa por defecto y una línea con su C.C. */
export function borradorNuevo({ catalogos, personaFija, hoy }: ContextoBorradorNuevo): BorradorRendicion {
  const empresa =
    catalogos.empresas.find((e) => e.nombre === EMPRESA_POR_DEFECTO) ?? catalogos.empresas[0]
  return {
    personaId: personaFija,
    nro: '',
    fecha: hoy,
    empresaId: empresa?.id ?? null,
    fondo: '',
    totalFormulario: '',
    lineas: [lineaVacia({ fecha: hoy, centroCostoId: empresa?.centroCostoId ?? null })],
    respaldos: [],
  }
}

/**
 * Si la persona ya escribió algo (para no guardar ni "recuperar" un formulario vacío).
 * El Nº no cuenta: se llena solo al elegir el solicitante.
 */
export function tieneDatos(d: BorradorRendicion): boolean {
  if (tr(d.fondo) || tr(d.totalFormulario)) return true
  if (d.respaldos.length || d.lineas.length > 1) return true
  return d.lineas.some(
    (l) =>
      !!(tr(l.proveedor) || tr(l.rut) || tr(l.numero) || tr(l.detalle)) ||
      l.proveedorId != null ||
      l.subcuentaId != null ||
      totalLinea(l) !== 0,
  )
}

export interface ContextoValidacion {
  /** Tesorería además exige subcuenta y cuenta en cada línea. */
  esTesoreria: boolean
  /**
   * Cada línea debe tener un proveedor de la lista (Rendir gastos). Por aprobar y el libro no lo
   * exigen: el historial no trae proveedor.
   */
  exigirProveedor?: boolean
  /** Ids de las personas activas que se pueden elegir como solicitante. */
  personasActivas: readonly string[]
  /**
   * Respaldos que tendrá la rendición (guardados + nuevos). Si se indica, exige al menos uno
   * (Rendir gastos); el libro no lo pasa porque el historial no tiene respaldos.
   */
  respaldos?: number
}

/**
 * Problemas que impiden enviar, aprobar o guardar (todos juntos, en el orden del formulario).
 * Lista vacía = se puede guardar. El Nº no se valida: es correlativo y lo asigna el servidor.
 */
export function validarRendicion(d: BorradorRendicion, ctx: ContextoValidacion): string[] {
  const p: string[] = []
  if (!d.personaId || !ctx.personasActivas.includes(d.personaId)) {
    p.push('Elige el solicitante de la lista.')
  }
  if (!d.fecha) p.push('Falta la fecha.')
  if (!d.lineas.length) p.push('Agrega al menos un gasto.')
  const repetidos = repetidosEnFormulario(d.lineas)
  d.lineas.forEach((l, i) => {
    if (ctx.exigirProveedor && !l.proveedorId) p.push(`Línea ${i + 1}: elige el proveedor.`)
    const anterior = repetidos.get(i)
    if (anterior !== undefined) {
      p.push(`Línea ${i + 1}: repite el Nº de documento de la línea ${anterior + 1}.`)
    } else if (l.numeroRepetido) {
      p.push(`Línea ${i + 1}: este Nº de documento ya está cargado para este proveedor.`)
    }
    if (totalLinea(l) === 0) p.push(`Línea ${i + 1}: falta el monto.`)
    if (ctx.esTesoreria && l.subcuentaId == null) p.push(`Línea ${i + 1}: elige la subcuenta.`)
    if (ctx.esTesoreria && l.cuentaId == null) p.push(`Línea ${i + 1}: elige la cuenta.`)
  })
  if (cuadra(sumaLineas(d), totalFormularioDe(d)) === false) {
    p.push('La suma de los gastos no cuadra con el total del formulario.')
  }
  if (ctx.respaldos === 0) {
    p.push('Adjunta al menos un respaldo: la foto del formulario o de las boletas.')
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
    ...(d.nroFaltante && Number(d.nro) > 0 ? { nro_faltante: Number(d.nro) } : {}),
    fecha: d.fecha,
    empresa_id: d.empresaId,
    fondo: tr(d.fondo),
    total_formulario: totalFormularioDe(d),
    lineas: d.lineas.map((l, i) => ({
      orden: i + 1,
      fecha: l.fecha || d.fecha,
      tipo: l.tipo,
      proveedor_id: l.proveedorId,
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
