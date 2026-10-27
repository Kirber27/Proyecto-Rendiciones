import { existsSync, readFileSync } from 'node:fs'
import { PDFArray, PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { generarReportePdf, type CargarImagen, type CargarPdf } from '@/services/pdf'
import {
  modeloReporte,
  nombreArchivoReporte,
  type EntradaReporte,
  type LineaReporte,
} from '../reporte'

const linea = (c: Partial<LineaReporte>): LineaReporte => ({
  fecha: '2026-10-14',
  tipo: 'Boleta',
  proveedor: '',
  numero: '',
  neto: 0,
  iva: 0,
  exento: 0,
  otros: 0,
  detalle: '',
  subcuenta: '',
  ...c,
})

/** Caso documentado DHE-042 más una factura y una transferencia ficticias. */
function entrada(c: Partial<EntradaReporte> = {}): EntradaReporte {
  return {
    folio: 'DHE-042',
    solicitante: 'David Herce ',
    nro: 42,
    fecha: '2026-10-14',
    empresa: { nombre: 'Hecaglobal Instruments SPA', rut: '76886693-7' },
    fondo: 'Fondos por rendir CDA',
    totalFormulario: 70389,
    lineas: [
      linea({
        proveedor: 'ISP',
        numero: '2026101400444231',
        exento: 70389,
        detalle: 'CDA IMP ADEOR 07',
        subcuenta: 'Instituto Salud Publica (CDA)',
      }),
    ],
    estadoPago: { pagado: 0, saldo: 70389, estado: 'Pendiente de pago', ultimo: '' },
    pagos: [],
    aprobadoEn: '2026-10-16T14:00:00Z',
    origen: 'App',
    cantidadRespaldos: 1,
    hoy: '2026-10-21',
    ...c,
  }
}

describe('modeloReporte', () => {
  it('datos del formulario, título y nombre de archivo', () => {
    const m = modeloReporte(entrada())
    expect(m.titulo).toBe('FONDOS POR RENDIR CDA')
    expect(m.datos).toEqual([
      ['Fecha', '14-10-2026'],
      ['Empresa', 'Hecaglobal Instruments SPA  ·  RUT 76886693-7'],
      ['Nº rendición', '42'],
      ['Solicitante', 'David Herce'],
      ['ID interno', 'DHE-042'],
    ])
    expect(m.nombreArchivo).toBe('Rendicion_DHE-042_David_Herce.pdf')
  })

  it('filas de gastos con montos formateados', () => {
    const m = modeloReporte(entrada())
    expect(m.filas).toEqual([
      [
        '14-10-2026',
        'Boleta',
        'ISP',
        '2026101400444231',
        '',
        '',
        '$ 70.389',
        '$ 70.389',
        'Instituto Salud Publica (CDA) · CDA IMP ADEOR 07',
      ],
    ])
  })

  it('totales por tipo, total del formulario, pagado y saldo', () => {
    const m = modeloReporte(
      entrada({
        lineas: [
          linea({ tipo: 'Factura', neto: 10000, iva: 1900 }),
          linea({ exento: 5000 }),
          linea({ tipo: 'Transferencia', exento: 20000 }),
        ],
        totalFormulario: 36900,
        estadoPago: { pagado: 30000, saldo: 6900, estado: 'Pago parcial', ultimo: '2026-10-20' },
      }),
    )
    expect(m.totales.map((t) => [t.etiqueta, t.valor])).toEqual([
      ['Total compras facturas', '$ 11.900'],
      ['Total compras boletas / otros', '$ 5.000'],
      ['Transferencias realizadas', '$ 20.000'],
      ['TOTAL RENDICIÓN', '$ 36.900'],
      ['Total escrito en formulario', '$ 36.900'],
      ['Pagado', '$ 30.000'],
      ['Saldo por pagar', '$ 6.900'],
    ])
    expect(m.totales.find((t) => t.destacado)!.etiqueta).toBe('TOTAL RENDICIÓN')
  })

  it('sin total del formulario no lo muestra', () => {
    const m = modeloReporte(entrada({ totalFormulario: null }))
    expect(m.totales.map((t) => t.etiqueta)).not.toContain('Total escrito en formulario')
  })

  it('notas: estado, pagos, aprobación u origen, respaldos', () => {
    const conPagos = modeloReporte(
      entrada({
        estadoPago: { pagado: 70389, saldo: 0, estado: 'Pagada', ultimo: '2026-10-20' },
        pagos: [{ fecha: '2026-10-20', medioPago: 'Banco Internacional HGI ', monto: 70389 }],
      }),
    )
    expect(conPagos.notas).toEqual([
      'Estado de pago: Pagada (último pago 20-10-2026)',
      'Pagos vinculados: 20-10-2026 Banco Internacional HGI $ 70.389',
      'Aprobada por tesorería el 16-10-2026.',
      'Respaldos adjuntos: 1. Reporte generado el 21-10-2026.',
    ])
    const historica = modeloReporte(
      entrada({ aprobadoEn: null, origen: 'Histórico', cantidadRespaldos: 0 }),
    )
    expect(historica.notas).toEqual([
      'Estado de pago: Pendiente de pago',
      'Origen: Histórico.',
      'Respaldos adjuntos: 0. Reporte generado el 21-10-2026.',
    ])
  })

  it('nombre de archivo sin caracteres inválidos', () => {
    expect(nombreArchivoReporte('ABC-001-x7', ' Ana  Jocelyn  Schnell ')).toBe(
      'Rendicion_ABC-001-x7_Ana_Jocelyn_Schnell.pdf',
    )
    expect(nombreArchivoReporte('A/B', 'X:Y')).toBe('Rendicion_AB_XY.pdf')
  })
})

describe('generarReportePdf', () => {
  const paginas = (pdf: ArrayBuffer) =>
    (
      Buffer.from(pdf)
        .toString('latin1')
        .match(/\/Type \/Page\b/g) ?? []
    ).length
  const texto = (pdf: ArrayBuffer) => Buffer.from(pdf).toString('latin1')
  const img = (url: string) => ({ url, tipo: 'imagen' as const })
  const doc = (url: string) => ({ url, tipo: 'pdf' as const })
  const falla: CargarImagen = () => Promise.reject(new Error('x'))

  /** PDF ficticio de `n` páginas (media carta apaisada, para ver que se escala). */
  async function pdfDePrueba(n: number): Promise<ArrayBuffer> {
    const d = await PDFDocument.create()
    for (let i = 0; i < n; i++) d.addPage([792, 306]).drawText(`Boleta ${i + 1}`, { x: 40, y: 150 })
    const b = await d.save()
    return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer
  }
  /**
   * Índices (desde 1) de las páginas donde pdf-lib dibujó una página de un respaldo PDF: son las que
   * quedan con más de un flujo de contenido (jsPDF escribe uno por página; los recursos los comparte).
   */
  async function paginasConPdf(pdf: ArrayBuffer) {
    const final = await PDFDocument.load(pdf)
    return final.getPages().flatMap((p, i) => (p.node.Contents() instanceof PDFArray ? [i + 1] : []))
  }

  it('genera un PDF de una página sin fotos, con numeración', async () => {
    const pdf = await generarReportePdf(modeloReporte(entrada({ cantidadRespaldos: 0 })), [])
    expect(texto(pdf).startsWith('%PDF-')).toBe(true)
    expect(paginas(pdf)).toBe(1)
    expect(texto(pdf)).toContain('gina 1 de 1)')
  })

  it('muchas líneas pasan a otra página', async () => {
    const lineas = Array.from({ length: 60 }, (_, i) =>
      linea({ proveedor: `Proveedor ${i}`, exento: 1000 }),
    )
    const pdf = await generarReportePdf(modeloReporte(entrada({ lineas })), [])
    expect(paginas(pdf)).toBeGreaterThan(1)
  })

  it('una foto que no carga deja una página con el aviso', async () => {
    const avances: string[] = []
    const pdf = await generarReportePdf(modeloReporte(entrada()), [img('blob:1')], {
      cargarImagen: falla,
      onProgreso: (t) => avances.push(t),
    })
    expect(paginas(pdf)).toBe(2)
    expect(texto(pdf)).toContain('no se pudo cargar la imagen')
    expect(avances).toEqual(['Agregando respaldo 1 de 1…'])
  })

  const foto = 'CLAUDE/datos/original/ejemplo_formulario_DHE-042.jpg'
  it.skipIf(!existsSync(foto))('agrega una página por foto (foto de ejemplo DHE-042)', async () => {
    const jpg: CargarImagen = async () => ({
      datos: 'data:image/jpeg;base64,' + readFileSync(foto).toString('base64'),
      ancho: 1200,
      alto: 1600,
    })
    const pdf = await generarReportePdf(modeloReporte(entrada()), [img('a'), img('b')], {
      cargarImagen: jpg,
    })
    expect(paginas(pdf)).toBe(3)
    expect(texto(pdf)).toContain('/Subtype /Image')
    expect(texto(pdf)).toContain('Respaldo 2 de 2)')
  })

  it('un respaldo PDF de 2 páginas suma 2 páginas, en el orden de los respaldos, con numeración', async () => {
    const dosPaginas = await pdfDePrueba(2)
    const cargarPdf: CargarPdf = async () => dosPaginas
    const avances: string[] = []
    const pdf = await generarReportePdf(
      modeloReporte(entrada({ cantidadRespaldos: 2 })),
      [doc('blob:pdf'), img('blob:foto')],
      { cargarImagen: falla, cargarPdf, onProgreso: (t) => avances.push(t) },
    )
    expect((await PDFDocument.load(pdf)).getPageCount()).toBe(4) // resumen + 2 del PDF + foto
    expect(await paginasConPdf(pdf)).toEqual([2, 3])
    expect(texto(pdf)).toContain('Respaldo 1 de 2 \xb7 p\xe1g. 2 de 2')
    expect(texto(pdf)).toContain('gina 4 de 4)')
    expect(avances).toEqual(['Agregando respaldo 1 de 2…', 'Agregando respaldo 2 de 2…'])
  })

  it('un PDF que no se puede abrir deja una página con el aviso y sigue con el resto', async () => {
    const roto: CargarPdf = async () => new TextEncoder().encode('no es un pdf').buffer as ArrayBuffer
    const pdf = await generarReportePdf(modeloReporte(entrada()), [doc('blob:roto')], {
      cargarPdf: roto,
    })
    expect(paginas(pdf)).toBe(2)
    expect(texto(pdf)).toContain('no se pudo abrir el PDF')
  })

  it('sin respaldos PDF no carga pdf-lib ni descarga nada', async () => {
    let llamadas = 0
    const cargarPdf: CargarPdf = async () => {
      llamadas++
      return new ArrayBuffer(0)
    }
    await generarReportePdf(modeloReporte(entrada()), [img('blob:1')], { cargarImagen: falla, cargarPdf })
    expect(llamadas).toBe(0)
  })
})
