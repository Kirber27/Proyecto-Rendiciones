// Reglas de contraseña (spec 10). Supabase también exige el largo mínimo (panel: 8).

export const LARGO_MINIMO_CLAVE = 8

export interface CambioClave {
  nueva: string
  repetida: string
  /** Contraseña actual (solo en el cambio voluntario). */
  actual?: string
  /** Cambio voluntario: se pide la actual. Con contraseña temporal no se pide. */
  pideActual: boolean
}

/** Problemas que impiden cambiar la contraseña (todos juntos). Lista vacía = se puede guardar. */
export function validarCambioClave(c: CambioClave): string[] {
  const p: string[] = []
  if (c.pideActual && !c.actual) p.push('Escribe tu contraseña actual.')
  if (c.nueva.length < LARGO_MINIMO_CLAVE)
    p.push(`La contraseña nueva debe tener al menos ${LARGO_MINIMO_CLAVE} caracteres.`)
  if (c.repetida !== c.nueva) p.push('Las contraseñas nuevas no coinciden.')
  if (c.pideActual && c.actual && c.nueva === c.actual)
    p.push('La contraseña nueva debe ser distinta de la actual.')
  return p
}
