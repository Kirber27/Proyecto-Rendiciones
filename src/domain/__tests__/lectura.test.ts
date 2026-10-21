import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  construirPrompt,
  ErrorLectura,
  extraerRespuesta,
  RespuestaLecturaSchema,
} from '@shared/lectura'
import { catalogosDemo } from '@/dev/catalogosDemo'
import { aBorrador, mensajeErrorLectura, montoATexto } from '../lectura'

const listas = {
  subcuentas: ['Bencina', 'Otros  ', 'Instituto Salud Publica (CDA)'],
  solicitantes: ['Juana Pérez ', 'Mario Soto'],
  empresas: ['Heca Global SPA', 'Hecaglobal Instruments SPA'],
}

describe('construirPrompt', () => {
  it('incluye las listas (sin espacios sobrantes) y la nota de imágenes', () => {
    const p = construirPrompt(listas, 'Cómo vienen las imágenes:\nImagen 1: foto 1 completa.')
    expect(p).toContain('Bencina | Otros | Instituto Salud Publica (CDA)')
    expect(p).toContain('Juana Pérez | Mario Soto')
    expect(p).toContain('una de: Heca Global SPA | Hecaglobal Instruments SPA.')
    expect(p).toContain('Imagen 1: foto 1 completa.')
    expect(p).toContain('Responde SOLO con un JSON')
  })

  // Paridad con buildPrompt() del prototipo, leído desde el archivo original.
  const ruta = 'CLAUDE/app/rendiciones-heca.html'
  it.skipIf(!existsSync(ruta))('es idéntico al prompt del prototipo', () => {
    const html = readFileSync(ruta, 'utf8')
    const m = html.match(/function buildPrompt\(tileNote=""\)\{\n {2}return `([\s\S]*?)`;\n\}/)
    expect(m).not.toBeNull()
    const nota = 'Cómo vienen las imágenes:\nImagen 1: foto 1 completa.'
    const tr = (s: string) => s.replace(/\s+/g, ' ').trim()
    const original = m![1]!
      .replace('${tileNote}', nota)
      .replace('${LISTS.sub.map(tr).join(" | ")}', listas.subcuentas.map(tr).join(' | '))
      .replace('${SOL().map(tr).join(" | ")}', listas.solicitantes.map(tr).join(' | '))
      .replace('${EMP.map(e=>e[0]).join(" | ")}', listas.empresas.join(' | '))
    expect(original).not.toContain('${')
    expect(construirPrompt(listas, nota)).toBe(original)
  })
})

describe('extraerRespuesta', () => {
  it('acepta JSON con cercas ``` y texto alrededor', () => {
    const r = extraerRespuesta('Aquí va:\n```json\n{"nro": 42, "lineas": []}\n```\nListo.')
    expect(r.nro).toBe(42)
    expect(r.lineas).toEqual([])
    expect(r.dudas).toEqual([])
  })
  it('tolera null y números como texto', () => {
    const r = extraerRespuesta(
      '{"solicitante": null, "nro": "42", "totalFormulario": "70.389", "dudas": ["a", 3]}',
    )
    expect(r.solicitante).toBe('')
    expect(r.nro).toBe('42')
    expect(r.dudas).toEqual(['a', '3'])
  })
  it('sin JSON válido lanza invalid_json', () => {
    for (const salida of ['no pude leer la foto', '{"nro": 42,', '{"lineas": "x"}']) {
      try {
        extraerRespuesta(salida)
        expect.unreachable()
      } catch (e) {
        expect(e).toBeInstanceOf(ErrorLectura)
        expect((e as ErrorLectura).codigo).toBe('invalid_json')
      }
    }
  })
})

describe('montoATexto', () => {
  it.each([
    [70389, '70.389'],
    ['70.389', '70.389'],
    [0, ''],
    [null, ''],
    [1234.5, '1234,5'],
    [-500, '-500'],
  ])('%j → %j', (v, esperado) => expect(montoATexto(v)).toBe(esperado))
})

const parsear = (o: unknown) => RespuestaLecturaSchema.parse(o)
const ctx = { catalogos: catalogosDemo, hoy: '2026-10-21' }

describe('aBorrador', () => {
  it('con formulario: arma el borrador con ids (caso DHE-042)', () => {
    const d = aBorrador(
      parsear({
        documentos: [{ foto: 1, tipo: 'Boleta', proveedor: 'ISP', numero: '2026101400444231' }],
        solicitante: 'Juana Pérez',
        nro: 42,
        fecha: '2026-10-14',
        empresa: 'Hecaglobal Instruments SPA',
        fondo: 'FONDOS POR RENDIR CDA',
        totalFormulario: 70389,
        lineas: [
          {
            fecha: '2026-10-14',
            tipo: 'Boleta',
            proveedor: 'ISP',
            rut: '',
            numero: '2026101400444231',
            neto: 0,
            iva: 0,
            exento: 70389,
            detalle: 'CDA IMP ADEOR 07',
            subcuenta: 'Instituto Salud Publica (CDA)',
          },
        ],
        dudas: [],
      }),
      ctx,
    )
    expect(d).toMatchObject({
      personaId: 'p-1',
      nro: '42',
      fecha: '2026-10-14',
      empresaId: 2,
      fondo: 'FONDOS POR RENDIR CDA',
      totalFormulario: '70.389',
      documentosLeidos: 1,
      dudas: [],
    })
    expect(d.lineas).toHaveLength(1)
    expect(d.lineas[0]).toMatchObject({
      tipo: 'Boleta',
      exento: '70.389',
      neto: '',
      subcuentaId: 40,
      cuentaId: 9, // sugerida para Instituto Salud Publica (CDA)
      centroCostoId: 3, // HGI. de la empresa
    })
  })

  it('sin formulario: solicitante desconocido, empresa por defecto y fechas', () => {
    const d = aBorrador(
      parsear({
        documentos: [{}, {}],
        solicitante: 'Pedro Desconocido',
        fecha: '14/10/26',
        empresa: 'Otra Empresa',
        lineas: [
          { tipo: 'boleta', proveedor: ' COPEC ', exento: '15.000', subcuenta: 'bencina' },
          { tipo: 'FACTURA', fecha: '2026-10-10', neto: 10000, iva: 1900, subcuenta: 'Peaje' },
        ],
      }),
      ctx,
    )
    expect(d.personaId).toBeNull()
    expect(d.dudas).toContain(
      'El solicitante leído ("Pedro Desconocido") no está en la lista: elígelo antes de enviar.',
    )
    expect(d.empresaId).toBe(2) // Hecaglobal Instruments SPA por defecto
    expect(d.fecha).toBe('2026-10-14')
    expect(d.documentosLeidos).toBe(2)
    expect(d.lineas[0]).toMatchObject({
      tipo: 'Boleta',
      proveedor: 'COPEC',
      fecha: '2026-10-14', // hereda la del formulario
      exento: '15.000',
      subcuentaId: 8,
      cuentaId: 2,
    })
    expect(d.lineas[1]).toMatchObject({
      tipo: 'Factura',
      fecha: '2026-10-10',
      neto: '10.000',
      iva: '1.900',
      subcuentaId: null, // "Peaje" no está en la lista
      cuentaId: null,
    })
  })

  it('persona fija: ignora el solicitante leído', () => {
    const d = aBorrador(parsear({ solicitante: 'Mario Soto', lineas: [] }), {
      ...ctx,
      personaFija: 'p-3',
    })
    expect(d.personaId).toBe('p-3')
    expect(d.dudas).toEqual([])
  })

  it('respuesta vacía: fecha de hoy, una línea vacía y aviso de solicitante', () => {
    const d = aBorrador(parsear({}), ctx)
    expect(d.fecha).toBe('2026-10-21')
    expect(d.nro).toBe('')
    expect(d.totalFormulario).toBe('')
    expect(d.lineas).toHaveLength(1)
    expect(d.lineas[0]!.fecha).toBe('2026-10-21')
    expect(d.documentosLeidos).toBeUndefined()
    expect(d.dudas).toEqual(['No se pudo leer el solicitante: elígelo antes de enviar.'])
  })

  it('limpia el Nº y el número de documento', () => {
    const d = aBorrador(
      parsear({ nro: 'Nº 042', lineas: [{ numero: 'B-00 12/3 ¿?', exento: 1000 }] }),
      ctx,
    )
    expect(d.nro).toBe('042')
    expect(d.lineas[0]!.numero).toBe('B-0012/3')
  })

  it('conserva id y respaldos al volver a leer', () => {
    const d = aBorrador(parsear({}), { ...ctx, id: 'r-1', respaldos: ['a/b.jpg'] })
    expect(d.id).toBe('r-1')
    expect(d.respaldos).toEqual(['a/b.jpg'])
  })
})

describe('mensajeErrorLectura', () => {
  it('tiene un mensaje en español para cada código', () => {
    expect(mensajeErrorLectura('cancelled')).toEqual({ tipo: 'info', texto: 'Lectura detenida.' })
    expect(mensajeErrorLectura('invalid_json').texto).toContain('fotos más nítidas')
    expect(mensajeErrorLectura('rate_limited').tipo).toBe('warning')
    expect(mensajeErrorLectura('cualquier cosa').texto).toBe(
      'No se pudo leer la rendición. Intenta de nuevo.',
    )
  })
})
