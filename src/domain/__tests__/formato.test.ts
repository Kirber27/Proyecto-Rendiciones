import { describe, expect, it } from 'vitest'
import {
  clp,
  dnum,
  fdate,
  iso,
  mes,
  miles,
  norm,
  num,
  parseDate,
  raw,
  semana,
  tr,
} from '../formato'

describe('norm / tr / raw', () => {
  it('norm quita tildes, baja a minúsculas y colapsa espacios', () => {
    expect(norm('  Rodrigo  Ibañez ')).toBe('rodrigo ibanez')
    expect(norm('Alvaro Martínez')).toBe('alvaro martinez')
    expect(norm(null)).toBe('')
  })
  it('tr colapsa espacios pero conserva tildes', () => {
    expect(tr('Ana Jocelyn  Schnell ')).toBe('Ana Jocelyn Schnell')
  })
  it('raw devuelve la grafía exacta de la lista (con espacios finales)', () => {
    const lista = ['David Herce ', 'Otros  ', 'Bencina'] as const
    expect(raw(lista, 'david herce')).toBe('David Herce ')
    expect(raw(lista, 'OTROS')).toBe('Otros  ')
    expect(raw(lista, 'Peaje')).toBeNull()
    expect(raw(lista, '')).toBeNull()
  })
})

describe('num', () => {
  it.each([
    ['70.389', 70389],
    ['$ 70.389', 70389],
    ['1.234,50', 1234.5],
    ['12,5', 12.5],
    ['1.234.567', 1234567],
    ['-1.000', -1000],
    ['', 0],
    ['abc', 0],
    [70389, 70389],
    [195092.5, 195092.5],
    [null, 0],
  ])('num(%j) = %j', (entrada, esperado) => {
    expect(num(entrada)).toBe(esperado)
  })
})

describe('miles / clp', () => {
  it('agrupa miles con punto también en números de 4 dígitos', () => {
    expect(miles(1234)).toBe('1.234')
    expect(miles(999)).toBe('999')
    expect(miles(45024174)).toBe('45.024.174')
  })
  it('formatea pesos', () => {
    expect(clp(70389)).toBe('$ 70.389')
    expect(clp(-500)).toBe('-$ 500')
    expect(clp(-471991)).toBe('-$ 471.991')
    expect(clp(0)).toBe('$ 0')
    expect(clp(null)).toBe('$ 0')
    expect(clp(195092.5)).toBe('$ 195.093')
    expect(clp(-0.4)).toBe('$ 0')
  })
})

describe('fechas', () => {
  it('parseDate acepta los formatos del formulario, Excel y la cartola', () => {
    expect(parseDate('2026-10-14')).toBe('2026-10-14')
    expect(parseDate('2026-1-5')).toBe('2026-01-05')
    expect(parseDate('14-10-2026')).toBe('2026-10-14')
    expect(parseDate('14/10/26')).toBe('2026-10-14')
    expect(parseDate('5.3.2026')).toBe('2026-03-05')
    expect(parseDate(46000)).toBe('2025-12-09')
    expect(parseDate(new Date(2026, 9, 14))).toBe('2026-10-14')
    expect(parseDate('')).toBe('')
    expect(parseDate('mañana')).toBe('')
    expect(parseDate(new Date('x'))).toBe('')
  })
  it('fdate muestra DD-MM-YYYY', () => {
    expect(fdate('2026-10-14')).toBe('14-10-2026')
    expect(fdate('2026-10-14T13:00:00Z')).toBe('14-10-2026')
    expect(fdate(null)).toBe('')
  })
  it('iso usa la fecha local', () => {
    expect(iso(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
  it('dnum permite restar fechas en días', () => {
    expect(dnum('2026-10-14') - dnum('2026-10-09')).toBe(5)
    expect(dnum('')).toBe(0)
  })
  it('semana: lunes a viernes de esa semana', () => {
    expect(semana('2026-10-07')).toBe('Del 05 al 09') // miércoles
    expect(semana('2026-10-05')).toBe('Del 05 al 09') // lunes
    expect(semana('2026-10-11')).toBe('Del 05 al 09') // domingo
    expect(semana('2026-09-30')).toBe('Del 28 al 02') // cruza de mes
  })
  it('mes en minúsculas', () => {
    expect(mes('2026-10-07')).toBe('octubre')
    expect(mes('2026-01-31')).toBe('enero')
  })
})
