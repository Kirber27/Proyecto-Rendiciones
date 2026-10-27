// Contenido del reporte PDF de una rendición (porta reportePDF() del prototipo, sin el dibujo).
// El dibujo con jsPDF está en services/pdf.ts.
import type { EstadoPagoRendicion } from '@/types/pagos'
import { clp, fdate, tr } from './formato'
import { totalLinea } from './rendicion'

export interface LineaReporte {
  fecha: string
  tipo: string
  proveedor: string
  numero: string
  neto: number
  iva: number
  exento: number
  otros: number
  detalle: string
  /** Nombre de la subcuenta (grafía de la base; se muestra recortada). */
  subcuenta: string
}

export interface EntradaReporte {
  folio: string
  solicitante: string
  nro: number
  fecha: string
  empresa: { nombre: string; rut: string } | null
  fondo: string
  totalFormulario: number | null
  lineas: readonly LineaReporte[]
  estadoPago: EstadoPagoRendicion
  pagos: readonly { fecha: string; medioPago: string; monto: number }[]
  /** Fecha/hora de aprobación (ISO) si se aprobó en la app. */
  aprobadoEn?: string | null
  origen: 'App' | 'Histórico'
  cantidadRespaldos: number
  /** Fecha de generación (YYYY-MM-DD). */
  hoy: string
}

export interface TotalReporte {
  etiqueta: string
  valor: string
  destacado?: boolean
}

export interface ModeloReporte {
  folio: string
  titulo: string
  datos: [etiqueta: string, valor: string][]
  encabezadoTabla: string[]
  filas: string[][]
  totales: TotalReporte[]
  notas: string[]
  nombreArchivo: string
}

export const ENCABEZADO_TABLA_REPORTE = [
  'Fecha',
  'Tipo',
  'Proveedor',
  'Nº doc.',
  'Neto',
  'IVA',
  'Exento/Monto',
  'Total',
  'Subcuenta / detalle',
]

const monto = (n: number) => (n ? clp(n) : '')

export function modeloReporte(e: EntradaReporte): ModeloReporte {
  const total = e.lineas.reduce((s, l) => s + totalLinea(l), 0)
  const suma = (tipo: string) =>
    e.lineas.filter((l) => l.tipo === tipo).reduce((s, l) => s + totalLinea(l), 0)
  const facturas = suma('Factura')
  const transferencias = suma('Transferencia')

  const totales: TotalReporte[] = [
    { etiqueta: 'Total compras facturas', valor: clp(facturas) },
    { etiqueta: 'Total compras boletas / otros', valor: clp(total - facturas - transferencias) },
    { etiqueta: 'Transferencias realizadas', valor: clp(transferencias) },
    { etiqueta: 'TOTAL RENDICIÓN', valor: clp(total), destacado: true },
  ]
  if (e.totalFormulario != null)
    totales.push({ etiqueta: 'Total escrito en formulario', valor: clp(e.totalFormulario) })
  totales.push(
    { etiqueta: 'Pagado', valor: clp(e.estadoPago.pagado) },
    { etiqueta: 'Saldo por pagar', valor: clp(e.estadoPago.saldo) },
  )

  const { estado, ultimo } = e.estadoPago
  const notas = [
    `Estado de pago: ${estado}${ultimo ? ` (último pago ${fdate(ultimo)})` : ''}`,
    e.pagos.length
      ? `Pagos vinculados: ${e.pagos.map((p) => `${fdate(p.fecha)} ${tr(p.medioPago)} ${clp(p.monto)}`.trim()).join('; ')}`
      : '',
    e.aprobadoEn ? `Aprobada por tesorería el ${fdate(e.aprobadoEn)}.` : `Origen: ${e.origen}.`,
    `Respaldos adjuntos: ${e.cantidadRespaldos}. Reporte generado el ${fdate(e.hoy)}.`,
  ].filter(Boolean)

  return {
    folio: e.folio,
    titulo: (e.fondo || 'Rendición de gastos').toUpperCase(),
    datos: [
      ['Fecha', fdate(e.fecha)],
      ['Empresa', e.empresa ? `${e.empresa.nombre}  ·  RUT ${e.empresa.rut}` : ''],
      ['Nº rendición', String(e.nro)],
      ['Solicitante', tr(e.solicitante)],
      ['ID interno', e.folio],
    ],
    encabezadoTabla: ENCABEZADO_TABLA_REPORTE,
    filas: e.lineas.map((l) => [
      fdate(l.fecha),
      l.tipo,
      tr(l.proveedor),
      tr(l.numero),
      monto(l.neto),
      monto(l.iva),
      monto(l.exento + l.otros),
      clp(totalLinea(l)),
      [tr(l.subcuenta), tr(l.detalle)].filter(Boolean).join(' · '),
    ]),
    totales,
    notas,
    nombreArchivo: nombreArchivoReporte(e.folio, e.solicitante),
  }
}

/** Rendicion_DHE-042_David_Herce.pdf (sin caracteres problemáticos para el sistema de archivos). */
export function nombreArchivoReporte(folio: string, solicitante: string): string {
  const limpio = (s: string) =>
    tr(s)
      .replace(/[\\/:*?"<>|]/g, '')
      .replace(/\s+/g, '_')
  return `Rendicion_${limpio(folio)}_${limpio(solicitante)}.pdf`
}
