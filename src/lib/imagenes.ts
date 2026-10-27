// Procesamiento de fotos en el navegador (canvas) antes de subirlas a Storage.
import { escalaPara, LADO_MAXIMO } from '@/domain/respaldos'

async function decodificar(archivo: Blob): Promise<ImageBitmap | null> {
  try {
    return await createImageBitmap(archivo, { imageOrientation: 'from-image' })
  } catch {
    return null // formato que el navegador no decodifica (p. ej. HEIC en Chrome)
  }
}

/**
 * Reduce una foto a JPEG con lado máximo `lado`.
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
    const sc = escalaPara(bmp.width, bmp.height, lado)
    const c = document.createElement('canvas')
    c.width = Math.round(bmp.width * sc)
    c.height = Math.round(bmp.height * sc)
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', calidad))
    return blob ?? archivo
  } finally {
    bmp.close()
  }
}
