import type { Session } from '@supabase/supabase-js'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { catalogosDemo } from '@/dev/catalogosDemo'

vi.mock('@/services/catalogos', () => ({ leerCatalogos: vi.fn(async () => catalogosDemo) }))
vi.mock('@/services/aprobacion', () => ({
  abrirRendicion: vi.fn(),
  urlsFirmadas: vi.fn(async () => new Map()),
}))
const enviarRendicion = vi.hoisted(() => vi.fn())
const siguienteNro = vi.hoisted(() => vi.fn(async () => 5))
vi.mock('@/services/rendiciones', () => ({
  enviarRendicion,
  siguienteNro,
  nrosFaltantes: vi.fn(async () => []),
}))
vi.mock('@/services/proveedores', () => ({ listarProveedores: vi.fn(async () => []) }))

const { default: RendirView } = await import('./RendirView.vue')
const { useAuthStore } = await import('@/stores/auth')
const { useRendirStore } = await import('@/stores/rendir')

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  enviarRendicion.mockReset()
  const auth = useAuthStore()
  auth.listo = true
  auth.session = { user: { id: 'u-1', email: 'x@ejemplo.cl' } } as Session
  auth.persona = { id: 'p-1', nombre: 'Juana Pérez ', codigo: 'JPE', rol: 'solicitante' }
})

async function montar() {
  const w = mount(RendirView)
  await flushPromises()
  return w
}
const boton = (w: Awaited<ReturnType<typeof montar>>, texto: string) =>
  w.findAll('button').find((b) => b.text().includes(texto))!

describe('RendirView', () => {
  it('abre directo el formulario, con la zona para adjuntar respaldos', async () => {
    const w = await montar()
    expect(w.text()).toContain('1. Completa el formulario')
    expect(w.find('select').attributes('disabled')).toBeDefined() // solicitante fijo
    expect(w.text()).toContain('Respaldos (0)')
    expect(boton(w, 'Adjuntar fotos o PDF').exists()).toBe(true)
    expect(w.text()).not.toMatch(/Leyendo|Leer con IA|Volver a leer/)
  })

  it('el Nº es el correlativo de la persona y no se escribe', async () => {
    const w = await montar()
    const nro = w.find('input[readonly].mono')
    expect(siguienteNro).toHaveBeenCalledWith('p-1')
    expect((nro.element as HTMLInputElement).value).toBe('5')
  })

  it('Enviar valida y muestra los problemas sin llamar al envío', async () => {
    const w = await montar()
    await boton(w, 'Enviar rendición').trigger('click')
    expect(w.find('[role="alert"]').text()).toContain('Línea 1: elige el proveedor.')
    expect(w.text()).toContain('Línea 1: falta el monto.')
    expect(w.text()).toContain('Adjunta al menos un respaldo')
    expect(enviarRendicion).not.toHaveBeenCalled()
  })

  it('con un respaldo adjunto ya no lo pide', async () => {
    const w = await montar()
    useRendirStore().agregarArchivos([new File(['%PDF'], 'b.pdf', { type: 'application/pdf' })])
    await flushPromises()
    expect(w.find('a.thumb-pdf').text()).toBe('b.pdf')
    await boton(w, 'Enviar rendición').trigger('click')
    expect(w.find('[role="alert"]').text()).not.toContain('Adjunta al menos un respaldo')
  })

  it('Descartar pide confirmación y deja el formulario vacío', async () => {
    const w = await montar()
    const rendir = useRendirStore()
    rendir.borrador!.fondo = 'FONDOS POR RENDIR'
    await boton(w, 'Descartar').trigger('click')
    expect(w.text()).toContain('¿Descartar esta rendición?')
    await boton(w, 'Sí, descartar').trigger('click')
    await flushPromises()
    expect(rendir.borrador!.fondo).toBe('')
    expect(rendir.borrador!.nro).toBe('5') // el formulario nuevo vuelve a tener su correlativo
    expect(w.text()).not.toContain('¿Descartar esta rendición?')
  })
})
