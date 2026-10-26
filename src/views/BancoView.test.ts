import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { catalogosDemo } from '@/dev/catalogosDemo'
import type { FilaLibro } from '@/domain/libro'
import type { Pago } from '@/services/pagos'
import type { MovimientoGuardado } from '@/types/banco'

const srv = vi.hoisted(() => ({
  leerCartolas: vi.fn(),
  leerFilasArchivo: vi.fn(),
  guardarCartola: vi.fn(),
  confirmarConciliacion: vi.fn(),
  ignorarMovimiento: vi.fn(),
  deshacerAsignacion: vi.fn(),
  eliminarCartola: vi.fn(),
  listarLibro: vi.fn(),
  leerPagos: vi.fn(),
}))
vi.mock('@/services/banco', () => ({
  leerCartolas: srv.leerCartolas,
  leerFilasArchivo: srv.leerFilasArchivo,
  guardarCartola: srv.guardarCartola,
  confirmarConciliacion: srv.confirmarConciliacion,
  ignorarMovimiento: srv.ignorarMovimiento,
  deshacerAsignacion: srv.deshacerAsignacion,
  eliminarCartola: srv.eliminarCartola,
}))
vi.mock('@/services/libro', () => ({ listarLibro: srv.listarLibro }))
vi.mock('@/services/pagos', () => ({ leerPagos: srv.leerPagos }))
vi.mock('@/services/aprobacion', () => ({ contarPorAprobar: vi.fn(async () => 0) }))
vi.mock('@/services/catalogos', () => ({ leerCatalogos: vi.fn(async () => catalogosDemo) }))

const { default: BancoView } = await import('./BancoView.vue')

// Datos FICTICIOS
const fila = (c: Partial<FilaLibro>): FilaLibro => ({
  id: 'a',
  folio: 'MSO-001',
  personaId: 'p-2',
  personaNombre: 'Mario Soto',
  nro: 1,
  fecha: '2026-10-01',
  empresaId: 2,
  total: 10000,
  estado: 'aprobada',
  origen: 'App',
  exportada: false,
  decididoEn: null,
  nRespaldos: 0,
  ...c,
})
const pago = (c: Partial<Pago>): Pago => ({
  id: 'pl',
  personaId: 'p-3',
  fecha: '2026-10-10',
  monto: 4000,
  tipo: 'Anticipo',
  rendicionIds: [],
  medioPagoId: 2,
  descripcion: '',
  movimientoId: null,
  ...c,
})
const mov = (c: Partial<MovimientoGuardado>): MovimientoGuardado => ({
  id: 'm',
  cartolaId: 'c1',
  idx: 0,
  fecha: '2026-10-05',
  descripcion: '',
  referencia: '',
  cargo: 0,
  abono: 0,
  ignorado: false,
  ...c,
})
const movimientos = () => [
  mov({ id: 'm1', idx: 0, fecha: '2026-10-05', descripcion: 'TRANSF MARIO SOTO', cargo: 10000 }),
  mov({ id: 'm2', idx: 1, fecha: '2026-10-11', descripcion: 'TRANSFERENCIA', cargo: 4000 }),
  mov({ id: 'm3', idx: 2, fecha: '2026-10-12', descripcion: 'COMPRA SUPERMERCADO', cargo: 777 }),
  mov({
    id: 'm4',
    idx: 3,
    fecha: '2026-10-02',
    descripcion: 'COMISION',
    cargo: 500,
    ignorado: true,
  }),
  mov({ id: 'm5', idx: 4, fecha: '2026-10-03', descripcion: 'ABONO', abono: 90000 }),
]

beforeEach(() => {
  setActivePinia(createPinia())
  Object.values(srv).forEach((f) => f.mockReset())
  srv.listarLibro.mockResolvedValue([
    fila({}),
    fila({
      id: 'h',
      folio: 'JPE-007',
      personaId: 'p-1',
      personaNombre: 'Juana Pérez ',
      total: 5000,
      fecha: '2026-09-01',
    }),
  ])
  srv.leerPagos.mockResolvedValue([pago({})])
  srv.leerCartolas.mockResolvedValue({
    cartolas: [
      { id: 'c1', nombreArchivo: 'octubre.xlsx', medioPagoId: 2, creadoEn: '2026-10-20T10:00:00Z' },
    ],
    movimientos: movimientos(),
  })
})

const boton = (w: VueWrapper, texto: string) =>
  w.findAll('button').find((b) => b.text().startsWith(texto))!
async function montar() {
  const w = mount(BancoView)
  await flushPromises()
  return w
}

describe('BancoView', () => {
  it('propuestas: monto y nombre marcada; pago ya registrado solo por monto sin marcar', async () => {
    const w = await montar()
    const filas = w.findAll('tbody tr')
    const p1 = filas.find((t) => t.text().includes('TRANSF MARIO SOTO'))!
    expect(p1.text()).toContain('Mario Soto · MSO-001')
    expect(p1.text()).toContain('Monto y nombre')
    expect(p1.text()).toContain('Banco Internacional HGI')
    expect(p1.find<HTMLInputElement>('input[type="checkbox"]').element.checked).toBe(true)
    const p2 = filas.find((t) => t.text().includes('TRANSFERENCIA'))!
    expect(p2.text()).toContain('Pago registrado a Laura Rojas el 10-10-2026')
    expect(p2.find<HTMLInputElement>('input[type="checkbox"]').element.checked).toBe(false)
    expect(boton(w, 'Confirmar seleccionados').text()).toContain('(1)')
  })

  it('confirmar envía las marcadas y avisa', async () => {
    srv.confirmarConciliacion.mockResolvedValue(2)
    const w = await montar()
    const p2 = w.findAll('tbody tr').find((t) => t.text().includes('TRANSFERENCIA'))!
    await p2.find('input[type="checkbox"]').setValue(true)
    await boton(w, 'Confirmar seleccionados').trigger('click')
    await flushPromises()
    expect(srv.confirmarConciliacion).toHaveBeenCalledWith([
      { movimientoId: 'm1', tipo: 'rendiciones', rendicionIds: ['a'] },
      { movimientoId: 'm2', tipo: 'pago', pagoId: 'pl' },
    ])
    expect(w.find('[role="status"]').text()).toBe('2 movimiento(s) conciliado(s).')
    expect(srv.leerCartolas).toHaveBeenCalledTimes(2)
  })

  it('cargo sin asignar: candidatas, anticipo y "No es de rendiciones"', async () => {
    const w = await montar()
    expect(w.text()).toContain('Cargos sin asignar (1)')
    const sel = w.find('select[aria-label^="Asignar cargo del 12-10-2026"]')
    const opciones = sel.findAll('option').map((o) => o.text())
    expect(opciones).toContain('JPE-007 · Juana Pérez · $ 5.000')
    expect(opciones).toContain('Laura Rojas')
    await sel.setValue('a:p-3')
    await boton(w, 'Aplicar').trigger('click')
    await flushPromises()
    expect(srv.confirmarConciliacion).toHaveBeenCalledWith([
      { movimientoId: 'm3', tipo: 'anticipo', personaId: 'p-3' },
    ])

    await w.find('select[aria-label^="Asignar cargo del 12-10-2026"]').setValue('x')
    await boton(w, 'Aplicar').trigger('click')
    await flushPromises()
    expect(srv.ignorarMovimiento).toHaveBeenCalledWith('m3', true)
  })

  it('cargos resueltos con deshacer y cartolas con conteo y eliminar', async () => {
    srv.eliminarCartola.mockResolvedValue(3)
    const w = await montar()
    expect(w.text()).toContain('Cargos asignados o ignorados (1)')
    expect(w.text()).toContain('No es de rendiciones')
    await boton(w, 'Deshacer').trigger('click')
    await flushPromises()
    expect(srv.deshacerAsignacion).toHaveBeenCalledWith('m4')

    const cartola = w.findAll('tr').find((t) => t.text().includes('octubre.xlsx'))!
    expect(cartola.text()).toContain('1 de 4')
    await cartola
      .findAll('button')
      .find((b) => b.text() === 'Eliminar')!
      .trigger('click')
    await boton(w, 'Sí, eliminar').trigger('click')
    await flushPromises()
    expect(srv.eliminarCartola).toHaveBeenCalledWith('c1')
    expect(w.find('[role="status"]').text()).toBe(
      'Cartola eliminada junto con 3 pago(s) creados desde ella.',
    )
  })

  it('cargar cartola: mapeo adivinado, resumen, duplicados y guardar solo los nuevos', async () => {
    srv.leerFilasArchivo.mockResolvedValue([
      ['Cartola cuenta corriente'],
      ['Fecha', 'Descripción', 'Cargos', 'Abonos', 'Nº Operación'],
      ['05-10-2026', 'TRANSF MARIO SOTO', '10.000', '', '1'],
      ['21-10-2026', 'PEAJE', '2.500', '', '2'],
      ['22-10-2026', 'DEPOSITO', '', '50.000', '3'],
      ['', 'Saldo final', '', '', ''],
    ])
    srv.guardarCartola.mockResolvedValue('c2')
    const w = await montar()
    const input = w.find('input[data-test="archivo"]')
    Object.defineProperty(input.element, 'files', {
      value: [new File(['x'], 'nov.xlsx')],
    })
    await input.trigger('change')
    await flushPromises()
    expect(w.find<HTMLSelectElement>('#col-cargo').element.value).toBe('2')
    expect(w.find<HTMLSelectElement>('#col-monto').element.value).toBe('-1')
    expect(w.find('[data-test="resumen"]').text()).toBe('3 movimientos · 2 cargos por $ 12.500.')
    expect(w.text()).toContain('1 movimiento(s) ya están en otra cartola')
    await boton(w, 'Guardar cartola').trigger('click')
    await flushPromises()
    expect(srv.guardarCartola).toHaveBeenCalledWith('nov.xlsx', 2, [
      expect.objectContaining({ idx: 1, descripcion: 'PEAJE', cargo: 2500 }),
      expect.objectContaining({ idx: 2, descripcion: 'DEPOSITO', abono: 50000 }),
    ])
    expect(w.find('[role="status"]').text()).toContain('1 ya estaban en otra cartola')
  })

  it('archivo ilegible: mensaje del servicio', async () => {
    srv.leerFilasArchivo.mockRejectedValue(
      new Error('No se pudo leer el archivo. Descárgalo del banco en formato Excel o CSV.'),
    )
    const w = await montar()
    const input = w.find('input[data-test="archivo"]')
    Object.defineProperty(input.element, 'files', { value: [new File(['x'], 'x.pdf')] })
    await input.trigger('change')
    await flushPromises()
    expect(w.text()).toContain('No se pudo leer el archivo.')
  })
})
