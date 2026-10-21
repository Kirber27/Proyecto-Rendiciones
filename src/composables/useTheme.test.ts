import { beforeEach, describe, expect, it } from 'vitest'
import { CLAVE_TEMA, resolverTema, useTheme } from '@/composables/useTheme'

describe('resolverTema', () => {
  it('respeta la elección explícita', () => {
    expect(resolverTema('claro', true)).toBe('light')
    expect(resolverTema('oscuro', false)).toBe('dark')
  })
  it('sigue al sistema por defecto', () => {
    expect(resolverTema('sistema', true)).toBe('dark')
    expect(resolverTema('sistema', false)).toBe('light')
  })
})

describe('useTheme', () => {
  beforeEach(() => localStorage.clear())

  it('aplica data-bs-theme y recuerda la elección', () => {
    const { elegir, preferencia } = useTheme()
    elegir('oscuro')
    expect(document.documentElement.dataset.bsTheme).toBe('dark')
    expect(localStorage.getItem(CLAVE_TEMA)).toBe('oscuro')
    elegir('sistema')
    expect(preferencia.value).toBe('sistema')
    expect(localStorage.getItem(CLAVE_TEMA)).toBeNull()
  })

  it('rota sistema → claro → oscuro → sistema', () => {
    const { elegir, siguiente, preferencia } = useTheme()
    elegir('sistema')
    siguiente()
    expect(preferencia.value).toBe('claro')
    siguiente()
    expect(preferencia.value).toBe('oscuro')
    siguiente()
    expect(preferencia.value).toBe('sistema')
  })
})
