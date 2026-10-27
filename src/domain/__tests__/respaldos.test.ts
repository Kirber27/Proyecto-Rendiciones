import { describe, expect, it } from 'vitest'
import { escalaPara, revisarArchivos, TAMANO_MAXIMO, tipoArchivo, tipoRespaldo } from '../respaldos'

const archivo = (name: string, type: string, size = 1000) => ({ name, type, size })

describe('escalaPara', () => {
  it('reduce al lado máximo y nunca agranda', () => {
    expect(escalaPara(4800, 3600)).toBe(0.5)
    expect(escalaPara(1200, 1600)).toBe(1)
    expect(escalaPara(3000, 1000, 1500)).toBe(0.5)
  })
})

describe('tipoRespaldo', () => {
  it.each([
    ['application/pdf', 'pdf'],
    ['p-1/r-1/abc.pdf', 'pdf'],
    ['BOLETA.PDF', 'pdf'],
    ['image/jpeg', 'imagen'],
    ['p-1/r-1/abc.jpg', 'imagen'],
  ])('%s → %s', (v, esperado) => expect(tipoRespaldo(v)).toBe(esperado))
})

describe('tipoArchivo', () => {
  it('imágenes y PDF; un PDF sin mime se reconoce por el nombre', () => {
    expect(tipoArchivo(archivo('a.heic', 'image/heic'))).toBe('imagen')
    expect(tipoArchivo(archivo('b.pdf', 'application/pdf'))).toBe('pdf')
    expect(tipoArchivo(archivo('c.pdf', ''))).toBe('pdf')
    expect(tipoArchivo(archivo('d.docx', 'application/msword'))).toBeNull()
    expect(tipoArchivo(archivo('e', ''))).toBeNull()
  })
})

describe('revisarArchivos', () => {
  it('acepta imágenes y PDF sin aviso', () => {
    const r = revisarArchivos([archivo('a.jpg', 'image/jpeg'), archivo('b.pdf', 'application/pdf')])
    expect(r.aceptados.map((f) => f.name)).toEqual(['a.jpg', 'b.pdf'])
    expect(r.aviso).toBe('')
  })

  it('descarta lo que no es imagen ni PDF', () => {
    const uno = revisarArchivos([archivo('a.jpg', 'image/jpeg'), archivo('x.docx', 'application/msword')])
    expect(uno.aceptados).toHaveLength(1)
    expect(uno.aviso).toBe('«x.docx» no es imagen ni PDF y no se agregó.')
    const dos = revisarArchivos([archivo('x.docx', 'a/b'), archivo('y.zip', 'a/c')])
    expect(dos.aviso).toBe('2 archivos no son imágenes ni PDF y no se agregaron.')
  })

  it('descarta los PDF de más de 10 MB (las fotos se reducen al subir)', () => {
    const r = revisarArchivos([
      archivo('grande.pdf', 'application/pdf', TAMANO_MAXIMO + 1),
      archivo('justo.pdf', 'application/pdf', TAMANO_MAXIMO),
      archivo('foto.jpg', 'image/jpeg', TAMANO_MAXIMO * 2),
    ])
    expect(r.aceptados.map((f) => f.name)).toEqual(['justo.pdf', 'foto.jpg'])
    expect(r.aviso).toBe('«grande.pdf» pesa más de 10 MB y no se agregó: comprímelo o sube una foto.')
  })

  it('junta los dos avisos', () => {
    const r = revisarArchivos([
      archivo('x.docx', 'a/b'),
      archivo('g1.pdf', 'application/pdf', TAMANO_MAXIMO + 1),
      archivo('g2.pdf', 'application/pdf', TAMANO_MAXIMO + 1),
    ])
    expect(r.aceptados).toEqual([])
    expect(r.aviso).toBe(
      '«x.docx» no es imagen ni PDF y no se agregó. 2 PDF pesan más de 10 MB y no se agregaron: comprímelos o sube fotos.',
    )
  })
})
