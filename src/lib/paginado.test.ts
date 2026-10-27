import { describe, expect, it, vi } from 'vitest'
import { traerTodo } from './paginado'

describe('traerTodo', () => {
  const tabla = Array.from({ length: 25 }, (_, i) => i)
  const consulta = vi.fn(async (desde: number, hasta: number) => ({
    data: tabla.slice(desde, hasta + 1),
    error: null,
  }))

  it('pide páginas hasta que una viene incompleta', async () => {
    expect(await traerTodo(consulta, 10)).toEqual(tabla)
    expect(consulta.mock.calls).toEqual([
      [0, 9],
      [10, 19],
      [20, 29],
    ])
  })

  it('si la última página viene llena, pide una más (vacía) y termina', async () => {
    consulta.mockClear()
    expect(await traerTodo(consulta, 5)).toHaveLength(25)
    expect(consulta).toHaveBeenCalledTimes(6)
  })

  it('propaga el error de Supabase', async () => {
    await expect(
      traerTodo(async () => ({ data: null, error: { message: 'permiso denegado' } })),
    ).rejects.toThrow('permiso denegado')
  })
})
