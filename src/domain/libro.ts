// Libro de rendiciones (porta vLibro() del prototipo): KPIs, filtros, búsqueda, página y armado de
// los datos para el Excel y el reporte PDF.
import type { Catalogos, OpcionCatalogo } from '@/types/catalogos'
import type { EstadoPagoRendicion } from '@/types/pagos'
import type { BorradorRendicion } from '@/types/rendicion'
import type { LineaExport, PagoExport, RendicionExport } from './exportar'
import { norm, num } from './formato'
import type { EntradaReporte, LineaReporte } from './reporte'

export const FILTROS_LIBRO = [
  'Pendiente de pago',
  'Pago parcial',
  'Pagada',
  'Todas',
  'Eliminadas',
] as const
export type FiltroLibro = (typeof FILTROS_LIBRO)[number]

/** Filas por página de la tabla. */
export const TAMANO_PAGINA = 50

export interface FilaLibro {
  id: string
  folio: string
  personaId: string
  /** Grafía exacta de la base ("David Herce "). */
  personaNombre: string
  nro: number
  fecha: string
  empresaId: number | null
  total: number
  estado: 'aprobada' | 'eliminada'
  origen: 'App' | 'Histórico'
  exportada: boolean
  /** Fecha/hora de la última decisión (aprobación en la app). */
  decididoEn: string | null
  nRespaldos: number
}

const SIN_PAGO: EstadoPagoRendicion = { pagado: 0, saldo: 0, estado: 'Sin monto', ultimo: '' }

/** Estado de pago de una fila (las eliminadas no entran al cálculo). */
export const pagoDe = (porRendicion: Map<string, EstadoPagoRendicion>, id: string) =>
  porRendicion.get(id) ?? SIN_PAGO

/** KPIs del libro (solo aprobadas). */
export function kpisLibro(
  filas: readonly FilaLibro[],
  porRendicion: Map<string, EstadoPagoRendicion>,
) {
  const aprobadas = filas.filter((f) => f.estado === 'aprobada')
  return {
    cantidad: aprobadas.length,
    rendido: aprobadas.reduce((s, f) => s + f.total, 0),
    pendiente: aprobadas
      .map((f) => pagoDe(porRendicion, f.id))
      .filter((p) => p.estado !== 'Pagada')
      .reduce((s, p) => s + p.saldo, 0),
    sinExportar: aprobadas.filter((f) => !f.exportada).length,
    eliminadas: filas.length - aprobadas.length,
  }
}

/** Filtro + buscador (persona, folio o Nº exacto), por fecha descendente. */
export function filtrarLibro(
  filas: readonly FilaLibro[],
  porRendicion: Map<string, EstadoPagoRendicion>,
  filtro: FiltroLibro,
  buscar: string,
): FilaLibro[] {
  const q = norm(buscar)
  return filas
    .filter((f) =>
      filtro === 'Eliminadas'
        ? f.estado === 'eliminada'
        : f.estado === 'aprobada' &&
          (filtro === 'Todas' || pagoDe(porRendicion, f.id).estado === filtro),
    )
    .filter(
      (f) =>
        !q || norm(f.personaNombre).includes(q) || norm(f.folio).includes(q) || String(f.nro) === q,
    )
    .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '') || b.folio.localeCompare(a.folio))
}

/** Una página de la lista (pagina desde 1; se ajusta si queda fuera de rango). */
export function paginar<T>(lista: readonly T[], pagina: number, tamano = TAMANO_PAGINA) {
  const paginas = Math.max(1, Math.ceil(lista.length / tamano))
  const p = Math.min(Math.max(1, pagina), paginas)
  return { items: lista.slice((p - 1) * tamano, p * tamano), pagina: p, paginas }
}

const nombre = (lista: readonly OpcionCatalogo[], id: number | null | undefined) =>
  lista.find((x) => x.id === id)?.nombre ?? ''

/** Línea de la base (montos numéricos, catálogos por id) para el Excel. */
export interface LineaBase {
  orden: number
  fecha: string | null
  tipo: string
  proveedor: string
  numero: string
  neto: number
  iva: number
  exento: number
  otros: number
  detalle: string
  subcuenta_id: number | null
  cuenta_id: number | null
  centro_costo_id: number | null
}

/** Rendiciones del libro + sus líneas → entrada de `filasExcel` (nombres con grafía exacta). */
export function rendicionesParaExcel(
  filas: readonly FilaLibro[],
  lineas: Map<string, readonly LineaBase[]>,
  cat: Pick<Catalogos, 'subcuentas' | 'cuentas' | 'centrosCosto'>,
): RendicionExport[] {
  return filas.map((f) => ({
    id: f.id,
    folio: f.folio,
    solicitante: f.personaNombre,
    nro: f.nro,
    fecha: f.fecha,
    exportada: f.exportada,
    lineas: (lineas.get(f.id) ?? [])
      .slice()
      .sort((a, b) => a.orden - b.orden)
      .map<LineaExport>((l) => ({
        fecha: l.fecha ?? '',
        tipo: l.tipo,
        proveedor: l.proveedor,
        numero: l.numero,
        neto: Number(l.neto),
        iva: Number(l.iva),
        exento: Number(l.exento),
        otros: Number(l.otros),
        detalle: l.detalle,
        subcuenta: nombre(cat.subcuentas, l.subcuenta_id),
        cuenta: nombre(cat.cuentas, l.cuenta_id),
        centroCosto: nombre(cat.centrosCosto, l.centro_costo_id),
      })),
  }))
}

/** Pagos con vínculo explícito → entrada de `filasExcel`. */
export function pagosParaExcel(
  pagos: readonly {
    rendicionIds: readonly string[]
    medioPagoId: number | null
    fecha: string
    monto: number
  }[],
  mediosPago: readonly OpcionCatalogo[],
): PagoExport[] {
  return pagos
    .filter((p) => p.rendicionIds.length)
    .map((p) => ({
      rendicionIds: p.rendicionIds,
      medioPago: nombre(mediosPago, p.medioPagoId),
      fecha: p.fecha,
      monto: p.monto,
    }))
}

/** Entrada del reporte PDF a partir de la rendición guardada (borrador recién abierto). */
export function entradaReporte(
  fila: FilaLibro,
  b: BorradorRendicion,
  ctx: {
    catalogos: Pick<Catalogos, 'empresas' | 'subcuentas' | 'mediosPago'>
    estadoPago: EstadoPagoRendicion
    pagos: readonly { fecha: string; medioPagoId: number | null; monto: number }[]
    hoy: string
  },
): EntradaReporte {
  const empresa = ctx.catalogos.empresas.find((e) => e.id === b.empresaId)
  return {
    folio: fila.folio,
    solicitante: fila.personaNombre,
    nro: num(b.nro),
    fecha: b.fecha,
    empresa: empresa ? { nombre: empresa.nombre, rut: empresa.rut } : null,
    fondo: b.fondo,
    totalFormulario: b.totalFormulario.trim() ? num(b.totalFormulario) : null,
    lineas: b.lineas.map<LineaReporte>((l) => ({
      fecha: l.fecha,
      tipo: l.tipo,
      proveedor: l.proveedor,
      numero: l.numero,
      neto: num(l.neto),
      iva: num(l.iva),
      exento: num(l.exento),
      otros: num(l.otros),
      detalle: l.detalle,
      subcuenta: nombre(ctx.catalogos.subcuentas, l.subcuentaId),
    })),
    estadoPago: ctx.estadoPago,
    pagos: ctx.pagos
      .slice()
      .sort((a, c) => (a.fecha || '').localeCompare(c.fecha || ''))
      .map((p) => ({
        fecha: p.fecha,
        medioPago: nombre(ctx.catalogos.mediosPago, p.medioPagoId),
        monto: p.monto,
      })),
    aprobadoEn: fila.origen === 'App' ? fila.decididoEn : null,
    origen: fila.origen,
    cantidadRespaldos: b.respaldos.length,
    hoy: ctx.hoy,
  }
}
