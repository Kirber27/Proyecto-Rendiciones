// Cuenta corriente por persona y resumen de la pantalla Personas (porta vPersonas del prototipo).
import type {
  CuentaPersona,
  EstadoPago,
  PagoParaAsignar,
  RendicionParaPago,
  TipoPago,
} from '@/types/pagos'
import type { Asignacion } from './asignacion'
import { tr } from './formato'

/** Rendición con lo necesario para mostrarla en la cuenta corriente. */
export interface RendicionCC extends RendicionParaPago {
  /** Folio del libro (DHE-042). Si falta, se muestra "Nº X". */
  folio?: string | null
}

/** Pago con lo necesario para mostrarlo en la cuenta corriente. */
export interface PagoCC extends PagoParaAsignar {
  medioPago?: string | null
  descripcion?: string | null
  /** Cargo de cartola que lo respalda; si tiene, no se elimina desde Personas (se desvincula en Banco). */
  movimientoId?: string | null
}

export type MovimientoCC =
  | {
      clase: 'rendicion'
      id: string
      fecha: string
      movimiento: 'Rendición'
      detalle: string
      rendido: number
      pagado: 0
      saldo: number
      estado: EstadoPago
    }
  | {
      clase: 'pago'
      id: string
      fecha: string
      movimiento: TipoPago
      detalle: string
      rendido: 0
      pagado: number
      saldo: number
      /** Se puede eliminar desde Personas (pago manual, sin cartola). */
      eliminable: boolean
    }

/**
 * Movimientos de una persona en orden cronológico con saldo acumulado
 * (rendido suma, pagado resta). En la misma fecha, las rendiciones van antes que los pagos.
 * El saldo final coincide con `CuentaPersona.saldo`.
 */
export function movimientosPersona(
  personaId: string,
  rendiciones: readonly RendicionCC[],
  pagos: readonly PagoCC[],
  asignacion: Asignacion,
): MovimientoCC[] {
  const folioDe = new Map(rendiciones.map((r) => [r.id, r.folio || `Nº ${r.nro}`]))

  // Omit distributivo: conserva los campos propios de cada variante de la unión.
  type SinSaldo<T> = T extends unknown ? Omit<T, 'saldo'> : never
  type Base = { fecha: string; orden: number; sec: number; fila: SinSaldo<MovimientoCC> }
  const base: Base[] = []

  rendiciones
    .filter((r) => r.personaId === personaId)
    .forEach((r) =>
      base.push({
        fecha: r.fecha || '',
        orden: 0,
        sec: r.nro,
        fila: {
          clase: 'rendicion',
          id: r.id,
          fecha: r.fecha,
          movimiento: 'Rendición',
          detalle: `${r.folio || r.id} · Nº ${r.nro}`,
          rendido: r.total,
          pagado: 0,
          estado: asignacion.porRendicion.get(r.id)?.estado ?? 'Pendiente de pago',
        },
      }),
    )

  pagos
    .filter((p) => p.personaId === personaId)
    .forEach((p, i) => {
      const partes = [tr(p.medioPago ?? '')]
      if (p.descripcion) partes.push(tr(p.descripcion))
      if (p.rendicionIds.length)
        partes.push(p.rendicionIds.map((id) => folioDe.get(id) ?? id).join(', '))
      base.push({
        fecha: p.fecha || '',
        orden: 1,
        sec: i,
        fila: {
          clase: 'pago',
          id: p.id,
          fecha: p.fecha,
          movimiento: p.tipo,
          detalle: partes.filter(Boolean).join(' · '),
          rendido: 0,
          pagado: p.monto || 0,
          eliminable: !p.movimientoId,
        },
      })
    })

  base.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.orden - b.orden || a.sec - b.sec)

  let saldo = 0
  return base.map(({ fila }) => {
    saldo += fila.rendido - fila.pagado
    return { ...fila, saldo } as MovimientoCC
  })
}

// ---------- Resumen de la pantalla Personas ----------

/** Tolerancia en pesos para considerar un saldo distinto de cero. */
export const TOLERANCIA_SALDO = 1

export type Situacion =
  | { tipo: 'por-pagar'; texto: string; pendientes: number }
  | { tipo: 'por-rendir'; texto: 'Pendiente por rendir' }
  | { tipo: 'al-dia'; texto: 'Al día' }

/** Situación de una persona: la empresa le debe, tiene fondos por rendir, o está al día. */
export function situacionPersona(
  cuenta: Pick<CuentaPersona, 'personaId' | 'saldo'>,
  rendiciones: readonly RendicionParaPago[],
  asignacion: Asignacion,
): Situacion {
  if (cuenta.saldo > TOLERANCIA_SALDO) {
    const pendientes = rendiciones.filter(
      (r) =>
        r.personaId === cuenta.personaId && asignacion.porRendicion.get(r.id)?.estado !== 'Pagada',
    ).length
    return { tipo: 'por-pagar', texto: `Por pagar · ${pendientes} rend.`, pendientes }
  }
  if (cuenta.saldo < -TOLERANCIA_SALDO) return { tipo: 'por-rendir', texto: 'Pendiente por rendir' }
  return { tipo: 'al-dia', texto: 'Al día' }
}

export interface ResumenPersonas {
  /** Suma de saldos positivos: lo que la empresa debe. */
  empresaDebe: number
  /** Suma de saldos negativos, en positivo: fondos entregados pendientes de rendir. */
  fondosPorRendir: number
  /** Personas con |saldo| > 1. */
  conSaldo: number
}

export function resumenPersonas(cuentas: Iterable<CuentaPersona>): ResumenPersonas {
  const r: ResumenPersonas = { empresaDebe: 0, fondosPorRendir: 0, conSaldo: 0 }
  for (const c of cuentas) {
    if (c.saldo > TOLERANCIA_SALDO) r.empresaDebe += c.saldo
    if (c.saldo < -TOLERANCIA_SALDO) r.fondosPorRendir -= c.saldo
    if (Math.abs(c.saldo) > TOLERANCIA_SALDO) r.conSaldo++
  }
  return r
}

/** Orden de la tabla de Personas: mayor |saldo| primero. */
export function ordenarPorSaldo<T extends Pick<CuentaPersona, 'saldo'>>(cuentas: Iterable<T>): T[] {
  return [...cuentas].sort((a, b) => Math.abs(b.saldo) - Math.abs(a.saldo))
}

// ---------- Formulario de pago ----------

export interface PendienteDePago {
  id: string
  /** Folio o "Nº X". */
  etiqueta: string
  fecha: string
  saldo: number
}

/** Rendiciones de la persona que aún no están pagadas (para vincular un pago), de la más antigua a la más nueva. */
export function pendientesDePago(
  personaId: string,
  rendiciones: readonly RendicionCC[],
  asignacion: Asignacion,
): PendienteDePago[] {
  return rendiciones
    .filter((r) => r.personaId === personaId)
    .map((r) => ({ r, st: asignacion.porRendicion.get(r.id) }))
    .filter(({ st }) => st && st.saldo > TOLERANCIA_SALDO)
    .sort((a, b) => (a.r.fecha || '').localeCompare(b.r.fecha || '') || a.r.nro - b.r.nro)
    .map(({ r, st }) => ({
      id: r.id,
      etiqueta: r.folio || `Nº ${r.nro}`,
      fecha: r.fecha,
      saldo: st!.saldo,
    }))
}

/** Monto que se propone: lo que suman las rendiciones elegidas o, si no hay, el saldo positivo. */
export function montoSugerido(
  saldoPersona: number,
  elegidas: readonly Pick<PendienteDePago, 'saldo'>[],
): number {
  if (elegidas.length) return Math.round(elegidas.reduce((s, p) => s + p.saldo, 0))
  return saldoPersona > TOLERANCIA_SALDO ? Math.round(saldoPersona) : 0
}
