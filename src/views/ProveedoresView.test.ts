import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Proveedor } from '@/types/proveedores'
import type { Rol } from '@/types/roles'

// Proveedores FICTICIOS (RUT calculados con el módulo 11)
const base = (): Proveedor[] => [
  { id: 'a', nombre: 'Ferretería Uno', rut: '12345678-5', eliminado: false },
  { id: 'b', nombre: 'Bencinera Sur', rut: '76000000-0', eliminado: false },
  { id: 'c', nombre: 'Taller Viejo', rut: '11111111-1', eliminado: true },
]
const srv = vi.hoisted(() => ({
  listarProveedores: vi.fn(),
  crearProveedor: vi.fn(),
  editarProveedor: vi.fn(),
  eliminarProveedor: vi.fn(),
  importarProveedores: vi.fn(),
  leerArchivoProveedores: vi.fn(),
}))
vi.mock('@/services/proveedores', () => srv)

const { default: ProveedoresView } = await import('./ProveedoresView.vue')
const { useAuthStore } = await import('@/stores/auth')

beforeEach(() => {
  setActivePinia(createPinia())
  for (const f of Object.values(srv)) f.mockReset()
  srv.listarProveedores.mockResolvedValue(base())
})

async function montarComo(rol: Rol) {
  const auth = useAuthStore()
  auth.persona = { id: 'p-1', nombre: 'Juana Pérez', codigo: 'JPE', rol }
  // Un solicitante no recibe los eliminados (RLS)
  if (rol === 'solicitante') srv.listarProveedores.mockResolvedValue(base().filter((p) => !p.eliminado))
  const w = mount(ProveedoresView)
  await flushPromises()
  return w
}
const boton = (w: VueWrapper, texto: string) =>
  w.findAll('button').find((b) => b.text().includes(texto))
const nombres = (w: VueWrapper) => w.findAll('tbody tr td:first-child').map((td) => td.text())

describe('ProveedoresView: solicitante', () => {
  it('ve los activos ordenados, con RUT con puntos, sin importar ni editar', async () => {
    const w = await montarComo('solicitante')
    expect(w.text()).toContain('Proveedores (2)')
    expect(nombres(w)).toEqual(['Bencinera Sur', 'Ferretería Uno'])
    expect(w.text()).toContain('12.345.678-5')
    expect(w.text()).not.toContain('Importar desde Excel')
    expect(boton(w, 'Editar')).toBeUndefined()
    expect(w.text()).not.toContain('Proveedores eliminados')
  })

  it('busca por nombre o RUT', async () => {
    const w = await montarComo('solicitante')
    await w.find('input[type="search"]').setValue('ferreteria')
    expect(nombres(w)).toEqual(['Ferretería Uno'])
    await w.find('input[type="search"]').setValue('76.000')
    expect(nombres(w)).toEqual(['Bencinera Sur'])
    await w.find('input[type="search"]').setValue('zzz')
    expect(w.text()).toContain('Ningún proveedor coincide con la búsqueda.')
  })

  it('agrega un proveedor: valida en pantalla y luego llama a la base', async () => {
    const w = await montarComo('solicitante')
    const [nombre, rut] = w.findAll('form input')
    await nombre!.setValue('Nuevo')
    await rut!.setValue('12.345.678-4')
    await w.find('form').trigger('submit')
    expect(w.text()).toContain('El RUT no es válido')
    expect(srv.crearProveedor).not.toHaveBeenCalled()

    srv.crearProveedor.mockResolvedValue({
      id: 'n',
      nombre: 'Nuevo',
      rut: '10000013-K',
      eliminado: false,
    })
    await rut!.setValue('10000013k')
    await rut!.trigger('blur')
    expect((rut!.element as HTMLInputElement).value).toBe('10.000.013-K')
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(srv.crearProveedor).toHaveBeenCalledWith({ nombre: 'Nuevo', rut: '10.000.013-K' })
    expect(w.text()).toContain('Nuevo agregado. Ya se puede elegir al rendir.')
    expect(w.text()).toContain('Proveedores (3)')
    expect((nombre!.element as HTMLInputElement).value).toBe('')
  })

  it('muestra el error de la base (p. ej. RUT de un eliminado)', async () => {
    const w = await montarComo('solicitante')
    srv.crearProveedor.mockRejectedValue(
      new Error('Ese RUT ya está registrado como «Taller Viejo». Está eliminado: tesorería puede restaurarlo.'),
    )
    const [nombre, rut] = w.findAll('form input')
    await nombre!.setValue('Otro')
    await rut!.setValue('11.111.111-1')
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(w.find('form [role="alert"]').text()).toContain('tesorería puede restaurarlo')
  })
})

describe('ProveedoresView: tesorería', () => {
  it('edita en línea', async () => {
    const w = await montarComo('tesorero')
    srv.editarProveedor.mockResolvedValue({
      id: 'a',
      nombre: 'Ferretería Uno SpA',
      rut: '12345678-5',
      eliminado: false,
    })
    await w.find('button[aria-label="Editar Ferretería Uno"]').trigger('click')
    await w.find('input[aria-label="Nombre de Ferretería Uno"]').setValue('Ferretería Uno SpA')
    await boton(w, 'Guardar')!.trigger('click')
    await flushPromises()
    expect(srv.editarProveedor).toHaveBeenCalledWith('a', {
      nombre: 'Ferretería Uno SpA',
      rut: '12.345.678-5',
    })
    expect(nombres(w)).toContain('Ferretería Uno SpA')
  })

  it('no guarda una edición con el RUT de otro proveedor', async () => {
    const w = await montarComo('tesorero')
    await w.find('button[aria-label="Editar Ferretería Uno"]').trigger('click')
    await w.find('input[aria-label="RUT de Ferretería Uno"]').setValue('76000000-0')
    await boton(w, 'Guardar')!.trigger('click')
    expect(w.text()).toContain('Ese RUT ya está registrado como «Bencinera Sur».')
    expect(srv.editarProveedor).not.toHaveBeenCalled()
  })

  it('elimina con confirmación y restaura desde los eliminados', async () => {
    const w = await montarComo('administrador')
    srv.eliminarProveedor.mockResolvedValue(undefined)
    await w.find('button[aria-label="Eliminar Bencinera Sur"]').trigger('click')
    await boton(w, 'Sí, eliminar')!.trigger('click')
    await flushPromises()
    expect(srv.eliminarProveedor).toHaveBeenCalledWith('b', true)
    expect(nombres(w)).toEqual(['Ferretería Uno'])
    expect(w.text()).toContain('Proveedores eliminados (2)')
    await w.find('button[aria-label="Restaurar Taller Viejo"]').trigger('click')
    await flushPromises()
    expect(srv.eliminarProveedor).toHaveBeenCalledWith('c', false)
    expect(w.text()).toContain('Taller Viejo restaurado.')
  })

  it('importa un Excel: vista previa y agrega solo los nuevos', async () => {
    const w = await montarComo('tesorero')
    srv.leerArchivoProveedores.mockResolvedValue([
      ['Proveedores'],
      ['Razón social', 'RUT'],
      ['Nuevo Uno', '10.000.013-K'],
      ['Ferretería Uno', '12345678-5'],
      ['Malo', '1-1'],
    ])
    srv.importarProveedores.mockResolvedValue(1)
    const input = w.find('input[data-test="archivo-proveedores"]')
    Object.defineProperty(input.element, 'files', {
      value: [new File(['x'], 'proveedores.xlsx')],
    })
    await input.trigger('change')
    await flushPromises()
    expect(w.find('[data-test="resumen-importacion"]').text()).toBe(
      '1 nuevo(s) · 1 ya registrado(s) · 1 con error.',
    )
    expect(w.text()).toContain('Fila 5 (Malo): RUT inválido.')
    await boton(w, 'Agregar 1 proveedor(es)')!.trigger('click')
    await flushPromises()
    expect(srv.importarProveedores).toHaveBeenCalledWith([
      { fila: 3, nombre: 'Nuevo Uno', rut: '10000013-K' },
    ])
    expect(srv.listarProveedores).toHaveBeenCalledTimes(2) // recarga después de importar
    expect(w.text()).toContain(
      '1 proveedor(es) agregado(s). 1 ya estaban registrados. 1 fila(s) con error no se cargaron.',
    )
  })

  it('archivo ilegible: muestra el error', async () => {
    const w = await montarComo('tesorero')
    srv.leerArchivoProveedores.mockRejectedValue(new Error('No se pudo leer el archivo.'))
    const input = w.find('input[data-test="archivo-proveedores"]')
    Object.defineProperty(input.element, 'files', { value: [new File(['x'], 'x.pdf')] })
    await input.trigger('change')
    await flushPromises()
    expect(w.text()).toContain('No se pudo leer el archivo.')
  })
})
