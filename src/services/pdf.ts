// Dibujo del reporte PDF de una rendición con jsPDF (carta, mm). Porta el diseño de reportePDF().
// jsPDF y autotable se cargan solo al generar el reporte; pdf-lib, solo si hay respaldos PDF
// (sus páginas se dibujan dentro de páginas que jsPDF deja reservadas, ver spec 02 §Reporte).
import type { PDFDocument } from 'pdf-lib'
import type { ModeloReporte } from '@/domain/reporte'
import { escalaPara } from '@/domain/respaldos'
import { descargar } from '@/lib/descargar'
import type { TipoRespaldo } from '@/types/rendicion'

export interface ImagenPdf {
  /** data URL JPEG */
  datos: string
  ancho: number
  alto: number
}

export type CargarImagen = (src: string) => Promise<ImagenPdf>

/** Bytes de un respaldo PDF (URL firmada de Storage o blob:). */
export type CargarPdf = (src: string) => Promise<ArrayBuffer>

/** Respaldo que entra al reporte, en su orden. */
export interface RespaldoReporte {
  url: string
  tipo: TipoRespaldo
}

/** Lado máximo de las fotos de respaldo dentro del PDF (px). */
const LADO_FOTO = 1800

/** Carga una foto (URL firmada de Storage o blob:) y la deja como JPEG reducido. */
export const cargarImagenNavegador: CargarImagen = async (src) => {
  const img = new Image()
  img.crossOrigin = 'anonymous'
  await new Promise<void>((ok, error) => {
    img.onload = () => ok()
    img.onerror = () => error(new Error('No se pudo cargar la imagen'))
    img.src = src
  })
  const sc = escalaPara(img.naturalWidth, img.naturalHeight, LADO_FOTO)
  const c = document.createElement('canvas')
  c.width = Math.round(img.naturalWidth * sc)
  c.height = Math.round(img.naturalHeight * sc)
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
  return { datos: c.toDataURL('image/jpeg', 0.82), ancho: c.width, alto: c.height }
}

export const cargarPdfNavegador: CargarPdf = async (src) => {
  const r = await fetch(src)
  if (!r.ok) throw new Error(`No se pudo descargar el PDF (${r.status})`)
  return r.arrayBuffer()
}

export interface OpcionesPdf {
  cargarImagen?: CargarImagen
  cargarPdf?: CargarPdf
  /** Avisa el avance ("Agregando respaldo 2 de 3…"). */
  onProgreso?: (texto: string) => void
}

// Medidas de página carta en mm
const W = 215.9
const H = 279.4
const M = 14
/** Caja donde va cada respaldo (mm): debajo del encabezado "<folio> · Respaldo k de n". */
const CAJA = { x: M, y: 18, ancho: W - 2 * M, alto: H - 30 }
/** Puntos PDF por milímetro (pdf-lib trabaja en puntos y con el origen abajo). */
const PT = 72 / 25.4

/** Página reservada en jsPDF donde pdf-lib dibuja la página `indice` de un respaldo PDF. */
interface Reserva {
  pagina: number
  pdf: PDFDocument
  indice: number
}

/** Genera el PDF y devuelve sus bytes. */
export async function generarReportePdf(
  modelo: ModeloReporte,
  respaldos: readonly RespaldoReporte[],
  {
    cargarImagen = cargarImagenNavegador,
    cargarPdf = cargarPdfNavegador,
    onProgreso,
  }: OpcionesPdf = {},
): Promise<ArrayBuffer> {
  const [{ jsPDF }, { autoTable }, pdfLib] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
    respaldos.some((r) => r.tipo === 'pdf') ? import('pdf-lib') : null,
  ])
  const doc = new jsPDF({ unit: 'mm', format: 'letter' })

  const txt = (
    t: string,
    x: number,
    y: number,
    o: { b?: boolean; s?: number; a?: 'center' | 'right' } = {},
  ) => {
    doc.setFont('helvetica', o.b ? 'bold' : 'normal')
    doc.setFontSize(o.s ?? 9)
    doc.text(t, x, y, o.a ? { align: o.a } : undefined)
  }

  // Encabezado del formulario
  doc.setDrawColor(40)
  doc.rect(M, 10, W - 2 * M, 18)
  txt('heca', M + 4, 22, { b: true, s: 18 })
  txt('POE-GLO-FIN-003 V:01 PROCESO', W / 2 + 20, 17, { b: true, s: 9, a: 'center' })
  txt('RENDICIÓN DE GASTOS', W / 2 + 20, 24, { b: true, s: 11, a: 'center' })

  let y = 36
  txt(modelo.titulo, W / 2, y, { b: true, s: 10, a: 'center' })
  y += 6

  // Datos de la rendición
  for (const [etiqueta, valor] of modelo.datos) {
    doc.rect(M, y, 45, 6)
    doc.rect(M + 45, y, W - 2 * M - 45, 6)
    txt(etiqueta.toUpperCase(), M + 2, y + 4.2, { b: true, s: 8 })
    txt(valor, M + 47, y + 4.2, { s: 9 })
    y += 6
  }
  y += 6

  // Tabla de gastos
  autoTable(doc, {
    startY: y,
    head: [modelo.encabezadoTabla],
    body: modelo.filas,
    theme: 'grid',
    margin: { left: M, right: M, top: 16 },
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      cellPadding: 1.2,
      lineColor: 200,
      lineWidth: 0.1,
      textColor: 20,
    },
    headStyles: { fillColor: 230, textColor: 20, fontStyle: 'bold' },
    // Anchos en mm (total 187,9): montos y Nº de documento sin partirse; subcuenta/detalle se ajusta.
    columnStyles: {
      0: { cellWidth: 16 },
      1: { cellWidth: 17 },
      2: { cellWidth: 26 },
      3: { cellWidth: 27 },
      4: { cellWidth: 16, halign: 'right' },
      5: { cellWidth: 14, halign: 'right' },
      6: { cellWidth: 20, halign: 'right' },
      7: { cellWidth: 18, halign: 'right' },
    },
  })
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4

  // Totales (cuadro a la derecha)
  doc.setDrawColor(40)
  for (const t of modelo.totales) {
    if (y > 262) {
      doc.addPage()
      y = 16
    }
    doc.rect(W - M - 90, y, 60, 6)
    doc.rect(W - M - 30, y, 30, 6)
    txt(t.etiqueta, W - M - 88, y + 4.2, { b: t.destacado, s: 8 })
    txt(t.valor, W - M - 1, y + 4.2, { b: t.destacado, s: 8, a: 'right' })
    y += 6
  }
  y += 6

  // Estado de pago, pagos, aprobación, respaldos
  for (const nota of modelo.notas) {
    for (const linea of doc.splitTextToSize(nota, W - 2 * M) as string[]) {
      if (y > 262) {
        doc.addPage()
        y = 16
      }
      txt(linea, M, y, { s: 8.5 })
      y += 4.5
    }
  }

  // Firmas
  if (y > 235) {
    doc.addPage()
    y = 30
  } else y += 22
  doc.line(M + 5, y, M + 75, y)
  doc.line(W - M - 75, y, W - M - 5, y)
  txt('Firma solicitante', M + 40, y + 5, { s: 8, a: 'center' })
  txt('V°B° Tesorería', W - M - 40, y + 5, { s: 8, a: 'center' })

  // Una página por foto de respaldo y una (reservada) por cada página de los respaldos PDF
  const n = respaldos.length
  const reservas: Reserva[] = []
  for (let k = 0; k < n; k++) {
    const { url, tipo } = respaldos[k]!
    onProgreso?.(`Agregando respaldo ${k + 1} de ${n}…`)
    const titulo = `${modelo.folio} · Respaldo ${k + 1} de ${n}`
    if (tipo === 'pdf') {
      let pdf: PDFDocument | null = null
      try {
        // Sin ignoreEncryption: un PDF con contraseña falla aquí y queda la página de aviso.
        pdf = await pdfLib!.PDFDocument.load(await cargarPdf(url))
      } catch {
        pdf = null
      }
      const m = pdf?.getPageCount() ?? 0
      if (!pdf || !m) {
        doc.addPage()
        txt(`Respaldo ${k + 1}: no se pudo abrir el PDF (dañado o con contraseña).`, M, 20, {
          s: 10,
        })
        txt('Ábrelo desde la rendición en la app.', M, 26, { s: 10 })
        continue
      }
      for (let j = 0; j < m; j++) {
        doc.addPage()
        txt(`${titulo} · pág. ${j + 1} de ${m}`, M, 12, { b: true, s: 9 })
        reservas.push({ pagina: doc.getNumberOfPages() - 1, pdf, indice: j })
      }
      continue
    }
    doc.addPage()
    try {
      const img = await cargarImagen(url)
      txt(titulo, M, 12, { b: true, s: 9 })
      const r = Math.min(CAJA.ancho / img.ancho, CAJA.alto / img.alto)
      const [w, h] = [img.ancho * r, img.alto * r]
      doc.addImage(img.datos, 'JPEG', CAJA.x + (CAJA.ancho - w) / 2, CAJA.y, w, h)
    } catch {
      txt(`Respaldo ${k + 1}: no se pudo cargar la imagen.`, M, 20, { s: 10 })
    }
  }

  // Numeración (incluye las páginas reservadas)
  const total = doc.getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    txt(`Página ${i} de ${total}`, W - M, 274, { s: 7, a: 'right' })
  }

  const salida = doc.output('arraybuffer')
  if (!reservas.length) return salida
  return dibujarPaginasPdf(pdfLib!.PDFDocument, salida, reservas)
}

/** Dibuja cada página de los respaldos PDF, escalada dentro de la caja de su página reservada. */
async function dibujarPaginasPdf(
  Pdf: typeof PDFDocument,
  reporte: ArrayBuffer,
  reservas: readonly Reserva[],
): Promise<ArrayBuffer> {
  const final = await Pdf.load(reporte)
  const paginas = final.getPages()
  for (const pdf of new Set(reservas.map((r) => r.pdf))) {
    const propias = reservas.filter((r) => r.pdf === pdf)
    const embebidas = await final.embedPdf(
      pdf,
      propias.map((r) => r.indice),
    )
    propias.forEach((r, i) => {
      const e = embebidas[i]!
      const [ancho, alto] = [CAJA.ancho * PT, CAJA.alto * PT]
      const f = Math.min(ancho / e.width, alto / e.height)
      const [w, h] = [e.width * f, e.height * f]
      paginas[r.pagina]!.drawPage(e, {
        x: CAJA.x * PT + (ancho - w) / 2,
        y: (H - CAJA.y) * PT - h,
        width: w,
        height: h,
      })
    })
  }
  // Sin object streams: el resultado sigue siendo legible por visores antiguos (y por los tests).
  const bytes = await final.save({ useObjectStreams: false })
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

/** Genera y descarga el reporte. */
export async function descargarReportePdf(
  modelo: ModeloReporte,
  respaldos: readonly RespaldoReporte[],
  opciones?: OpcionesPdf,
) {
  const datos = await generarReportePdf(modelo, respaldos, opciones)
  descargar(new Blob([datos], { type: 'application/pdf' }), modelo.nombreArchivo)
}
