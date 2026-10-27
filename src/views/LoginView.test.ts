import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const replace = vi.hoisted(() => vi.fn())
const ruta = vi.hoisted(() => ({ query: {} as Record<string, string> }))
vi.mock('vue-router', () => ({ useRoute: () => ruta, useRouter: () => ({ replace }) }))

const { default: LoginView } = await import('./LoginView.vue')
const { useAuthStore } = await import('@/stores/auth')

beforeEach(() => {
  setActivePinia(createPinia())
  replace.mockReset()
  ruta.query = {}
})

async function completar(w: ReturnType<typeof mount>, correo: string, clave: string) {
  await w.find('#correo').setValue(correo)
  await w.find('#clave').setValue(clave)
  await w.find('form').trigger('submit')
  await flushPromises()
}

describe('LoginView', () => {
  it('pide correo y contraseña; no ofrece código ni crear cuenta', () => {
    const w = mount(LoginView)
    expect(w.find('#correo').exists()).toBe(true)
    expect(w.find('#clave').attributes('type')).toBe('password')
    expect(w.text()).not.toMatch(/código|Crear cuenta/i)
  })

  it('entra y vuelve a donde iba', async () => {
    ruta.query = { volver: '/mis' }
    const auth = useAuthStore()
    const entrar = vi.spyOn(auth, 'entrar').mockResolvedValue()
    const w = mount(LoginView)
    await completar(w, 'juana@ejemplo.cl', 'gato-azul-9')
    expect(entrar).toHaveBeenCalledWith('juana@ejemplo.cl', 'gato-azul-9')
    expect(replace).toHaveBeenCalledWith('/mis')
  })

  it('valida antes de llamar y muestra el error del ingreso', async () => {
    const auth = useAuthStore()
    const entrar = vi
      .spyOn(auth, 'entrar')
      .mockRejectedValue(new Error('Correo o contraseña incorrectos.'))
    const w = mount(LoginView)
    await completar(w, 'juana@ejemplo.cl', '')
    expect(w.find('[role="alert"]').text()).toBe('Escribe tu correo y tu contraseña.')
    await completar(w, 'juana', 'x')
    expect(w.find('[role="alert"]').text()).toBe('Escribe un correo válido.')
    expect(entrar).not.toHaveBeenCalled()
    await completar(w, 'juana@ejemplo.cl', 'mala')
    expect(w.find('[role="alert"]').text()).toBe('Correo o contraseña incorrectos.')
    expect(replace).not.toHaveBeenCalled()
  })

  it('mostrar contraseña y "¿Olvidaste tu contraseña?"', async () => {
    const w = mount(LoginView)
    await w.find('button[aria-label="Mostrar contraseña"]').trigger('click')
    expect(w.find('#clave').attributes('type')).toBe('text')
    expect(w.find('#ayuda-clave').exists()).toBe(false)
    const olvido = w.findAll('button').find((b) => b.text() === '¿Olvidaste tu contraseña?')!
    await olvido.trigger('click')
    expect(w.find('#ayuda-clave').text()).toContain('administrador')
    expect(w.find('#ayuda-clave').text()).toContain('no llega por correo')
  })
})
