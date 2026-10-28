import { describe, expect, it } from 'vitest'
import { catalogosDemo } from '@/dev/catalogosDemo'
import type { EstadoPagoRendicion } from '@/types/pagos'
import type { BorradorRendicion } from '@/types/rendicion'
import { asignarPagos } from '../asignacion'
import { filasExcel } from '../exportar'
import {
  entradaReporte,
  filtrarLibro,
  kpisLibro,
  paginar,
  pagosParaExcel,
  rendicionesParaExcel,
  type FilaLibro,
  type LineaBase,
} from '../libro'
import { modeloReporte } from '../reporte'

// Datos FICTICIOS
const fila = (c: Partial<FilaLibro>): FilaLibro => ({
  id: 'x',
  folio: 'JPE-001',
  personaId: 'p-1',
  personaNombre: 'Juana Pérez ',
  nro: 1,
  fecha: '2026-09-01',
  empresaId: 2,
  total: 10000,
  estado: 'aprobada',
  origen: 'App',
  exportada: false,
  decididoEn: '2026-09-02T12:00:00Z',
  nRespaldos: 1,
  ...c,
})

const filas: FilaLibro[] = [
  fila({ id: 'a', folio: 'JPE-001', nro: 1, fecha: '2026-09-01', total: 10000, exportada: true }),
  fila({ id: 'b', folio: 'JPE-002', nro: 2, fecha: '2026-09-15', total: 8000 }),
  fila({ id: 'c', folio: 'JPE-003', nro: 3, fecha: '2026-10-01', total: 5000 }),
  fila({
    id: 'd',
    folio: 'MSO-004',
    personaId: 'p-2',
    personaNombre: 'Mario Soto',
    nro: 4,
    fecha: '2026-10-05',
    total: 3000,
    origen: 'Histórico',
  }),
  fila({ id: 'e', folio: 'JPE-005', nro: 5, fecha: '2026-10-06', estado: 'eliminada' }),
]

// Juana: pago vinculado a la 1 (pagada) y 3.000 sueltos (parcial en la 2); Mario sin pagos.
const pagos = [
  {
    id: 'p1',
    personaId: 'p-1',
    fecha: '2026-09-10',
    monto: 10000,
    tipo: 'Pago' as const,
    rendicionIds: ['a'],
    medioPagoId: 2,
  },
  {
    id: 'p2',
    personaId: 'p-1',
    fecha: '2026-09-20',
    monto: 3000,
    tipo: 'Pago' as const,
    rendicionIds: [],
    medioPagoId: 2,
  },
]
const aprobadas = filas
  .filter((f) => f.estado === 'aprobada')
  .map((f) => ({ id: f.id, personaId: f.personaId, nro: f.nro, fecha: f.fecha, total: f.total }))
const { porRendicion } = asignarPagos(aprobadas, pagos)

describe('kpisLibro', () => {
  it('cuenta solo aprobadas; pendiente = saldo de las no pagadas', () => {
    expect(kpisLibro(filas, porRendicion)).toEqual({
      cantidad: 4,
      rendido: 26000,
      pendiente: 5000 + 5000 + 3000,
      sinExportar: 3,
      eliminadas: 1,
    })
  })
})

describe('filtrarLibro', () => {
  const ids = (f: Parameters<typeof filtrarLibro>[2], q = '') =>
    filtrarLibro(filas, porRendicion, f, q).map((x) => x.id)

  it('Todas: aprobadas por fecha descendente', () => {
    expect(ids('Todas')).toEqual(['d', 'c', 'b', 'a'])
  })
  it('por estado de pago', () => {
    expect(ids('Pagada')).toEqual(['a'])
    expect(ids('Pago parcial')).toEqual(['b'])
    expect(ids('Pendiente de pago')).toEqual(['d', 'c'])
  })
  it('Eliminadas', () => {
    expect(ids('Eliminadas')).toEqual(['e'])
  })
  it('buscador: persona sin tildes, folio o Nº exacto', () => {
    expect(ids('Todas', 'perez')).toEqual(['c', 'b', 'a'])
    expect(ids('Todas', 'mso-0')).toEqual(['d'])
    expect(ids('Todas', '2')).toEqual(['b'])
    expect(ids('Todas', '  SOTO ')).toEqual(['d'])
  })
})

describe('paginar', () => {
  const lista = Array.from({ length: 120 }, (_, i) => i)
  it('corta en páginas y ajusta fuera de rango', () => {
    expect(paginar(lista, 1).items).toHaveLength(50)
    expect(paginar(lista, 3)).toMatchObject({ pagina: 3, paginas: 3 })
    expect(paginar(lista, 3).items).toHaveLength(20)
    expect(paginar(lista, 9).pagina).toBe(3)
    expect(paginar([], 1)).toEqual({ items: [], pagina: 1, paginas: 1 })
  })
})

describe('Excel desde el libro', () => {
  const linea = (c: Partial<LineaBase>): LineaBase => ({
    orden: 1,
    fecha: '2026-09-01',
    tipo: 'Boleta',
    proveedor: 'Copec',
    numero: '123',
    neto: 0,
    iva: 0,
    exento: 6000,
    otros: 0,
    detalle: 'viaje',
    subcuenta_id: catalogosDemo.subcuentas[0]!.id,
    cuenta_id: catalogosDemo.cuentas[0]!.id,
    centro_costo_id: catalogosDemo.centrosCosto[0]!.id,
    ...c,
  })

  it('resuelve nombres de catálogo, ordena líneas y pone el pago vinculado en la última', () => {
    const lineas = new Map([['a', [linea({ orden: 2, exento: 4000 }), linea({ orden: 1 })]]])
    const rs = rendicionesParaExcel([filas[0]!], lineas, catalogosDemo)
    expect(rs[0]!.solicitante).toBe('Juana Pérez ')
    expect(rs[0]!.lineas.map((l) => l.exento)).toEqual([6000, 4000])
    expect(rs[0]!.lineas[0]!.subcuenta).toBe(catalogosDemo.subcuentas[0]!.nombre)

    const ps = pagosParaExcel(pagos, catalogosDemo.mediosPago)
    expect(ps).toHaveLength(1) // el pago suelto no va al Excel
    const out = filasExcel(rs, ps)
    expect(out).toHaveLength(2)
    expect(out[0]!.slice(14)).toEqual([null, null, null])
    expect(out[1]![14]).toBe(catalogosDemo.mediosPago.find((m) => m.id === 2)!.nombre)
    expect(out[1]![16]).toBe(10000)
  })
})

describe('entradaReporte', () => {
  const b: BorradorRendicion = {
    id: 'a',
    personaId: 'p-1',
    nro: '1',
    fecha: '2026-09-01',
    empresaId: catalogosDemo.empresas[0]!.id,
    fondo: 'FONDOS POR RENDIR',
    totalFormulario: '10.000',
    lineas: [
      {
        fecha: '2026-09-01',
        tipo: 'Boleta',
        proveedorId: null,
        proveedor: 'Copec',
        rut: '',
        numero: '9',
        neto: '0',
        iva: '0',
        exento: '10.000',
        otros: '0',
        detalle: 'viaje',
        subcuentaId: catalogosDemo.subcuentas[0]!.id,
        cuentaId: null,
        centroCostoId: null,
      },
    ],
    respaldos: ['p-1/a/1.jpg', 'p-1/a/2.jpg'],
  }
  const pago: EstadoPagoRendicion = porRendicion.get('a')!

  it('arma el modelo del PDF con empresa, montos, pagos y aprobación', () => {
    const e = entradaReporte(filas[0]!, b, {
      catalogos: catalogosDemo,
      estadoPago: pago,
      pagos: [pagos[0]!],
      hoy: '2026-10-26',
    })
    expect(e.empresa?.rut).toBe(catalogosDemo.empresas[0]!.rut)
    expect(e.totalFormulario).toBe(10000)
    expect(e.lineas[0]!.exento).toBe(10000)
    expect(e.cantidadRespaldos).toBe(2)
    expect(e.aprobadoEn).toBe('2026-09-02T12:00:00Z')
    const m = modeloReporte(e)
    expect(m.nombreArchivo).toBe('Rendicion_JPE-001_Juana_Pérez.pdf')
    expect(m.notas.join(' ')).toContain('Estado de pago: Pagada')
  })

  it('historial: sin fecha de aprobación, informa el origen', () => {
    const e = entradaReporte(
      filas[3]!,
      { ...b, totalFormulario: '' },
      {
        catalogos: catalogosDemo,
        estadoPago: porRendicion.get('d')!,
        pagos: [],
        hoy: '2026-10-26',
      },
    )
    expect(e.aprobadoEn).toBeNull()
    expect(e.totalFormulario).toBeNull()
    expect(modeloReporte(e).notas.join(' ')).toContain('Origen: Histórico.')
  })
})
