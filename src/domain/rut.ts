// RUT chileno (spec 11): normalizar, dígito verificador (módulo 11) y formato para mostrar.
// Se guarda normalizado ("12345678-5": sin puntos, con guion, DV en mayúscula); la base valida igual
// con `public.rut_valido` y `public.normalizar_rut`.

/** Dígito verificador del cuerpo del RUT (solo dígitos): "0".."9" o "K". */
export function dvRut(cuerpo: string): string {
  let suma = 0
  let factor = 2
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * factor
    factor = factor === 7 ? 2 : factor + 1
  }
  const dv = 11 - (suma % 11)
  return dv === 11 ? '0' : dv === 10 ? 'K' : String(dv)
}

/**
 * RUT escrito de cualquier forma ("12.345.678-5", "123456785", " 12345678-k ") → "12345678-5".
 * Devuelve "" si no tiene forma de RUT (no revisa el dígito verificador: ver `rutValido`).
 */
export function normalizarRut(v: string | null | undefined): string {
  const limpio = (v ?? '').toUpperCase().replace(/[^0-9K]/g, '')
  const m = /^0*(\d{1,8})([0-9K])$/.exec(limpio)
  return m ? `${m[1]}-${m[2]}` : ''
}

/** Si el RUT tiene forma válida y su dígito verificador calza. */
export function rutValido(v: string | null | undefined): boolean {
  const n = normalizarRut(v)
  if (!n) return false
  const [cuerpo, dv] = n.split('-') as [string, string]
  return dvRut(cuerpo) === dv
}

/** Para mostrar: "12345678-5" → "12.345.678-5". Si no tiene forma de RUT, lo devuelve tal cual. */
export function formatearRut(v: string | null | undefined): string {
  const n = normalizarRut(v)
  if (!n) return (v ?? '').trim()
  const [cuerpo, dv] = n.split('-') as [string, string]
  return `${cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${dv}`
}
