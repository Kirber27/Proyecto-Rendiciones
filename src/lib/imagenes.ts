// Procesamiento de imágenes en el navegador (canvas). La lógica de qué recortar está en domain/recortes.ts.
import {
  cajasRecorte,
  escalaPara,
  LADO_MAXIMO,
  notaImagenes,
  recortesPorFoto,
  type Caja,
  type PiezaImagen,
} from '@/domain/recortes'

async function decodificar(archivo: Blob): Promise<ImageBitmap | null> {
  try {
    return await createImageBitmap(archivo, { imageOrientation: 'from-image' })
  } catch {
    return null // formato que el navegador no decodifica (p. ej. HEIC en Chrome)
  }
}

function aJpeg(
  bmp: ImageBitmap,
  [x, y, w, h]: Caja,
  calidad: number,
  lado = LADO_MAXIMO,
): Promise<Blob | null> {
  const sc = escalaPara(w, h, lado)
  const c = document.createElement('canvas')
  c.width = Math.round(w * sc)
  c.height = Math.round(h * sc)
  c.getContext('2d')!.drawImage(bmp, x, y, w, h, 0, 0, c.width, c.height)
  return new Promise((r) => c.toBlob(r, 'image/jpeg', calidad))
}

/**
 * Reduce una foto a JPEG con lado máximo `lado` (para enviar a la IA o subir a Storage).
 * Si no se puede decodificar, devuelve el archivo original.
 */
export async function reducirImagen(
  archivo: Blob,
  lado = LADO_MAXIMO,
  calidad = 0.85,
): Promise<Blob> {
  const bmp = await decodificar(archivo)
  if (!bmp) return archivo
  try {
    return (await aJpeg(bmp, [0, 0, bmp.width, bmp.height], calidad, lado)) ?? archivo
  } finally {
    bmp.close()
  }
}

export interface ImagenesPreparadas {
  imagenes: Blob[]
  /** Texto que se agrega al prompt explicando qué es cada imagen. */
  nota: string
}

/**
 * Arma las imágenes para la lectura: cada foto completa (reducida) y, si hay cupo,
 * recortes ampliados que se traslapan. No pasa de `maxImagenes`.
 */
export async function prepararImagenes(
  fotos: readonly Blob[],
  maxImagenes: number,
): Promise<ImagenesPreparadas> {
  const imagenes: Blob[] = []
  const piezas: PiezaImagen[] = []
  const cantidad = recortesPorFoto(fotos.length, maxImagenes)

  for (let i = 0; i < fotos.length && imagenes.length < maxImagenes; i++) {
    const bmp = await decodificar(fotos[i]!)
    if (!bmp) {
      imagenes.push(fotos[i]!)
      piezas.push({ foto: i + 1, tipo: 'completa' })
      continue
    }
    try {
      const completa = await aJpeg(bmp, [0, 0, bmp.width, bmp.height], 0.85)
      imagenes.push(completa ?? fotos[i]!)
      piezas.push({ foto: i + 1, tipo: 'completa' })
      for (const caja of cajasRecorte(bmp.width, bmp.height, cantidad)) {
        if (imagenes.length >= maxImagenes) break
        const b = await aJpeg(bmp, caja, 0.9)
        if (!b) continue
        imagenes.push(b)
        piezas.push({ foto: i + 1, tipo: 'recorte' })
      }
    } finally {
      bmp.close()
    }
  }
  return { imagenes, nota: notaImagenes(piezas) }
}
