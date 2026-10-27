import { describe, expect, it } from 'vitest'
import { puedeEntrar } from './permisos'

describe('puedeEntrar', () => {
  it("'*' o sin roles: cualquiera", () => {
    expect(puedeEntrar('*', 'solicitante')).toBe(true)
    expect(puedeEntrar(undefined, 'solicitante')).toBe(true)
  })
  it('respeta la lista de roles', () => {
    expect(puedeEntrar(['tesorero', 'administrador'], 'tesorero')).toBe(true)
    expect(puedeEntrar(['tesorero', 'administrador'], 'solicitante')).toBe(false)
    expect(puedeEntrar(['administrador'], 'tesorero')).toBe(false)
  })
})
