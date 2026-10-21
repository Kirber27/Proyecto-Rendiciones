import { describe, expect, it } from 'vitest'
import {
  cajasRecorte,
  escalaPara,
  notaImagenes,
  recortesPorFoto,
  separarImagenes,
} from '../recortes'

describe('recortesPorFoto (cupo de 20 imágenes)', () => {
  it.each([
    [1, 4],
    [4, 4], // 4×5 = 20
    [5, 2], // 5×3 = 15
    [6, 2], // 6×3 = 18
    [7, 0], // 7×3 = 21 > 20
    [20, 0],
  ])('%i foto(s) → %i recortes c/u', (n, esperado) => {
    expect(recortesPorFoto(n, 20)).toBe(esperado)
  })
})

describe('cajasRecorte', () => {
  it('4 cuadrantes de 55% que se traslapan', () => {
    expect(cajasRecorte(1000, 2000, 4)).toEqual([
      [0, 0, 550, 1100],
      [450, 0, 550, 1100],
      [0, 900, 550, 1100],
      [450, 900, 550, 1100],
    ])
  })
  it('2 mitades: izquierda/derecha si es apaisada', () => {
    expect(cajasRecorte(2000, 1000, 2)).toEqual([
      [0, 0, 1100, 1000],
      [900, 0, 1100, 1000],
    ])
  })
  it('2 mitades: arriba/abajo si es vertical', () => {
    expect(cajasRecorte(1000, 2000, 2)).toEqual([
      [0, 0, 1000, 1100],
      [0, 900, 1000, 1100],
    ])
  })
  it('sin cupo no hay recortes', () => {
    expect(cajasRecorte(1000, 2000, 0)).toEqual([])
  })
  it('cada caja queda dentro de la imagen', () => {
    for (const [x, y, w, h] of cajasRecorte(4032, 3024, 4)) {
      expect(x + w).toBeLessThanOrEqual(4032 + 1e-9)
      expect(y + h).toBeLessThanOrEqual(3024 + 1e-9)
    }
  })
})

describe('escalaPara', () => {
  it('reduce al lado máximo y nunca agranda', () => {
    expect(escalaPara(4800, 3600)).toBe(0.5)
    expect(escalaPara(1200, 1600)).toBe(1)
    expect(escalaPara(3000, 1000, 1500)).toBe(0.5)
  })
})

describe('notaImagenes', () => {
  it('explica qué es cada imagen, como en el prototipo', () => {
    const nota = notaImagenes([
      { foto: 1, tipo: 'completa' },
      { foto: 1, tipo: 'recorte' },
      { foto: 2, tipo: 'completa' },
    ])
    expect(nota.split('\n')).toEqual([
      'Cómo vienen las imágenes:',
      'Imagen 1: foto 1 completa.',
      'Imagen 2: acercamiento de una parte de la foto 1 (los recortes se traslapan; un documento que aparece en varios recortes o en la foto completa es UN solo documento).',
      'Imagen 3: foto 2 completa.',
    ])
  })
})

describe('separarImagenes', () => {
  it('descarta lo que no es imagen', () => {
    const r = separarImagenes([
      { type: 'image/jpeg' },
      { type: 'application/pdf' },
      { type: 'image/heic' },
    ])
    expect(r.imagenes).toHaveLength(2)
    expect(r.descartados).toBe(1)
  })
})
