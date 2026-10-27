import { describe, expect, it } from 'vitest'
import { validarCambioClave } from '../acceso'

describe('validarCambioClave', () => {
  it('con contraseña temporal no pide la actual', () => {
    expect(
      validarCambioClave({ nueva: 'gato-azul-9', repetida: 'gato-azul-9', pideActual: false }),
    ).toEqual([])
  })

  it('el cambio voluntario pide la actual y que la nueva sea distinta', () => {
    expect(
      validarCambioClave({ nueva: 'gato-azul-9', repetida: 'gato-azul-9', pideActual: true }),
    ).toEqual(['Escribe tu contraseña actual.'])
    expect(
      validarCambioClave({
        actual: 'gato-azul-9',
        nueva: 'gato-azul-9',
        repetida: 'gato-azul-9',
        pideActual: true,
      }),
    ).toEqual(['La contraseña nueva debe ser distinta de la actual.'])
    expect(
      validarCambioClave({
        actual: 'clave-vieja',
        nueva: 'gato-azul-9',
        repetida: 'gato-azul-9',
        pideActual: true,
      }),
    ).toEqual([])
  })

  it('largo mínimo 8 y repetir igual, todos los problemas juntos', () => {
    expect(validarCambioClave({ nueva: '1234567', repetida: '123', pideActual: true })).toEqual([
      'Escribe tu contraseña actual.',
      'La contraseña nueva debe tener al menos 8 caracteres.',
      'Las contraseñas nuevas no coinciden.',
    ])
    expect(validarCambioClave({ nueva: '12345678', repetida: '12345678', pideActual: false })).toEqual(
      [],
    )
  })
})
