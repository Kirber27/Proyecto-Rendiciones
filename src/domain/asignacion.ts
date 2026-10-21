// Estado de pago de cada rendición y cuenta corriente de cada persona (porta alloc() del prototipo).
//
// Por persona:
//  1. Rendiciones por fecha (y Nº); pagos por fecha (los sin fecha primero, como en el prototipo).
//  2. Cada pago se aplica primero a las rendiciones vinculadas explícitamente, hasta cubrir su total.
//  3. Lo que sobra (anticipos, pagos agrupados, sobrantes; las devoluciones restan) va a un pozo
//     que se aplica a las rendiciones pendientes desde la más antigua (FIFO).
import type {
  CuentaPersona,
  EstadoPago,
  EstadoPagoRendicion,
  PagoParaAsignar,
  RendicionParaPago,
} from '@/types/pagos'

export interface Asignacion {
  porRendicion: Map<string, EstadoPagoRendicion>
  porPersona: Map<string, CuentaPersona>
}

/** Estado según lo pagado: tolerancia de 1 peso para "Pagada", 0,5 para considerar montos. */
export function estadoPago(total: number, pagado: number): EstadoPago {
  if (total <= 0.5) return 'Sin monto'
  if (pagado >= total - 1) return 'Pagada'
  if (pagado > 0.5) return 'Pago parcial'
  return 'Pendiente de pago'
}

/** Números de 1..max que no aparecen (correlativo de rendiciones de una persona). */
export function faltantesCorrelativo(nros: readonly number[]): {
  max: number
  faltantes: number[]
} {
  const validos = nros.filter((n) => n > 0)
  const max = validos.length ? Math.max(...validos) : 0
  const set = new Set(validos)
  const faltantes: number[] = []
  for (let i = 1; i <= max; i++) if (!set.has(i)) faltantes.push(i)
  return { max, faltantes }
}

const porFecha = (a: { fecha: string }, b: { fecha: string }) =>
  (a.fecha || '').localeCompare(b.fecha || '')

export function asignarPagos(
  rendiciones: readonly RendicionParaPago[],
  pagos: readonly PagoParaAsignar[],
): Asignacion {
  const st = new Map<string, { pagado: number; ultimo: string }>()
  for (const r of rendiciones) st.set(r.id, { pagado: 0, ultimo: '' })

  const grupos = new Map<string, { rends: RendicionParaPago[]; pagos: PagoParaAsignar[] }>()
  const grupo = (k: string) => {
    let g = grupos.get(k)
    if (!g) grupos.set(k, (g = { rends: [], pagos: [] }))
    return g
  }
  for (const r of rendiciones) grupo(r.personaId).rends.push(r)
  for (const p of pagos) grupo(p.personaId).pagos.push(p)

  const porPersona = new Map<string, CuentaPersona>()

  for (const [personaId, g] of grupos) {
    const rs = g.rends.slice().sort((a, b) => porFecha(a, b) || a.nro - b.nro)
    const ids = new Set(rs.map((r) => r.id))
    let pozo = 0
    let ultimoPozo = ''

    // 2. Pagos vinculados explícitamente
    for (const p of g.pagos.slice().sort(porFecha)) {
      let m = p.monto || 0
      for (const id of p.rendicionIds) {
        if (!ids.has(id)) continue
        const s = st.get(id)!
        const r = rs.find((x) => x.id === id)!
        const a = Math.max(0, Math.min(r.total - s.pagado, m))
        s.pagado += a
        m -= a
        if (a > 0) s.ultimo = p.fecha || s.ultimo
      }
      pozo += m
      if (m > 0.5 && p.fecha > ultimoPozo) ultimoPozo = p.fecha
    }

    // 3. Pozo FIFO desde la más antigua
    for (const r of rs) {
      const s = st.get(r.id)!
      const falta = r.total - s.pagado
      if (falta > 0.5 && pozo > 0.5) {
        const a = Math.min(falta, pozo)
        s.pagado += a
        pozo -= a
        // Mejora sobre el prototipo (que dejaba la fecha vacía): si no tiene fecha, se usa la del
        // último pago que alimentó el pozo (aproximación). Nunca cambia una fecha ya conocida.
        if (!s.ultimo) s.ultimo = ultimoPozo
      }
    }

    const rendido = rs.reduce((t, r) => t + r.total, 0)
    const pagado = g.pagos.reduce((t, p) => t + (p.monto || 0), 0)
    const anticipos = g.pagos
      .filter((p) => p.tipo === 'Anticipo')
      .reduce((t, p) => t + (p.monto || 0), 0)
    porPersona.set(personaId, {
      personaId,
      rendido,
      pagado,
      saldo: rendido - pagado,
      anticipos,
      n: rs.length,
      ...faltantesCorrelativo(rs.map((r) => r.nro)),
    })
  }

  const porRendicion = new Map<string, EstadoPagoRendicion>()
  for (const r of rendiciones) {
    const s = st.get(r.id)!
    porRendicion.set(r.id, {
      pagado: s.pagado,
      saldo: r.total - s.pagado,
      estado: estadoPago(r.total, s.pagado),
      ultimo: s.ultimo,
    })
  }

  return { porRendicion, porPersona }
}
