// Respaldos adjuntos a una rendición: fotos o PDF del formulario y de las boletas.
import type { TipoRespaldo } from '@/types/rendicion'

/** Lado máximo de las fotos al subirlas (px). */
export const LADO_MAXIMO = 2400

/** Peso máximo de un PDF (igual que el bucket `respaldos`). Las fotos se reducen antes de subir. */
export const TAMANO_MAXIMO = 10 * 1024 * 1024

/** Factor para que el lado mayor no pase de `lado` (nunca agranda). */
export function escalaPara(ancho: number, alto: number, lado = LADO_MAXIMO): number {
  return Math.min(1, lado / Math.max(ancho, alto))
}

/** Tipo de respaldo según el mime ("application/pdf") o la ruta/nombre ("…/x.pdf"). */
export function tipoRespaldo(mimeORuta: string): TipoRespaldo {
  return /^application\/pdf$|\.pdf$/i.test(mimeORuta) ? 'pdf' : 'imagen'
}

interface ArchivoElegido {
  type: string
  name: string
  size: number
}

/** Tipo de un archivo elegido, o null si no es imagen ni PDF (algunos celulares no informan el mime). */
export function tipoArchivo(f: Omit<ArchivoElegido, 'size'>): TipoRespaldo | null {
  if (f.type.startsWith('image/')) return 'imagen'
  if (f.type === 'application/pdf' || (!f.type && /\.pdf$/i.test(f.name))) return 'pdf'
  return null
}

const lista = (n: number, uno: string, varios: string) => (n === 1 ? uno : varios)

/**
 * Separa los archivos que se pueden adjuntar (imágenes y PDF de hasta 10 MB)
 * y arma un aviso con los que se descartaron.
 */
export function revisarArchivos<T extends ArchivoElegido>(archivos: readonly T[]) {
  const aceptados: T[] = []
  const otros: T[] = []
  const pesados: T[] = []
  for (const f of archivos) {
    const tipo = tipoArchivo(f)
    if (!tipo) otros.push(f)
    else if (tipo === 'pdf' && f.size > TAMANO_MAXIMO) pesados.push(f)
    else aceptados.push(f)
  }
  const avisos: string[] = []
  if (otros.length)
    avisos.push(
      lista(
        otros.length,
        `«${otros[0]!.name}» no es imagen ni PDF y no se agregó.`,
        `${otros.length} archivos no son imágenes ni PDF y no se agregaron.`,
      ),
    )
  if (pesados.length)
    avisos.push(
      lista(
        pesados.length,
        `«${pesados[0]!.name}» pesa más de 10 MB y no se agregó: comprímelo o sube una foto.`,
        `${pesados.length} PDF pesan más de 10 MB y no se agregaron: comprímelos o sube fotos.`,
      ),
    )
  return { aceptados, aviso: avisos.join(' ') }
}
