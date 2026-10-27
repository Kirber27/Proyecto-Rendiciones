import type { Session } from '@supabase/supabase-js'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const replace = vi.hoisted(() => vi.fn())
vi.mock('vue-router', () => ({ useRouter: () => ({ replace }) }))

const { default: CambiarClaveView } = await import('./CambiarClaveView.vue')
const { useAuthStore } = await import('@/stores/auth')

function montar(claveTemporal: boolean) {
  const auth = useAuthStore()
  auth.session = {
    user: { id: 'u-1', email: 'juana@ejemplo.cl', user_metadata: { debe_cambiar_clave: claveTemporal } },
  } as unknown as Session
  const cambiar = vi.spyOn(auth, 'cambiarClave').mockResolvedValue()
  const w = mount(CambiarClaveView, {
    global: { stubs: { RouterLink: { template: '<a class="volver"><slot /></a>' } } },
  })
  return { w, cambiar }
}

async function guardar(w: ReturnType<typeof mount>, campos: Record<string, string>) {
  for (const [id, valor] of Object.entries(campos)) await w.find(`#${id}`).setValue(valor)
  await w.find('form').trigger('submit')
  await flushPromises()
}

beforeEach(() => {
  setActivePinia(createPinia())
  replace.mockReset()
})

describe('CambiarClaveView', () => {
  it('con contraseña temporal: no pide la actual y al guardar entra a la app', async () => {
    const { w, cambiar } = montar(true)
    expect(w.find('h1').text()).toBe('Elige tu contraseña')
    expect(w.find('#clave-actual').exists()).toBe(false)
    expect(w.find('.volver').exists()).toBe(false)
    await guardar(w, { 'clave-nueva': 'gato-azul-9', 'clave-repetida': 'gato-azul-9' })
    expect(cambiar).toHaveBeenCalledWith('gato-azul-9', undefined)
    expect(replace).toHaveBeenCalledWith('/')
  })

  it('voluntario: pide la actual, muestra los problemas juntos y no llama', async () => {
    const { w, cambiar } = montar(false)
    expect(w.find('h1').text()).toBe('Cambiar contraseña')
    await guardar(w, { 'clave-nueva': 'corta', 'clave-repetida': 'otra' })
    const problemas = w.findAll('[role="alert"] li').map((li) => li.text())
    expect(problemas).toEqual([
      'Escribe tu contraseña actual.',
      'La contraseña nueva debe tener al menos 8 caracteres.',
      'Las contraseñas nuevas no coinciden.',
    ])
    expect(cambiar).not.toHaveBeenCalled()
  })

  it('voluntario: guarda, avisa y limpia los campos; muestra el error del servidor', async () => {
    const { w, cambiar } = montar(false)
    await guardar(w, {
      'clave-actual': 'clave-vieja',
      'clave-nueva': 'gato-azul-9',
      'clave-repetida': 'gato-azul-9',
    })
    expect(cambiar).toHaveBeenCalledWith('gato-azul-9', 'clave-vieja')
    expect(w.find('[role="status"]').text()).toContain('Contraseña cambiada')
    expect((w.find('#clave-nueva').element as HTMLInputElement).value).toBe('')
    expect(replace).not.toHaveBeenCalled()

    cambiar.mockRejectedValueOnce(new Error('La contraseña actual no es correcta.'))
    await guardar(w, {
      'clave-actual': 'mala-mala',
      'clave-nueva': 'gato-azul-9',
      'clave-repetida': 'gato-azul-9',
    })
    expect(w.find('[role="alert"]').text()).toBe('La contraseña actual no es correcta.')
  })
})
