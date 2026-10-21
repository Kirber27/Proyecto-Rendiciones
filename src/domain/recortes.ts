// Plan de imágenes para la lectura IA (porta prepImages() del prototipo, sin la parte de canvas).
// Cada foto va completa y, si hay cupo, con recortes ampliados que se traslapan para leer boletas chicas.

/** Lado máximo de cada imagen enviada (px). */
export const LADO_MAXIMO = 2400

/** Cuántos recortes por foto caben: 4 cuadrantes si caben 5 imágenes por foto, 2 mitades si caben 3. */
export function recortesPorFoto(nFotos: number, maxImagenes: number): 0 | 2 | 4 {
  if (nFotos * 5 <= maxImagenes) return 4
  if (nFotos * 3 <= maxImagenes) return 2
  return 0
}

/** Caja de recorte en píxeles de la imagen original: [x, y, ancho, alto]. */
export type Caja = [number, number, number, number]

/**
 * Cajas de recorte (55% del lado, traslape de 10%):
 * 4 → cuadrantes; 2 → mitades izquierda/derecha si es apaisada, arriba/abajo si es vertical.
 */
export function cajasRecorte(ancho: number, alto: number, cantidad: 0 | 2 | 4): Caja[] {
  if (cantidad === 4) {
    return [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ].map(([cx, cy]) => [cx! * ancho * 0.45, cy! * alto * 0.45, ancho * 0.55, alto * 0.55])
  }
  if (cantidad === 2) {
    return ancho >= alto
      ? [
          [0, 0, ancho * 0.55, alto],
          [ancho * 0.45, 0, ancho * 0.55, alto],
        ]
      : [
          [0, 0, ancho, alto * 0.55],
          [0, alto * 0.45, ancho, alto * 0.55],
        ]
  }
  return []
}

/** Factor para que el lado mayor no pase de `lado` (nunca agranda). */
export function escalaPara(ancho: number, alto: number, lado = LADO_MAXIMO): number {
  return Math.min(1, lado / Math.max(ancho, alto))
}

/** Descripción de una imagen enviada, para que el modelo no cuente dos veces un documento. */
export type PiezaImagen = { foto: number; tipo: 'completa' | 'recorte' }

export function notaImagenes(piezas: readonly PiezaImagen[]): string {
  const lineas = piezas.map((p, i) =>
    p.tipo === 'completa'
      ? `Imagen ${i + 1}: foto ${p.foto} completa.`
      : `Imagen ${i + 1}: acercamiento de una parte de la foto ${p.foto} (los recortes se traslapan; un documento que aparece en varios recortes o en la foto completa es UN solo documento).`,
  )
  return 'Cómo vienen las imágenes:\n' + lineas.join('\n')
}

/** Solo imágenes (los PDF y otros archivos se descartan). */
export function separarImagenes<T extends { type: string }>(archivos: readonly T[]) {
  const imagenes = archivos.filter((f) => f.type.startsWith('image/'))
  return { imagenes, descartados: archivos.length - imagenes.length }
}
