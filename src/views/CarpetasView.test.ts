import type { Session } from '@supabase/supabase-js'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { catalogosDemo } from '@/dev/catalogosDemo'
import { asignarPagos } from '@/domain/asignacion'
import type { DatosCarpeta } from '@/services/carpetas'
import type { Rol } from '@/types/roles'

const srv = vi.hoisted(() => ({ leerCarpeta: vi.fn(), leerIndiceCarpetas: vi.fn() }))
vi.mock('@/services/carpetas', () => srv)
vi.mock('@/services/catalogos', () => ({ leerCatalogos: vi.fn(async () => catalogosDemo) }))
vi.mock('@/services/aprobacion', () => ({ contarPorAprobar: vi.fn(async () => 0) }))
const push = vi.hoisted(() => vi.fn())
const ruta = vi.hoisted(() => ({ params: {} as Record<string, string> }))
vi.mock('vue-router', () => ({
  useRoute: () => ruta,
  useRouter: () => ({ push }),
  RouterLink: { template: '<a><slot /></a>' },
}))

const { default: CarpetasView } = await import('./CarpetasView.vue')
const { useAuthStore } = await import('@/stores/auth')
const { useRendirStore } = await import('@/stores/rendir')

// Datos FICTICIOS de la carpeta de Juana (p-1)
function datos(): DatosCarpeta {
  const rendiciones: DatosCarpeta['rendiciones'] = [
    {
      id: 'a',
      folio: 'JPE-001',
      nro: 1,
      fecha: '2026-09-01',
      total: 10000,
      estado: 'aprobada',
      aprobacionAnulada: false,
      origen: 'App',
      respaldos: 2,
      notaTesoreria: null,
      eventos: [
        { evento: 'Enviada', nota: null, fecha: '2026-09-01T10:00:00Z' },
        {
          evento: 'Aprobada',
          nota: 'Ingresada al libro como JPE-001',
          fecha: '2026-09-02T10:00:00Z',
        },
      ],
    },
    {
      id: 'b',
      folio: null,
      nro: 2,
      fecha: '2026-10-01',
      total: 5000,
      estado: 'observada',
      aprobacionAnulada: false,
      origen: 'App',
      respaldos: 1,
      notaTesoreria: 'Falta la boleta del taxi',
      eventos: [],
    },
  ]
  const pagos = [
    {
      id: 'pg',
      personaId: 'p-1',
      fecha: '2026-09-10',
      monto: 10000,
      tipo: 'Pago' as const,
      rendicionIds: ['a'],
      medioPagoId: 2,
      descripcion: '',
      movimientoId: null,
    },
  ]
  return {
    rendiciones,
    pagos,
    asignacion: asignarPagos(
      [{ id: 'a', personaId: 'p-1', nro: 1, fecha: '2026-09-01', total: 10000 }],
      pagos,
    ),
    folios: new Map([['a', 'JPE-001']]),
  }
}

function sesion(rol: Rol) {
  const auth = useAuthStore()
  auth.listo = true
  auth.session = { user: { id: 'u-1', email: 'x@ejemplo.cl' } } as Session
  auth.persona = { id: 'p-1', nombre: 'Juana Pérez ', codigo: 'JPE', rol }
}

beforeEach(() => {
  setActivePinia(createPinia())
  srv.leerCarpeta.mockReset().mockResolvedValue(datos())
  srv.leerIndiceCarpetas.mockReset()
  push.mockReset()
  ruta.params = {}
})

describe('CarpetasView: solicitante', () => {
  it('muestra su carpeta con estados, devueltas, filtros y pagos', async () => {
    sesion('solicitante')
    const w = mount(CarpetasView)
    await flushPromises()
    expect(srv.leerCarpeta).toHaveBeenCalledWith('p-1')
    expect(w.text()).toContain('Juana Pérez')
    expect(w.text()).toContain('Devueltas para corregir')
    expect(w.text()).toContain('Nº 2: Falta la boleta del taxi')
    expect(w.text()).toContain('Pagada') // JPE-001 pagada con el pago vinculado
    expect(w.text()).toContain('Observada')
    expect(w.text()).toContain('Pagos y anticipos recibidos (1)')
    expect(w.text()).toContain('Banco Internacional HGI')
    expect(w.find('.sum').text()).toContain('Saldo $ 0')
  })

  it('filtrar por casillas', async () => {
    sesion('solicitante')
    const w = mount(CarpetasView)
    await flushPromises()
    const pagadas = w.findAll('label.filtro').find((l) => l.text().includes('Pagadas'))!
    await pagadas.find('input').setValue(true)
    expect(w.text()).toContain('Mostrando 1 de 2 rendiciones')
  })

  it('"Corregir y reenviar" abre la rendición en Rendir gastos', async () => {
    sesion('solicitante')
    const w = mount(CarpetasView)
    await flushPromises()
    const rendir = useRendirStore()
    const spy = vi.spyOn(rendir, 'cargarParaCorregir').mockResolvedValue()
    await w
      .findAll('button')
      .find((b) => b.text() === 'Corregir y reenviar')!
      .trigger('click')
    await flushPromises()
    expect(spy).toHaveBeenCalledWith('b')
    expect(push).toHaveBeenCalledWith({ name: 'rendir' })
  })
})

describe('CarpetasView: tesorería', () => {
  it('índice: una tarjeta por persona, primero quien tiene por aprobar; busca sin tildes', async () => {
    sesion('tesorero')
    srv.leerIndiceCarpetas.mockResolvedValue({
      conteos: new Map([
        ['p-2', { rendiciones: 5, porAprobar: 0 }],
        ['p-3', { rendiciones: 1, porAprobar: 2 }],
      ]),
      asignacion: asignarPagos([], []),
    })
    const w = mount(CarpetasView)
    await flushPromises()
    const nombres = w.findAll('.card b').map((b) => b.text())
    expect(nombres.slice(0, 2)).toEqual(['Laura Rojas', 'Mario Soto'])
    expect(w.text()).toContain('2 por aprobar')
    await w.find('input[type="search"]').setValue('perez')
    expect(w.findAll('.card b').map((b) => b.text())).toEqual(['Juana Pérez'])
  })

  it('carpeta de otra persona: sin "Corregir y reenviar"', async () => {
    sesion('tesorero')
    ruta.params = { personaId: 'p-2' }
    srv.leerCarpeta.mockResolvedValue(datos())
    const w = mount(CarpetasView)
    await flushPromises()
    expect(srv.leerCarpeta).toHaveBeenCalledWith('p-2')
    expect(w.text()).toContain('Mario Soto')
    expect(w.text()).not.toContain('Corregir y reenviar')
  })
})
