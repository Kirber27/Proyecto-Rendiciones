import type { Session } from '@supabase/supabase-js'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from '@/App.vue'
import { router } from '@/router'
import { mensajeErrorIngreso, useAuthStore } from '@/stores/auth'
import type { Rol } from '@/types/roles'

let pinia: Pinia
const montados: { unmount(): void }[] = []

/** Simula una sesión ya iniciada (sin llamar a Supabase). */
function iniciarSesion(rol: Rol | null) {
  const auth = useAuthStore()
  auth.listo = true
  auth.session = { user: { id: 'u-1', email: 'persona@ejemplo.cl' } } as Session
  auth.persona = rol ? { id: 'p-1', nombre: 'Juana Pérez ', codigo: 'JPE', rol } : null
}

async function montar(ruta: string) {
  await router.push(ruta)
  const w = mount(App, { global: { plugins: [pinia, router] } })
  montados.push(w)
  await flushPromises()
  return w
}

async function montarComo(rol: Rol, ruta: string) {
  iniciarSesion(rol)
  return montar(ruta)
}

const pestanas = (w: Awaited<ReturnType<typeof montar>>) =>
  w.findAll('nav[aria-label="Secciones"] a').map((a) => a.text())

beforeEach(async () => {
  pinia = createPinia()
  setActivePinia(pinia)
  useAuthStore().listo = true
  await router.replace('/ingresar')
})
afterEach(() => montados.splice(0).forEach((w) => w.unmount()))

describe('App: sesión', () => {
  it('sin sesión cualquier ruta lleva al ingreso, recordando a dónde iba', async () => {
    await montar('/libro')
    expect(router.currentRoute.value.name).toBe('ingresar')
    expect(router.currentRoute.value.query.volver).toBe('/libro')
  })

  it('con sesión, /ingresar lleva al inicio', async () => {
    iniciarSesion('solicitante')
    await montar('/ingresar?volver=/mis') // distinta de la ruta actual para que pase por el guard
    expect(router.currentRoute.value.path).toBe('/rendir')
  })

  it('muestra el nombre de la persona y su función', async () => {
    const w = await montarComo('tesorero', '/rendir')
    expect(w.find('header').text()).toContain('Juana Pérez')
    expect(w.find('header').text()).toContain('Tesorero')
  })

  it('una cuenta sin persona vinculada ve el aviso y solo pestañas de solicitante', async () => {
    iniciarSesion(null)
    const w = await montar('/rendir')
    expect(w.text()).toContain('no está vinculada a ninguna persona')
    expect(pestanas(w)).toEqual(['Rendir gastos', 'Mis rendiciones'])
  })

  it('si la sesión se cierra, vuelve al ingreso', async () => {
    await montarComo('solicitante', '/rendir')
    useAuthStore().session = null
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('ingresar')
  })
})

describe('App: pestañas y permisos', () => {
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
    useAuthStore().persona!.rol = 'tesorero'
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/rendir')
  })

  it('una ruta desconocida lleva a Rendir gastos', async () => {
    await montarComo('solicitante', '/no-existe')
    expect(router.currentRoute.value.path).toBe('/rendir')
  })
})

describe('mensajeErrorIngreso', () => {
  it('traduce los errores de Supabase Auth', () => {
    expect(
      mensajeErrorIngreso({
        message: 'Tu correo no está habilitado. Pide a tesorería que te agregue.',
      }),
    ).toContain('no está habilitado')
    expect(mensajeErrorIngreso({ status: 429, message: 'Email rate limit exceeded' })).toContain(
      'demasiados códigos',
    )
    expect(mensajeErrorIngreso({ message: 'Token has expired or is invalid' })).toContain('venció')
    expect(mensajeErrorIngreso(null)).toContain('No se pudo completar')
  })
})
