// Formato y normalización (porta norm, tr, raw, num, clp, iso, today, fdate, parseDate, dnum, semana
// de CLAUDE/app/rendiciones-heca.html). Funciones puras: sin Vue ni Supabase.

export const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const

type Texto = string | number | null | undefined

/** Para comparar: sin tildes, minúsculas, espacios colapsados y recortados. */
export function norm(s: Texto): string {
  return (s ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Para mostrar: espacios colapsados y recortados (conserva tildes y mayúsculas). */
export function tr(s: Texto): string {
  return (s ?? '').toString().replace(/\s+/g, ' ').trim()
}

/** Elemento de la lista con la grafía exacta (p. ej. "David Herce ") que calza con `v` según `norm`. */
export function raw<T extends string>(lista: readonly T[], v: Texto): T | null {
  if (!v) return null
  const k = norm(v)
  return lista.find((x) => norm(x) === k) ?? null
}

/**
 * Monto desde número o texto chileno: "70.389" → 70389, "$ 1.234,50" → 1234.5, "" → 0.
 * Un punto siempre es separador de miles; la coma con 1–2 decimales al final es decimal.
 */
export function num(v: Texto): number {
  if (v == null || v === '') return 0
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  let s = String(v).replace(/[^\d,.-]/g, '')
  if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.')
  else s = s.replace(/[.,]/g, '')
  const n = parseFloat(s)
  return Number.isNaN(n) ? 0 : n
}

/** Entero con punto como separador de miles, independiente del idioma del navegador. */
export function miles(n: number): string {
  return Math.round(Math.abs(n))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

/** Pesos chilenos: 70389 → "$ 70.389"; -500 → "-$ 500". */
export function clp(n: number | null | undefined): string {
  const v = n || 0
  return (v < -0.5 ? '-' : '') + '$ ' + miles(v)
}

/** Date → "YYYY-MM-DD" en hora local. */
export function iso(d: Date): string {
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  )
}

export const hoy = (): string => iso(new Date())

/** "YYYY-MM-DD…" → "DD-MM-YYYY" para mostrar. */
export function fdate(s: string | null | undefined): string {
  return s ? s.slice(0, 10).split('-').reverse().join('-') : ''
}

/**
 * Fecha a "YYYY-MM-DD" desde: Date, número serial de Excel, "YYYY-MM-DD", "DD-MM-YYYY",
 * "DD/MM/YY" o "DD.MM.YYYY". Si no se reconoce, "".
 */
export function parseDate(v: unknown): string {
  if (v == null || v === '') return ''
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? '' : iso(v)
  if (typeof v === 'number') {
    const d = new Date(Math.round((v - 25569) * 86400000))
    if (Number.isNaN(d.getTime())) return ''
    return (
      d.getUTCFullYear() +
      '-' +
      String(d.getUTCMonth() + 1).padStart(2, '0') +
      '-' +
      String(d.getUTCDate()).padStart(2, '0')
    )
  }
  const s = String(v).trim()
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return m[1] + '-' + m[2]!.padStart(2, '0') + '-' + m[3]!.padStart(2, '0')
  m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/)
  if (m) {
    const y = m[3]!.length === 2 ? '20' + m[3] : m[3]!
    return y + '-' + m[2]!.padStart(2, '0') + '-' + m[1]!.padStart(2, '0')
  }
  return ''
}

/** "YYYY-MM-DD" → días desde 1970 (para comparar y restar fechas). "" → 0. */
export function dnum(s: string | null | undefined): number {
  const [y, m, d] = (s || '').split('-').map(Number)
  return y ? Date.UTC(y, (m || 1) - 1, d || 1) / 86400000 : 0
}

/** Semana laboral de la fecha, como en el Excel: "2026-10-07" → "Del 05 al 09". */
export function semana(s: string): string {
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(Date.UTC(y!, m! - 1, d!))
  const dow = (dt.getUTCDay() + 6) % 7 // lunes = 0
  const lunes = new Date(dt.getTime() - dow * 86400000)
  const viernes = new Date(lunes.getTime() + 4 * 86400000)
  const dd = (x: Date) => String(x.getUTCDate()).padStart(2, '0')
  return `Del ${dd(lunes)} al ${dd(viernes)}`
}

/** Nombre del mes en minúsculas: "2026-10-07" → "octubre". */
export function mes(s: string): string {
  return MESES[Number(s.split('-')[1]) - 1] ?? ''
}
