import type { Session } from '@supabase/supabase-js'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const sb = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  updateUser: vi.fn(),
  maybeSingle: vi.fn(),
}))
vi.mock('@/lib/supabase', () => {
  const consulta = { select: () => consulta, eq: () => consulta, is: () => consulta }
  Object.assign(consulta, { maybeSingle: sb.maybeSingle })
  return {
    supabase: {
      auth: { signInWithPassword: sb.signInWithPassword, updateUser: sb.updateUser },
      from: () => consulta,
    },
  }
})

const { useAuthStore } = await import('./auth')

const usuario = (meta: Record<string, unknown> = {}) => ({
  id: 'u-1',
  email: 'juana@ejemplo.cl',
  user_metadata: meta,
})
const sesion = (meta: Record<string, unknown> = {}) =>
  ({ access_token: 't', user: usuario(meta) }) as unknown as Session

beforeEach(() => {
  setActivePinia(createPinia())
  Object.values(sb).forEach((f) => f.mockReset())
  sb.maybeSingle.mockResolvedValue({
    data: { id: 'p-1', nombre: 'Juana Pérez ', codigo: 'JPE', rol: 'solicitante' },
  })
})

describe('useAuthStore: contraseña', () => {
  it('entrar: correo en minúsculas y sin espacios; carga la persona', async () => {
    sb.signInWithPassword.mockResolvedValue({ data: { session: sesion() }, error: null })
    const auth = useAuthStore()
    await auth.entrar('  Juana@Ejemplo.CL ', 'gato-azul-9')
    expect(sb.signInWithPassword).toHaveBeenCalledWith({
      email: 'juana@ejemplo.cl',
      password: 'gato-azul-9',
    })
    expect(auth.conSesion).toBe(true)
    expect(auth.persona?.codigo).toBe('JPE')
  })

  it('entrar: credenciales malas → mensaje en español', async () => {
    sb.signInWithPassword.mockResolvedValue({
      data: { session: null },
      error: { code: 'invalid_credentials', message: 'Invalid login credentials', status: 400 },
    })
    await expect(useAuthStore().entrar('a@b.cl', 'x')).rejects.toThrow(
      'Correo o contraseña incorrectos.',
    )
  })

  it('debeCambiarClave sale de la marca de la cuenta', () => {
    const auth = useAuthStore()
    auth.session = sesion({ debe_cambiar_clave: true })
    expect(auth.debeCambiarClave).toBe(true)
    auth.session = sesion()
    expect(auth.debeCambiarClave).toBe(false)
  })

  it('con contraseña temporal: cambia sin pedir la actual y quita la marca', async () => {
    sb.updateUser.mockResolvedValue({ data: { user: usuario({ debe_cambiar_clave: false }) }, error: null })
    const auth = useAuthStore()
    auth.session = sesion({ debe_cambiar_clave: true })
    await auth.cambiarClave('gato-azul-9')
    expect(sb.signInWithPassword).not.toHaveBeenCalled()
    expect(sb.updateUser).toHaveBeenCalledWith({
      password: 'gato-azul-9',
      data: { debe_cambiar_clave: false },
    })
    expect(auth.debeCambiarClave).toBe(false)
  })

  it('cambio voluntario: verifica la actual antes de cambiar', async () => {
    const auth = useAuthStore()
    auth.session = sesion()
    sb.signInWithPassword.mockResolvedValueOnce({
      data: { session: null },
      error: { code: 'invalid_credentials', message: 'Invalid login credentials' },
    })
    await expect(auth.cambiarClave('gato-azul-9', 'mala')).rejects.toThrow(
      'La contraseña actual no es correcta.',
    )
    expect(sb.updateUser).not.toHaveBeenCalled()

    sb.signInWithPassword.mockResolvedValueOnce({ data: { session: sesion() }, error: null })
    sb.updateUser.mockResolvedValue({
      data: { user: null },
      error: { code: 'same_password', message: 'New password should be different' },
    })
    await expect(auth.cambiarClave('gato-azul-9', 'gato-azul-9')).rejects.toThrow(
      'distinta de la actual',
    )
    expect(sb.signInWithPassword).toHaveBeenLastCalledWith({
      email: 'juana@ejemplo.cl',
      password: 'gato-azul-9',
    })
  })

  it('sin sesión no intenta cambiar', async () => {
    await expect(useAuthStore().cambiarClave('gato-azul-9')).rejects.toThrow('sesión expiró')
    expect(sb.updateUser).not.toHaveBeenCalled()
  })
})
