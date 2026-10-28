import { describe, expect, it } from 'vitest'
import { dvRut, formatearRut, normalizarRut, rutValido } from '../rut'

// RUT ficticios (calculados con el módulo 11).
describe('dvRut', () => {
  it.each([
    ['12345678', '5'],
    ['11111111', '1'],
    ['76000000', '0'],
    ['10000013', 'K'],
    ['1000000', '9'],
  ])('%s → %s', (cuerpo, dv) => {
    expect(dvRut(cuerpo)).toBe(dv)
  })
})

describe('normalizarRut', () => {
  it.each([
    ['12.345.678-5', '12345678-5'],
    ['123456785', '12345678-5'],
    [' 10.000.013-k ', '10000013-K'],
    ['1.000.000-9', '1000000-9'],
    ['012345678-5', '12345678-5'],
  ])('%s → %s', (v, esperado) => {
    expect(normalizarRut(v)).toBe(esperado)
  })
  it.each(['', '5', 'abc', '123456789012', null, undefined])('sin forma de RUT (%s) → ""', (v) => {
    expect(normalizarRut(v)).toBe('')
  })
})

describe('rutValido', () => {
  it('acepta RUT con DV correcto, escritos de cualquier forma', () => {
    expect(rutValido('12.345.678-5')).toBe(true)
    expect(rutValido('10000013k')).toBe(true)
    expect(rutValido('76.000.000-0')).toBe(true)
  })
  it('rechaza DV incorrecto o texto sin forma de RUT', () => {
    expect(rutValido('12.345.678-4')).toBe(false)
    expect(rutValido('10000013-0')).toBe(false)
    expect(rutValido('')).toBe(false)
    expect(rutValido('sin rut')).toBe(false)
  })
})

describe('formatearRut', () => {
  it('pone puntos de miles y guion', () => {
    expect(formatearRut('12345678-5')).toBe('12.345.678-5')
    expect(formatearRut('1000000-9')).toBe('1.000.000-9')
    expect(formatearRut('10000013k')).toBe('10.000.013-K')
    expect(formatearRut('999-3')).toBe('999-3')
  })
  it('si no tiene forma de RUT lo deja como está', () => {
    expect(formatearRut(' S/N ')).toBe('S/N')
    expect(formatearRut(null)).toBe('')
  })
})
