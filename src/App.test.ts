import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from '@/App.vue'
import { router } from '@/router'
import { useAuthStore } from '@/stores/auth'
import type { Rol } from '@/types/roles'

let pinia: Pinia
const montados: { unmount(): void }[] = []

async function montarComo(rol: Rol, ruta: string) {
  useAuthStore().fijarRol(rol)
  await router.push(ruta)
  const w = mount(App, { global: { plugins: [pinia, router] } })
  montados.push(w)
  await flushPromises()
  return w
}

const pestanas = (w: Awaited<ReturnType<typeof montarComo>>) =>
  w.findAll('nav[aria-label="Secciones"] a').map((a) => a.text())

describe('App: pestañas y permisos', () => {
  beforeEach(async () => {
    pinia = createPinia()
    setActivePinia(pinia)
    await router.replace('/rendir')
  })
  afterEach(() => montados.splice(0).forEach((w) => w.unmount()))

  it('solicitante ve solo Rendir gastos y Mis rendiciones', async () => {
    const w = await montarComo('solicitante', '/rendir')
    expect(pestanas(w)).toEqual(['Rendir gastos', 'Mis rendiciones'])
  })

  it('tesorero ve todo menos Perfiles', async () => {
    const w = await montarComo('tesorero', '/rendir')
    expect(pestanas(w)).toEqual([
      'Rendir gastos',
      'Carpetas',
      'Por aprobar',
      'Rendiciones',
      'Personas',
      'Banco',
    ])
  })

  it('administrador ve también Perfiles', async () => {
    const w = await montarComo('administrador', '/rendir')
    expect(pestanas(w)).toContain('Perfiles')
  })

  it('un solicitante que entra a una ruta de tesorería vuelve a Rendir gastos', async () => {
    const w = await montarComo('solicitante', '/libro')
    expect(router.currentRoute.value.path).toBe('/rendir')
    expect(w.find('nav[aria-label="Secciones"] a.active').text()).toBe('Rendir gastos')
  })

  it('si pierde el permiso estando en la pantalla, vuelve al inicio', async () => {
    await montarComo('administrador', '/perfiles')
    expect(router.currentRoute.value.path).toBe('/perfiles')
    useAuthStore().fijarRol('tesorero')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/rendir')
  })

  it('una ruta desconocida lleva a Rendir gastos', async () => {
    await montarComo('solicitante', '/no-existe')
    expect(router.currentRoute.value.path).toBe('/rendir')
  })
})
