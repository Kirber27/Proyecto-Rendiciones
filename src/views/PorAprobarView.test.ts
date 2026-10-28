import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { catalogosDemo } from '@/dev/catalogosDemo'
import { lineaVacia } from '@/domain/rendicion'
import type { FilaBandeja, RendicionAbierta } from '@/services/aprobacion'

const srv = vi.hoisted(() => ({
  listarPorAprobar: vi.fn(),
  foliosExistentes: vi.fn(),
  abrirRendicion: vi.fn(),
  aprobarRendicion: vi.fn(),
  observarRendicion: vi.fn(),
  rechazarRendicion: vi.fn(),
  contarPorAprobar: vi.fn(async () => 1),
}))
vi.mock('@/services/aprobacion', async (original) => ({
  ...(await original<typeof import('@/services/aprobacion')>()),
  ...srv,
}))
vi.mock('@/services/catalogos', () => ({ leerCatalogos: vi.fn(async () => catalogosDemo) }))
vi.mock('@/services/rendiciones', () => ({ siguienteNro: vi.fn(async () => 50) }))
vi.mock('@/services/proveedores', () => ({ listarProveedores: vi.fn(async () => []) }))

const { default: PorAprobarView } = await import('./PorAprobarView.vue')
const { aBorradorDesdeBase, folioPropuesto, marcaBandeja } = await import('@/services/aprobacion')

// Datos FICTICIOS
const fila: FilaBandeja = {
  id: 'r-1',
  personaId: 'p-2',
  personaNombre: 'Mario Soto',
  personaCodigo: 'MSO',
  nro: 4,
  fecha: '2026-10-20',
  total: 15000,
  totalFormulario: 15000,
  enviadoEn: '2026-10-21T10:00:00Z',
  editadoEn: '2026-10-21T10:00:00Z',
  nLineas: 1,
  nRespaldos: 1,
  marca: 'Reenviada',
  folioPropuesto: 'MSO-004',
}
const abierta = (): RendicionAbierta => ({
  borrador: {
    id: 'r-1',
    personaId: 'p-2',
    nro: '4',
    fecha: '2026-10-20',
    empresaId: 1,
    fondo: '',
    totalFormulario: '15.000',
    lineas: [lineaVacia({ exento: '15.000', subcuentaId: 8, cuentaId: null })],
    respaldos: ['p-2/r-1/a.jpg'],
  },
  version: '2026-10-21T10:00:00Z',
  eventos: [
    { evento: 'Enviada', nota: '1 gasto(s) por $ 15.000', fecha: '2026-10-20T09:00:00Z' },
    { evento: 'Observada', nota: 'Falta la boleta', fecha: '2026-10-20T12:00:00Z' },
    { evento: 'Reenviada', nota: null, fecha: '2026-10-21T10:00:00Z' },
  ],
  respaldos: [{ path: 'p-2/r-1/a.jpg', url: 'https://firmada/a.jpg', tipo: 'imagen' }],
  notaTesoreria: 'Falta la boleta',
})

async function montarYAbrir() {
  const w = mount(PorAprobarView)
  await flushPromises()
  await w.find('tbody tr').trigger('click')
  await flushPromises()
  return w
}
const boton = (w: Awaited<ReturnType<typeof montarYAbrir>>, texto: string) =>
  w.findAll('button').find((b) => b.text().startsWith(texto))!

beforeEach(() => {
  setActivePinia(createPinia())
  Object.values(srv).forEach((f) => f.mockClear())
  srv.listarPorAprobar.mockResolvedValue([fila])
  srv.foliosExistentes.mockResolvedValue(new Set(['MSO-004']))
  srv.abrirRendicion.mockImplementation(async () => abierta())
  srv.aprobarRendicion.mockResolvedValue('MSO-004-7f')
})

describe('servicio de aprobación', () => {
  it('folio propuesto y marca de la bandeja', () => {
    expect(folioPropuesto('DHE', 42)).toBe('DHE-042')
    expect(marcaBandeja({ aprobacion_anulada: true, ultimo_evento: 'Reenviada' })).toBe(
      'Aprobación anulada',
    )
    expect(marcaBandeja({ aprobacion_anulada: false, ultimo_evento: 'Reenviada' })).toBe(
      'Reenviada',
    )
    expect(marcaBandeja({ aprobacion_anulada: false, ultimo_evento: 'Enviada' })).toBe(
      'En revisión',
    )
  })

  it('arma el borrador desde la base con montos como texto y líneas en orden', () => {
    const b = aBorradorDesdeBase(
      {
        id: 'r',
        persona_id: 'p',
        nro: 42,
        fecha: '2026-10-14',
        empresa_id: 2,
        fondo: 'F',
        total_formulario: 70389,
      } as never,
      [
        {
          orden: 2,
          fecha: null,
          tipo: 'Factura',
          proveedor_id: null,
          proveedor: 'B',
          rut: '',
          numero: '',
          neto: 1000,
          iva: 190,
          exento: 0,
          otros: 0,
          detalle: '',
          subcuenta_id: 7,
          cuenta_id: 1,
          centro_costo_id: 3,
        },
        {
          orden: 1,
          fecha: '2026-10-14',
          tipo: 'Boleta',
          proveedor_id: 'pv-1',
          proveedor: 'A',
          rut: '',
          numero: '9',
          neto: 0,
          iva: 0,
          exento: 70389,
          otros: 0,
          detalle: 'd',
          subcuenta_id: 40,
          cuenta_id: 9,
          centro_costo_id: 3,
        },
      ] as never,
      ['p/r/a.jpg'],
    )
    expect(b).toMatchObject({
      id: 'r',
      nro: '42',
      totalFormulario: '70.389',
      respaldos: ['p/r/a.jpg'],
    })
    expect(b.lineas.map((l) => l.proveedor)).toEqual(['A', 'B'])
    expect(b.lineas.map((l) => l.proveedorId)).toEqual(['pv-1', null])
    expect(b.lineas[0]).toMatchObject({ exento: '70.389', neto: '', subcuentaId: 40 })
    expect(b.lineas[1]).toMatchObject({ fecha: '', neto: '1.000', iva: '190' })
  })
})

describe('PorAprobarView', () => {
  it('lista con marca, cuadre y aviso de Nº repetido', async () => {
    const w = mount(PorAprobarView)
    await flushPromises()
    const tr = w.find('tbody tr')
    expect(tr.text()).toContain('Mario Soto')
    expect(tr.text()).toContain('Ya existe MSO-004 en el libro')
    expect(tr.text()).toContain('Cuadra')
    expect(tr.text()).toContain('Reenviada')
  })

  it('vacía: muestra el mensaje', async () => {
    srv.listarPorAprobar.mockResolvedValue([])
    const w = mount(PorAprobarView)
    await flushPromises()
    expect(w.text()).toContain('No hay rendiciones esperando aprobación.')
  })

  it('abrir muestra movimientos, editor con Cuenta y C.C. y las fotos', async () => {
    const w = await montarYAbrir()
    expect(w.text()).toContain('Revisar: Mario Soto · Nº 4')
    expect(w.text()).toContain('Movimientos (3)')
    expect(w.text()).toContain('Falta la boleta')
    expect(w.findAll('th').map((t) => t.text())).toContain('Cuenta')
    expect(w.find('img[src="https://firmada/a.jpg"]').exists()).toBe(true)
  })

  it('aprobar exige cuenta; con todo completo aprueba y avisa el folio', async () => {
    const w = await montarYAbrir()
    await boton(w, 'Aprobar e ingresar').trigger('click')
    expect(srv.aprobarRendicion).not.toHaveBeenCalled()
    expect(w.text()).toContain('Línea 1: elige la cuenta.')
    await w.find('select[aria-label="Cuenta línea 1"]').setValue('2')
    await boton(w, 'Aprobar e ingresar').trigger('click')
    await flushPromises()
    expect(srv.aprobarRendicion).toHaveBeenCalledWith(
      'r-1',
      expect.objectContaining({ id: 'r-1' }),
      '2026-10-21T10:00:00Z',
    )
    expect(w.find('[role="status"]').text()).toBe('MSO-004-7f aprobada e ingresada al libro.')
    expect(w.text()).not.toContain('Revisar:')
  })

  it('devolver exige motivo y lo envía con la versión', async () => {
    const w = await montarYAbrir()
    await boton(w, 'Devolver para corregir').trigger('click')
    expect(srv.observarRendicion).not.toHaveBeenCalled()
    expect(w.text()).toContain('Escribe el motivo de la observación')
    await w.find('#nota-obs').setValue('Falta la boleta del taxi')
    await boton(w, 'Devolver para corregir').trigger('click')
    await flushPromises()
    expect(srv.observarRendicion).toHaveBeenCalledWith(
      'r-1',
      'Falta la boleta del taxi',
      '2026-10-21T10:00:00Z',
    )
    expect(w.find('[role="status"]').text()).toContain('devuelta para corregir')
  })

  it('rechazar pide confirmación', async () => {
    const w = await montarYAbrir()
    await boton(w, 'Rechazar').trigger('click')
    expect(srv.rechazarRendicion).not.toHaveBeenCalled()
    await boton(w, 'Sí, rechazar').trigger('click')
    await flushPromises()
    expect(srv.rechazarRendicion).toHaveBeenCalledWith('r-1', '', '2026-10-21T10:00:00Z')
  })

  it('si la base rechaza (p. ej. otra persona ya decidió), muestra su mensaje', async () => {
    srv.observarRendicion.mockRejectedValueOnce(
      new Error('Esta rendición ya fue revisada. Actualiza la lista.'),
    )
    const w = await montarYAbrir()
    await w.find('#nota-obs').setValue('x')
    await boton(w, 'Devolver para corregir').trigger('click')
    await flushPromises()
    expect(w.find('[role="status"]').text()).toBe(
      'Esta rendición ya fue revisada. Actualiza la lista.',
    )
    expect(w.text()).toContain('Revisar:') // queda abierta
  })
})
