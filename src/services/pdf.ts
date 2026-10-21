// Dibujo del reporte PDF de una rendición con jsPDF (carta, mm). Porta el diseño de reportePDF().
// jsPDF y autotable se cargan solo al generar el reporte.
import type { ModeloReporte } from '@/domain/reporte'
import { escalaPara } from '@/domain/recortes'
import { descargar } from '@/lib/descargar'

export interface ImagenPdf {
  /** data URL JPEG */
  datos: string
  ancho: number
  alto: number
}

export type CargarImagen = (src: string) => Promise<ImagenPdf>

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

export interface OpcionesPdf {
  cargarImagen?: CargarImagen
  /** Avisa el avance ("Agregando respaldo 2 de 3…"). */
  onProgreso?: (texto: string) => void
}

// Medidas de página carta en mm
const W = 215.9
const H = 279.4
const M = 14

/** Genera el PDF y devuelve sus bytes. */
export async function generarReportePdf(
  modelo: ModeloReporte,
  fotos: readonly string[],
  { cargarImagen = cargarImagenNavegador, onProgreso }: OpcionesPdf = {},
): Promise<ArrayBuffer> {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
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

  // Una página por foto de respaldo
  for (let k = 0; k < fotos.length; k++) {
    onProgreso?.(`Agregando respaldo ${k + 1} de ${fotos.length}…`)
    doc.addPage()
    try {
      const img = await cargarImagen(fotos[k]!)
      txt(`${modelo.folio} · Respaldo ${k + 1} de ${fotos.length}`, M, 12, { b: true, s: 9 })
      const mw = W - 2 * M
      const mh = H - 30
      const r = Math.min(mw / img.ancho, mh / img.alto)
      doc.addImage(img.datos, 'JPEG', M + (mw - img.ancho * r) / 2, 18, img.ancho * r, img.alto * r)
    } catch {
      txt(`Respaldo ${k + 1}: no se pudo cargar la imagen.`, M, 20, { s: 10 })
    }
  }

  // Numeración
  const n = doc.getNumberOfPages()
  for (let i = 1; i <= n; i++) {
    doc.setPage(i)
    txt(`Página ${i} de ${n}`, W - M, 274, { s: 7, a: 'right' })
  }

  return doc.output('arraybuffer')
}

/** Genera y descarga el reporte. */
export async function descargarReportePdf(
  modelo: ModeloReporte,
  fotos: readonly string[],
  opciones?: OpcionesPdf,
) {
  const datos = await generarReportePdf(modelo, fotos, opciones)
  descargar(new Blob([datos], { type: 'application/pdf' }), modelo.nombreArchivo)
}
