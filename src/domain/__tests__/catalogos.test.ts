import { describe, expect, it } from 'vitest'
import { catalogosDemo } from '@/dev/catalogosDemo'
import { centroCostoDeEmpresa, cuentaSugerida } from '../catalogos'

describe('catálogos', () => {
  it('cuenta sugerida por subcuenta', () => {
    expect(cuentaSugerida(40, catalogosDemo.subcuentas)).toBe(9)
    expect(cuentaSugerida(41, catalogosDemo.subcuentas)).toBeNull()
    expect(cuentaSugerida(null, catalogosDemo.subcuentas)).toBeNull()
    expect(cuentaSugerida(999, catalogosDemo.subcuentas)).toBeNull()
  })
  it('C.C. por empresa', () => {
    expect(centroCostoDeEmpresa(2, catalogosDemo.empresas)).toBe(3)
    expect(centroCostoDeEmpresa(4, catalogosDemo.empresas)).toBeNull()
    expect(centroCostoDeEmpresa(null, catalogosDemo.empresas)).toBeNull()
  })
})
