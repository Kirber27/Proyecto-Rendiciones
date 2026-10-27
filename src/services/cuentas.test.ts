import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const invoke = vi.hoisted(() => vi.fn())
vi.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke } } }))
const { crearCuenta, nuevaClave } = await import('./cuentas')

const respuesta = (status: number, cuerpo: unknown) =>
  new FunctionsHttpError(new Response(JSON.stringify(cuerpo), { status }))

beforeEach(() => invoke.mockReset())

describe('services/cuentas', () => {
  it('crear y restablecer llaman a la función y devuelven la contraseña temporal', async () => {
    invoke.mockResolvedValue({ data: { clave: 'K7QM-4XPR-2HTW' }, error: null })
    expect(await crearCuenta('p-1')).toBe('K7QM-4XPR-2HTW')
    expect(invoke).toHaveBeenLastCalledWith('cuentas', {
      body: { accion: 'crear', personaId: 'p-1' },
    })
    await nuevaClave('p-2')
    expect(invoke).toHaveBeenLastCalledWith('cuentas', {
      body: { accion: 'restablecer', personaId: 'p-2' },
    })
  })

  it('muestra el mensaje en español que manda la función', async () => {
    invoke.mockResolvedValue({
      data: null,
      error: respuesta(403, { message: 'Solo un administrador puede crear cuentas o asignar contraseñas.' }),
    })
    await expect(crearCuenta('p-1')).rejects.toThrow('Solo un administrador')
  })

  it('sin respuesta de la función: problema de conexión', async () => {
    invoke.mockResolvedValue({ data: null, error: new FunctionsFetchError('fetch failed') })
    await expect(nuevaClave('p-1')).rejects.toThrow('Revisa tu conexión')
    invoke.mockResolvedValue({ data: {}, error: null })
    await expect(nuevaClave('p-1')).rejects.toThrow('Respuesta inesperada')
  })
})
