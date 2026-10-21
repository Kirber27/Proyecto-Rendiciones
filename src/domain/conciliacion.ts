// Propuestas de conciliación bancaria (porta nameHit, proposals() y los candidatos de conciliacion()).
//
// Para cada CARGO sin asignar ni ignorar, en orden de fecha:
//  1. Pago ya registrado sin cartola con el mismo monto (±1) y fecha ±5 días (se prefiere el que
//     tenga el nombre de la persona en la glosa).
//  2. Una rendición con saldo igual al cargo (±1) y fecha del cargo ≥ fecha de rendición − 3 días
//     (se prefiere la que tenga el nombre en la glosa).
//  3. Varias rendiciones de una misma persona (con nombre en la glosa) cuyo saldo sumado iguala
//     el cargo (tolerancia ±1 por rendición), buscando entre sus 12 más antiguas.
// Una rendición o pago usado en una propuesta no se reutiliza en otra.
import type { MovimientoCartola } from '@/types/banco'
import type { PagoParaAsignar, RendicionParaPago } from '@/types/pagos'
import type { Asignacion } from './asignacion'
import { dnum, norm } from './formato'

export interface MovimientoParaConciliar extends MovimientoCartola {
  id: string
  /** Ya tiene un pago asociado. */
  asignado: boolean
  ignorado: boolean
}

export interface PagoParaConciliar extends PagoParaAsignar {
  /** Cargo de cartola que lo respalda (null = pago registrado a mano, sin cartola). */
  movimientoId: string | null
}

export type Confianza =
  | 'Pago ya registrado · nombre'
  | 'Pago ya registrado · monto'
  | 'Monto y nombre'
  | 'Solo monto'
  | 'Varias rendiciones · nombre'

export type Propuesta =
  | {
      movimiento: MovimientoParaConciliar
      tipo: 'pago-existente'
      pagoId: string
      confianza: Confianza
      marcada: boolean
    }
  | {
      movimiento: MovimientoParaConciliar
      tipo: 'rendiciones'
      rendicionIds: string[]
      confianza: Confianza
      marcada: boolean
    }

/** Las propuestas solo por monto quedan sin marcar: tesorería debe confirmarlas una a una. */
export const marcadaPorDefecto = (c: Confianza) =>
  c !== 'Solo monto' && c !== 'Pago ya registrado · monto'

/** Días de tolerancia: pago registrado vs. cargo, y cargo antes de la fecha de la rendición. */
export const DIAS_PAGO = 5
export const DIAS_ANTES_RENDICION = 3
/** Máximo de rendiciones por persona que se combinan en el nivel 3 (2^12 = 4096 combinaciones). */
export const MAX_COMBINAR = 12

/** Cuántas palabras de 4+ letras del nombre aparecen en la glosa del banco. */
export function coincidenciaNombre(nombre: string, glosa: string): number {
  const d = norm(glosa)
  return norm(nombre)
    .split(' ')
    .filter((t) => t.length >= 4 && d.includes(t)).length
}

export interface EntradaConciliacion {
  /** Movimientos de todas las cartolas, en el orden en que se cargaron. */
  movimientos: readonly MovimientoParaConciliar[]
  rendiciones: readonly RendicionParaPago[]
  pagos: readonly PagoParaConciliar[]
  asignacion: Asignacion
  /** Nombre de cada persona (para buscarlo en la glosa). */
  nombres: ReadonlyMap<string, string>
}

export interface ResultadoConciliacion {
  propuestas: Propuesta[]
  /** Cargos que quedaron sin propuesta (para asignación manual). */
  sinAsignar: MovimientoParaConciliar[]
  /** Rendiciones con saldo que no quedaron en ninguna propuesta. */
  pendientes: RendicionParaPago[]
}

export function proponer(e: EntradaConciliacion): ResultadoConciliacion {
  const saldo = (r: RendicionParaPago) => e.asignacion.porRendicion.get(r.id)?.saldo ?? r.total
  const nombre = (personaId: string) => e.nombres.get(personaId) ?? ''

  const pend = e.rendiciones.filter((r) => saldo(r) > 1)
  const pagosLibres = e.pagos.filter(
    (p) => !p.movimientoId && p.tipo !== 'No genera pago' && p.monto > 0,
  )
  const usadas = new Set<string>()
  const pagosUsados = new Set<string>()
  const propuestas: Propuesta[] = []

  const cargos = e.movimientos
    .filter((m) => m.cargo > 0 && !m.asignado && !m.ignorado)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))

  for (const m of cargos) {
    // 1. Pago ya registrado
    const ex = pagosLibres.filter(
      (p) =>
        !pagosUsados.has(p.id) &&
        Math.abs(p.monto - m.cargo) <= 1 &&
        Math.abs(dnum(p.fecha || m.fecha) - dnum(m.fecha)) <= DIAS_PAGO,
    )
    const exN = ex.filter((p) => coincidenciaNombre(nombre(p.personaId), m.descripcion) > 0)
    const pago = exN.length === 1 ? exN[0] : ex.length === 1 ? ex[0] : undefined
    if (pago) {
      pagosUsados.add(pago.id)
      const confianza: Confianza =
        exN.length === 1 ? 'Pago ya registrado · nombre' : 'Pago ya registrado · monto'
      propuestas.push({
        movimiento: m,
        tipo: 'pago-existente',
        pagoId: pago.id,
        confianza,
        marcada: marcadaPorDefecto(confianza),
      })
      continue
    }

    const sirve = (r: RendicionParaPago) =>
      !usadas.has(r.id) && dnum(m.fecha) >= dnum(r.fecha) - DIAS_ANTES_RENDICION

    // 2. Una rendición con el saldo exacto
    const exactas = pend.filter((r) => sirve(r) && Math.abs(saldo(r) - m.cargo) <= 1)
    const conNombre = exactas.filter(
      (r) => coincidenciaNombre(nombre(r.personaId), m.descripcion) > 0,
    )
    let elegidas: RendicionParaPago[] | null = null
    let confianza: Confianza = 'Solo monto'
    if (conNombre.length === 1) {
      elegidas = [conNombre[0]!]
      confianza = 'Monto y nombre'
    } else if (exactas.length === 1) {
      elegidas = [exactas[0]!]
      confianza = 'Solo monto'
    } else if (!exactas.length) {
      // 3. Varias rendiciones de la persona nombrada en la glosa
      const porPersona = new Map<string, RendicionParaPago[]>()
      for (const r of pend) {
        if (!sirve(r) || coincidenciaNombre(nombre(r.personaId), m.descripcion) === 0) continue
        const k = norm(nombre(r.personaId))
        const lista = porPersona.get(k)
        if (lista) lista.push(r)
        else porPersona.set(k, [r])
      }
      for (const rs of porPersona.values()) {
        elegidas = combinacionQueSuma(rs, m.cargo, saldo)
        if (elegidas) {
          confianza = 'Varias rendiciones · nombre'
          break
        }
      }
    }

    if (elegidas) {
      elegidas.forEach((r) => usadas.add(r.id))
      propuestas.push({
        movimiento: m,
        tipo: 'rendiciones',
        rendicionIds: elegidas.map((r) => r.id),
        confianza,
        marcada: marcadaPorDefecto(confianza),
      })
    }
  }

  const conPropuesta = new Set(propuestas.map((p) => p.movimiento.id))
  return {
    propuestas,
    sinAsignar: cargos.filter((m) => !conPropuesta.has(m.id)),
    pendientes: pend.filter((r) => !usadas.has(r.id)),
  }
}

/**
 * Primer subconjunto (de 2 o más) de las rendiciones más antiguas cuyo saldo suma `objetivo`
 * con tolerancia ±1 por rendición. Recorre las combinaciones en el mismo orden que el prototipo.
 */
function combinacionQueSuma(
  rendiciones: RendicionParaPago[],
  objetivo: number,
  saldo: (r: RendicionParaPago) => number,
): RendicionParaPago[] | null {
  const rs = rendiciones.slice().sort((a, b) => a.fecha.localeCompare(b.fecha))
  const n = Math.min(rs.length, MAX_COMBINAR)
  for (let mask = 1; mask < 1 << n; mask++) {
    let suma = 0
    const sel: RendicionParaPago[] = []
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) {
        suma += saldo(rs[i]!)
        sel.push(rs[i]!)
      }
    }
    if (sel.length > 1 && Math.abs(suma - objetivo) <= sel.length) return sel
  }
  return null
}

/** Máximo de rendiciones candidatas que se ofrecen al asignar un cargo a mano. */
export const MAX_CANDIDATAS = 30

/**
 * Rendiciones para el selector manual de un cargo: primero las que tienen el nombre en la glosa,
 * luego las de saldo más cercano al cargo.
 */
export function candidatas(
  m: MovimientoCartola,
  pendientes: readonly RendicionParaPago[],
  asignacion: Asignacion,
  nombres: ReadonlyMap<string, string>,
): RendicionParaPago[] {
  const saldo = (r: RendicionParaPago) => asignacion.porRendicion.get(r.id)?.saldo ?? r.total
  const hit = (r: RendicionParaPago) =>
    coincidenciaNombre(nombres.get(r.personaId) ?? '', m.descripcion)
  return pendientes
    .filter((r) => dnum(m.fecha) >= dnum(r.fecha) - DIAS_ANTES_RENDICION)
    .sort((a, b) => hit(b) - hit(a) || Math.abs(saldo(a) - m.cargo) - Math.abs(saldo(b) - m.cargo))
    .slice(0, MAX_CANDIDATAS)
}

/** Personas para "Anticipo a…": primero las nombradas en la glosa. */
export function personasParaAnticipo<T extends { nombre: string }>(
  m: MovimientoCartola,
  personas: readonly T[],
): T[] {
  return personas
    .slice()
    .sort(
      (a, b) =>
        coincidenciaNombre(b.nombre, m.descripcion) - coincidenciaNombre(a.nombre, m.descripcion),
    )
}
