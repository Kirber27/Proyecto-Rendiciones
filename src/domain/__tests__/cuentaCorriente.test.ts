import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { TipoPago } from '@/types/pagos'
import { asignarPagos } from '../asignacion'
import {
  movimientosPersona,
  ordenarPorSaldo,
  resumenPersonas,
  situacionPersona,
  type PagoCC,
  type RendicionCC,
} from '../cuentaCorriente'
import { norm } from '../formato'

// Datos ficticios
const rends: RendicionCC[] = [
  { id: 'r2', folio: 'JPE-002', personaId: 'A', nro: 2, fecha: '2026-02-10', total: 20000 },
  { id: 'r1', folio: 'JPE-001', personaId: 'A', nro: 1, fecha: '2026-01-15', total: 30000 },
  { id: 'r3', folio: null, personaId: 'A', nro: 3, fecha: '2026-02-10', total: 5000 },
  { id: 'rb', folio: 'MSO-001', personaId: 'B', nro: 1, fecha: '2026-01-01', total: 7000 },
]
const pago = (
  id: string,
  fecha: string,
  monto: number,
  extra: Partial<PagoCC> = {},
  tipo: TipoPago = 'Pago',
): PagoCC => ({ id, personaId: 'A', fecha, monto, tipo, rendicionIds: [], ...extra })
const pagos: PagoCC[] = [
  pago('p2', '2026-02-10', 10000, {
    medioPago: 'Banco Internacional HGI ',
    rendicionIds: ['r2'],
    movimientoId: 'mov-1',
  }),
  pago(
    'p1',
    '2026-01-05',
    25000,
    { medioPago: 'Cash CLP', descripcion: 'Anticipo viaje' },
    'Anticipo',
  ),
]

describe('movimientosPersona', () => {
  const a = asignarPagos(rends, pagos)
  const movs = movimientosPersona('A', rends, pagos, a)

  it('ordena por fecha y, en la misma fecha, rendiciones antes que pagos', () => {
    expect(movs.map((m) => m.id)).toEqual(['p1', 'r1', 'r2', 'r3', 'p2'])
  })

  it('lleva el saldo acumulado (rendido suma, pagado resta)', () => {
    expect(movs.map((m) => m.saldo)).toEqual([-25000, 5000, 25000, 30000, 20000])
    expect(movs.at(-1)!.saldo).toBe(a.porPersona.get('A')!.saldo)
  })

  it('arma el detalle como el prototipo', () => {
    expect(movs.find((m) => m.id === 'r1')!.detalle).toBe('JPE-001 · Nº 1')
    expect(movs.find((m) => m.id === 'r3')!.detalle).toBe('r3 · Nº 3') // sin folio, usa el id
    expect(movs.find((m) => m.id === 'p1')!.detalle).toBe('Cash CLP · Anticipo viaje')
    expect(movs.find((m) => m.id === 'p2')!.detalle).toBe('Banco Internacional HGI · JPE-002')
  })

  it('las rendiciones traen su estado de pago y los pagos si se pueden eliminar', () => {
    const r1 = movs.find((m) => m.id === 'r1')!
    const p1 = movs.find((m) => m.id === 'p1')!
    const p2 = movs.find((m) => m.id === 'p2')!
    expect(r1.clase === 'rendicion' && r1.estado).toBe('Pago parcial') // 25.000 del anticipo FIFO
    expect(p1.clase === 'pago' && p1.eliminable).toBe(true)
    expect(p2.clase === 'pago' && p2.eliminable).toBe(false) // viene de cartola
  })

  it('solo incluye a la persona pedida', () => {
    expect(movimientosPersona('B', rends, pagos, a).map((m) => m.id)).toEqual(['rb'])
    expect(movimientosPersona('Z', rends, pagos, a)).toEqual([])
  })

  it('los pagos sin fecha van primero (como el prototipo)', () => {
    const conVacio = [...pagos, pago('p0', '', 1000)]
    const m = movimientosPersona('A', rends, conVacio, asignarPagos(rends, conVacio))
    expect(m[0]!.id).toBe('p0')
  })
})

describe('situación y resumen', () => {
  const a = asignarPagos(rends, pagos)

  it('situacionPersona', () => {
    expect(situacionPersona({ personaId: 'A', saldo: 20000 }, rends, a)).toEqual({
      tipo: 'por-pagar',
      texto: 'Por pagar · 3 rend.',
      pendientes: 3,
    })
    expect(situacionPersona({ personaId: 'A', saldo: -5000 }, rends, a).texto).toBe(
      'Pendiente por rendir',
    )
    expect(situacionPersona({ personaId: 'A', saldo: 0.6 }, rends, a).texto).toBe('Al día')
  })

  it('resumenPersonas y orden por |saldo|', () => {
    const cuentas = [
      { saldo: 100 },
      { saldo: -471991 },
      { saldo: 202214 },
      { saldo: 0.4 },
      { saldo: -2 },
    ] as Parameters<typeof resumenPersonas>[0] extends Iterable<infer T> ? T[] : never
    expect(resumenPersonas(cuentas)).toEqual({
      empresaDebe: 202314,
      fondosPorRendir: 471993,
      conSaldo: 4,
    })
    expect(ordenarPorSaldo(cuentas).map((c) => c.saldo)).toEqual([-471991, 202214, 100, -2, 0.4])
  })
})

// Historial 2026: el saldo final de cada cuenta corriente = rendido − pagado de la persona.
const dir = 'CLAUDE/datos/historial_2026'
describe.skipIf(!existsSync(dir))('historial 2026', () => {
  it('cada cuenta corriente termina en el saldo de la persona y el resumen cuadra', () => {
    const rs: RendicionCC[] = []
    const ps: PagoCC[] = []
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
      for (const op of JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'))) {
        const d = op.data
        if (op.collection === 'rendiciones')
          rs.push({
            id: op.doc_id,
            folio: op.doc_id,
            personaId: norm(d.solicitante),
            nro: d.nro,
            fecha: d.fecha,
            total: d.total,
          })
        else
          ps.push({
            id: op.doc_id,
            personaId: norm(d.solicitante),
            fecha: d.fecha,
            monto: d.monto,
            tipo: d.tipo,
            rendicionIds: d.rends,
            medioPago: d.banco,
          })
      }
    }
    const a = asignarPagos(rs, ps)
    for (const c of a.porPersona.values()) {
      const movs = movimientosPersona(c.personaId, rs, ps, a)
      expect(movs.at(-1)!.saldo).toBeCloseTo(c.saldo, 6)
    }
    const r = resumenPersonas(a.porPersona.values())
    // Los saldos traen decimales: la suma puede diferir en $1 de la suma de los redondeados.
    expect(Math.abs(r.empresaDebe - (202214 + 188980 + 71188 + 5072))).toBeLessThanOrEqual(1)
    expect(Math.abs(r.fondosPorRendir - (471991 + 17220))).toBeLessThanOrEqual(1)
    expect(r.conSaldo).toBe(6)
  })
})
