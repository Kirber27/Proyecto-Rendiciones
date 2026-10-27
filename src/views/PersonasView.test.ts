import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { catalogosDemo } from '@/dev/catalogosDemo'
import type { FilaLibro } from '@/domain/libro'
import type { Pago } from '@/services/pagos'

const srv = vi.hoisted(() => ({
  listarLibro: vi.fn(),
  leerPagos: vi.fn(),
  registrarPago: vi.fn(),
  eliminarPago: vi.fn(),
  porAprobarPorPersona: vi.fn(),
}))
vi.mock('@/services/libro', () => ({ listarLibro: srv.listarLibro }))
vi.mock('@/services/pagos', () => ({
  leerPagos: srv.leerPagos,
  registrarPago: srv.registrarPago,
  eliminarPago: srv.eliminarPago,
}))
vi.mock('@/services/aprobacion', () => ({
  porAprobarPorPersona: srv.porAprobarPorPersona,
  contarPorAprobar: vi.fn(async () => 0),
}))
vi.mock('@/services/catalogos', () => ({ leerCatalogos: vi.fn(async () => catalogosDemo) }))

const { default: PersonasView } = await import('./PersonasView.vue')

// Datos FICTICIOS: Mario (p-2) con dos rendiciones y un pago parcial; Juana (p-1) con un anticipo.
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
  decididoEn: null,
  nRespaldos: 0,
  ...c,
})
const pago = (c: Partial<Pago>): Pago => ({
  id: 'pg',
  personaId: 'p-2',
  fecha: '2026-09-10',
  monto: 10000,
  tipo: 'Pago',
  rendicionIds: [],
  medioPagoId: 2,
  descripcion: '',
  movimientoId: null,
  ...c,
})

beforeEach(() => {
  setActivePinia(createPinia())
  Object.values(srv).forEach((f) => f.mockReset())
  srv.listarLibro.mockResolvedValue([
    fila({ id: 'a', folio: 'MSO-001', nro: 1, fecha: '2026-09-01', total: 10000 }),
    fila({ id: 'b', folio: 'MSO-003', nro: 3, fecha: '2026-10-01', total: 5000 }),
  ])
  srv.leerPagos.mockResolvedValue([
    pago({ id: 'pg1', rendicionIds: ['a'] }),
    pago({ id: 'pg2', fecha: '2026-10-02', monto: 2000, movimientoId: 'mov-1' }),
    pago({ id: 'pg3', personaId: 'p-1', monto: 7000, tipo: 'Anticipo' }),
  ])
  srv.porAprobarPorPersona.mockResolvedValue(new Map([['p-2', 2]]))
  srv.registrarPago.mockResolvedValue('nuevo')
  Element.prototype.scrollIntoView = vi.fn()
})

const boton = (w: VueWrapper, texto: string) => w.findAll('button').find((b) => b.text() === texto)!
const fila$ = (w: VueWrapper, nombre: string) =>
  w.findAll('tbody tr').find((t) => t.text().includes(nombre))!

async function montar() {
  const w = mount(PersonasView, { attachTo: document.body })
  await flushPromises()
  return w
}

describe('PersonasView', () => {
  it('KPIs, orden por |saldo|, situación, faltantes y por aprobar', async () => {
    const w = await montar()
    expect(w.findAll('.kpi').map((k) => k.text())).toEqual([
      'Empresa debe (total)$ 3.000',
      'Fondos por rendir (total)$ 7.000',
      'Personas con saldo2',
    ])
    const tr = w.findAll('tbody tr')
    expect(tr[0]!.text()).toContain('Juana Pérez')
    expect(tr[0]!.text()).toContain('Pendiente por rendir')
    const mario = fila$(w, 'Mario Soto')
    expect(mario.text()).toContain('Por pagar · 1 rend.')
    expect(mario.findAll('td')[3]!.text()).toBe('2') // falta el Nº 2
    expect(mario.findAll('td')[8]!.text()).toBe('2')
    // Las personas activas sin movimientos también aparecen (para registrar un anticipo).
    expect(fila$(w, 'Laura Rojas').text()).toContain('Al día')
  })

  it('buscador sin tildes con "N de M personas"', async () => {
    const w = await montar()
    await w.find('input[type="search"]').setValue('perez')
    expect(w.findAll('tbody tr')).toHaveLength(1)
    expect(w.text()).toMatch(/1 de \d+ personas/)
  })

  it('detalle: movimientos con saldo acumulado; los de cartola no se eliminan', async () => {
    const w = await montar()
    await fila$(w, 'Mario Soto').trigger('click')
    const filas = w.findAll('#detalle-persona tbody tr').map((t) => t.findAll('td')[5]!.text())
    expect(filas).toEqual(['$ 10.000', '$ 0', '$ 5.000', '$ 3.000'])
    const detalle = w.find('#detalle-persona')
    expect(detalle.text()).toContain('Cartola')
    expect(detalle.findAll('button').filter((b) => b.text() === 'Eliminar')).toHaveLength(1)
  })

  it('eliminar un pago manual pide confirmación', async () => {
    const w = await montar()
    await fila$(w, 'Mario Soto').trigger('click')
    await w
      .find('#detalle-persona')
      .findAll('button')
      .find((b) => b.text() === 'Eliminar')!
      .trigger('click')
    expect(srv.eliminarPago).not.toHaveBeenCalled()
    await boton(w, 'Sí, eliminar').trigger('click')
    await flushPromises()
    expect(srv.eliminarPago).toHaveBeenCalledWith('pg1')
    expect(w.find('[role="status"]').text()).toContain('Pago de $ 10.000 del 10-09-2026 eliminado')
    expect(srv.listarLibro).toHaveBeenCalledTimes(2)
  })

  it('registrar: propone el saldo, suma las rendiciones marcadas y exige monto', async () => {
    const w = await montar()
    await fila$(w, 'Mario Soto').trigger('click')
    const monto = w.find<HTMLInputElement>('#pp-monto')
    expect(monto.element.value).toBe('3.000')
    expect(w.find<HTMLSelectElement>('#pp-medio').element.value).toBe('2') // Banco Internacional HGI

    await monto.setValue('')
    await w.find('form').trigger('submit')
    expect(srv.registrarPago).not.toHaveBeenCalled()
    expect(document.activeElement?.id).toBe('pp-monto')

    await w.find('input[type="checkbox"][value="b"]').setValue(true)
    expect(monto.element.value).toBe('3.000')
    await w.find('#pp-desc').setValue('transferencia')
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(srv.registrarPago).toHaveBeenCalledWith(
      expect.objectContaining({
        personaId: 'p-2',
        tipo: 'Pago',
        monto: 3000,
        medioPagoId: 2,
        descripcion: 'transferencia',
        rendicionIds: ['b'],
      }),
    )
    expect(w.find('[role="status"]').text()).toBe('Pago: $ 3.000 registrado para Mario Soto.')
  })

  it('devolución: sin vincular rendiciones y avisa en negativo', async () => {
    const w = await montar()
    await fila$(w, 'Juana Pérez').trigger('click')
    expect(w.find<HTMLInputElement>('#pp-monto').element.value).toBe('') // saldo negativo
    await w.find('#pp-tipo').setValue('Devolución de la persona')
    await w.find('#pp-monto').setValue('1.500')
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(srv.registrarPago).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'Devolución de la persona', monto: 1500, rendicionIds: [] }),
    )
    expect(w.find('[role="status"]').text()).toContain('-$ 1.500')
  })
})
