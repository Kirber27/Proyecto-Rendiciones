import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { catalogosDemo } from '@/dev/catalogosDemo'
import type { FilaLibro } from '@/domain/libro'
import { lineaVacia } from '@/domain/rendicion'
import type { RendicionAbierta } from '@/services/aprobacion'

const srv = vi.hoisted(() => ({
  listarLibro: vi.fn(),
  leerLineas: vi.fn(),
  editarRendicion: vi.fn(),
  anularAprobacion: vi.fn(),
  eliminarRendicion: vi.fn(),
  restaurarRendicion: vi.fn(),
  marcarExportadas: vi.fn(),
}))
const otros = vi.hoisted(() => ({
  leerPagos: vi.fn(),
  abrirRendicion: vi.fn(),
  descargarExcel: vi.fn(),
  descargarReportePdf: vi.fn(),
}))
vi.mock('@/services/libro', () => srv)
vi.mock('@/services/rendiciones', () => ({ siguienteNro: vi.fn(async () => 50) }))
vi.mock('@/services/proveedores', () => ({ listarProveedores: vi.fn(async () => []) }))
vi.mock('@/services/pagos', () => ({ leerPagos: otros.leerPagos }))
vi.mock('@/services/aprobacion', () => ({
  abrirRendicion: otros.abrirRendicion,
  contarPorAprobar: vi.fn(async () => 0),
}))
vi.mock('@/services/excel', () => ({ descargarExcel: otros.descargarExcel }))
vi.mock('@/services/pdf', () => ({ descargarReportePdf: otros.descargarReportePdf }))
vi.mock('@/services/catalogos', () => ({ leerCatalogos: vi.fn(async () => catalogosDemo) }))

const { default: LibroView } = await import('./LibroView.vue')

// Datos FICTICIOS
const fila = (c: Partial<FilaLibro>): FilaLibro => ({
  id: 'a',
  folio: 'MSO-001',
  personaId: 'p-2',
  personaNombre: 'Mario Soto',
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
const filas = () => [
  fila({ id: 'a', folio: 'MSO-001', nro: 1, fecha: '2026-09-01', exportada: true }),
  fila({ id: 'b', folio: 'MSO-002', nro: 2, fecha: '2026-10-01', total: 5000 }),
  fila({
    id: 'h',
    folio: 'JPE-007',
    personaId: 'p-1',
    personaNombre: 'Juana Pérez ',
    nro: 7,
    fecha: '2026-03-01',
    total: 2000,
    origen: 'Histórico',
  }),
  fila({ id: 'e', folio: 'MSO-003', nro: 3, fecha: '2026-10-05', estado: 'eliminada' }),
]
const pagos = () => [
  {
    id: 'pg',
    personaId: 'p-2',
    fecha: '2026-09-10',
    monto: 10000,
    tipo: 'Pago' as const,
    rendicionIds: ['a'],
    medioPagoId: 2,
    descripcion: '',
    movimientoId: null,
  },
]
const abierta = (): RendicionAbierta => ({
  borrador: {
    id: 'b',
    personaId: 'p-2',
    nro: '2',
    fecha: '2026-10-01',
    empresaId: 2,
    fondo: '',
    totalFormulario: '',
    lineas: [lineaVacia({ exento: '5.000', subcuentaId: 8, cuentaId: 2, centroCostoId: 3 })],
    respaldos: ['p-2/b/a.jpg'],
  },
  version: '2026-10-02T10:00:00Z',
  eventos: [{ evento: 'Aprobada', nota: 'Ingresada al libro como MSO-002', fecha: '2026-10-02' }],
  respaldos: [{ path: 'p-2/b/a.jpg', url: 'https://firmada/a.jpg', tipo: 'imagen' }],
  notaTesoreria: null,
})

const boton = (w: VueWrapper, texto: string) =>
  w.findAll('button').find((b) => b.text().includes(texto))!
const filasTabla = (w: VueWrapper) => w.findAll('tbody tr')

async function montar() {
  const w = mount(LibroView, { attachTo: document.body })
  await flushPromises()
  return w
}
async function abrirFila(w: VueWrapper, folio: string) {
  await filasTabla(w)
    .find((t) => t.text().includes(folio))!
    .trigger('click')
  await flushPromises()
}

beforeEach(() => {
  setActivePinia(createPinia())
  Object.values(srv).forEach((f) => f.mockReset())
  Object.values(otros).forEach((f) => f.mockReset())
  srv.listarLibro.mockImplementation(async () => filas())
  otros.leerPagos.mockImplementation(async () => pagos())
  otros.abrirRendicion.mockImplementation(async () => abierta())
  Element.prototype.scrollIntoView = vi.fn()
  window.scrollTo = vi.fn() as never
})

describe('LibroView', () => {
  it('KPIs, orden por fecha descendente y estado de pago FIFO', async () => {
    const w = await montar()
    const kpis = w.findAll('.kpi').map((k) => k.text())
    expect(kpis).toEqual([
      'Rendiciones3',
      'Total rendido$ 17.000',
      'Pendiente de pago$ 7.000',
      'Sin exportar a Excel2',
    ])
    const tr = filasTabla(w)
    expect(tr.map((t) => t.find('td').text())).toEqual(['MSO-002', 'MSO-001', 'JPE-007'])
    expect(tr[1]!.text()).toContain('Pagada')
    expect(tr[1]!.text()).toContain('—') // nada por pagar
    expect(tr[0]!.text()).toContain('Pendiente de pago')
  })

  it('filtros, buscador sin tildes y filtro Eliminadas', async () => {
    const w = await montar()
    await boton(w, 'Pagada').trigger('click')
    expect(filasTabla(w)).toHaveLength(1)
    await boton(w, 'Todas').trigger('click')
    await w.find('input[type="search"]').setValue('perez')
    expect(filasTabla(w).map((t) => t.find('td').text())).toEqual(['JPE-007'])
    await w.find('input[type="search"]').setValue('')
    await boton(w, 'Eliminadas').trigger('click')
    expect(filasTabla(w).map((t) => t.find('td').text())).toEqual(['MSO-003'])
  })

  it('las tarjetas siguen a la búsqueda y al filtro (todas las páginas)', async () => {
    const w = await montar()
    const kpis = () => w.findAll('.kpi').map((k) => k.text())
    expect(w.find('[data-test="kpis-busqueda"]').exists()).toBe(false)

    await w.find('input[type="search"]').setValue('soto')
    expect(kpis()).toEqual([
      'Rendiciones2',
      'Total rendido$ 15.000',
      'Pendiente de pago$ 5.000',
      'Sin exportar a Excel1',
    ])
    expect(w.find('[data-test="kpis-busqueda"]').text()).toContain('Según la búsqueda')

    await w.find('input[type="search"]').setValue('')
    await boton(w, 'Pagada').trigger('click')
    expect(kpis()).toEqual([
      'Rendiciones1',
      'Total rendido$ 10.000',
      'Pendiente de pago$ 0',
      'Sin exportar a Excel0',
    ])

    await boton(w, 'Todas').trigger('click')
    expect(kpis()[0]).toBe('Rendiciones3')
    expect(w.find('[data-test="kpis-busqueda"]').exists()).toBe(false)
    // El filtro Eliminadas sigue disponible aunque la búsqueda no muestre eliminadas
    await w.find('input[type="search"]').setValue('perez')
    expect(boton(w, 'Eliminadas')).toBeTruthy()
  })

  it('detalle: resumen, editor de libro y guardar con evento', async () => {
    srv.editarRendicion.mockResolvedValue('MSO-002')
    const w = await montar()
    await abrirFila(w, 'MSO-002')
    expect(w.text()).toContain('MSO-002 · Mario Soto · Nº 2')
    expect(w.find('.sum').text()).toContain('Saldo $ 5.000')
    expect(w.findAll('th').map((t) => t.text())).toContain('Cuenta')
    await boton(w, 'Guardar cambios').trigger('click')
    await flushPromises()
    expect(srv.editarRendicion).toHaveBeenCalledWith(
      'b',
      expect.objectContaining({ id: 'b' }),
      '2026-10-02T10:00:00Z',
    )
    expect(w.find('[role="status"]').text()).toBe('MSO-002: cambios guardados.')
    expect(srv.listarLibro).toHaveBeenCalledTimes(2)
  })

  it('anular pide confirmación en línea; el historial no se puede anular', async () => {
    const w = await montar()
    await abrirFila(w, 'JPE-007')
    expect(boton(w, 'Anular aprobación')).toBeUndefined()
    await abrirFila(w, 'MSO-002')
    await boton(w, 'Anular aprobación').trigger('click')
    expect(w.text()).toContain('vuelve a Por aprobar con sus fotos')
    expect(srv.anularAprobacion).not.toHaveBeenCalled()
    await boton(w, 'Sí, anular aprobación').trigger('click')
    await flushPromises()
    expect(srv.anularAprobacion).toHaveBeenCalledWith('b', undefined)
    expect(w.find('[role="status"]').text()).toContain('Volvió a Por aprobar')
  })

  it('eliminar con motivo y restaurar desde Eliminadas', async () => {
    const w = await montar()
    await abrirFila(w, 'MSO-002')
    await boton(w, 'Eliminar').trigger('click')
    await w.find('input[aria-label="Motivo"]').setValue('Duplicada')
    await boton(w, 'Sí, eliminar').trigger('click')
    await flushPromises()
    expect(srv.eliminarRendicion).toHaveBeenCalledWith('b', 'Duplicada')

    await boton(w, 'Eliminadas').trigger('click')
    await abrirFila(w, 'MSO-003')
    expect(boton(w, 'Guardar cambios')).toBeUndefined()
    await boton(w, 'Restaurar').trigger('click')
    await flushPromises()
    expect(srv.restaurarRendicion).toHaveBeenCalledWith('e')
  })

  it('PDF con los respaldos firmados y su tipo', async () => {
    const w = await montar()
    await abrirFila(w, 'MSO-001')
    await boton(w, 'Descargar reporte PDF').trigger('click')
    await vi.waitFor(() => expect(otros.descargarReportePdf).toHaveBeenCalled())
    const [modelo, respaldos] = otros.descargarReportePdf.mock.calls[0]!
    expect(modelo.nombreArchivo).toBe('Rendicion_MSO-001_Mario_Soto.pdf')
    expect(modelo.notas.join(' ')).toContain('Estado de pago: Pagada')
    expect(respaldos).toEqual([
      { path: 'p-2/b/a.jpg', url: 'https://firmada/a.jpg', tipo: 'imagen' },
    ])
  })

  it('Excel (nuevas) exporta las no exportadas y las marca; sin nuevas avisa', async () => {
    srv.leerLineas.mockResolvedValue(new Map())
    srv.marcarExportadas.mockResolvedValue(2)
    const w = await montar()
    await boton(w, 'Excel (nuevas)').trigger('click')
    await flushPromises()
    expect(srv.leerLineas).toHaveBeenCalledWith(['h', 'b'])
    expect(otros.descargarExcel).toHaveBeenCalledWith(
      [],
      expect.stringMatching(/^Rendiciones_\d{4}-\d{2}-\d{2}\.xlsx$/),
    )
    expect(srv.marcarExportadas).toHaveBeenCalledWith(['h', 'b'])
    expect(w.text()).toContain('Sin exportar a Excel0')

    await boton(w, 'Excel (nuevas)').trigger('click')
    await flushPromises()
    expect(w.find('[role="status"]').text()).toBe('No hay rendiciones nuevas para exportar.')

    await boton(w, 'Excel (todas)').trigger('click')
    await flushPromises()
    expect(srv.leerLineas).toHaveBeenLastCalledWith(['h', 'a', 'b'])
    expect(srv.marcarExportadas).toHaveBeenCalledTimes(1)
  })

  it('Excel (búsqueda) exporta lo que muestra la tabla, sin marcarlo como exportado', async () => {
    srv.leerLineas.mockResolvedValue(new Map())
    const w = await montar()
    const excelBusqueda = () => boton(w, 'Excel (búsqueda)')
    expect(excelBusqueda().attributes('disabled')).toBeDefined() // sin búsqueda ni filtro

    await w.find('input[type="search"]').setValue('soto')
    expect(excelBusqueda().attributes('disabled')).toBeUndefined()
    await excelBusqueda().trigger('click')
    await flushPromises()
    expect(srv.leerLineas).toHaveBeenCalledWith(['a', 'b'])
    expect(otros.descargarExcel).toHaveBeenCalledWith(
      [],
      expect.stringMatching(/^Rendiciones_busqueda_\d{4}-\d{2}-\d{2}\.xlsx$/),
    )
    expect(srv.marcarExportadas).not.toHaveBeenCalled()
    expect(w.find('[role="status"]').text()).toBe(
      'Excel con 2 rendición(es) y 0 línea(s) de la búsqueda.',
    )

    // Solo eliminadas en la tabla: nada que exportar
    await w.find('input[type="search"]').setValue('')
    await boton(w, 'Eliminadas').trigger('click')
    expect(excelBusqueda().attributes('disabled')).toBeDefined()
  })
})
