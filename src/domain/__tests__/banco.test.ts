import { describe, expect, it } from 'vitest'
import type { MovimientoGuardado } from '@/types/banco'
import {
  asignacionDePropuesta,
  cargosResueltos,
  leerEleccionManual,
  movimientosParaConciliar,
  resumenCartolas,
} from '../banco'

// Movimientos FICTICIOS
const mov = (c: Partial<MovimientoGuardado>): MovimientoGuardado => ({
  id: 'm',
  cartolaId: 'c1',
  idx: 0,
  fecha: '2026-10-01',
  descripcion: 'TRANSF',
  referencia: '',
  cargo: 1000,
  abono: 0,
  ignorado: false,
  ...c,
})
const movs = [
  mov({ id: 'm1', idx: 0, fecha: '2026-10-01' }),
  mov({ id: 'm2', idx: 1, fecha: '2026-10-02', ignorado: true }),
  mov({ id: 'm3', idx: 2, fecha: '2026-10-03' }),
  mov({ id: 'm4', idx: 3, cargo: 0, abono: 5000 }),
  mov({ id: 'm5', cartolaId: 'c2', idx: 0, fecha: '2026-10-05' }),
]

describe('banco', () => {
  const conEstado = movimientosParaConciliar(movs, [{ movimientoId: 'm3' }, { movimientoId: null }])

  it('movimientosParaConciliar marca los que tienen pago', () => {
    expect(conEstado.filter((m) => m.asignado).map((m) => m.id)).toEqual(['m3'])
  })

  it('resumenCartolas: movimientos, cargos y conciliados (asignados o ignorados)', () => {
    const r = resumenCartolas(
      [
        { id: 'c1', nombreArchivo: 'a.xlsx', medioPagoId: 2, creadoEn: '2026-10-10T10:00:00Z' },
        { id: 'c2', nombreArchivo: 'b.csv', medioPagoId: 1, creadoEn: '2026-10-20T10:00:00Z' },
      ],
      conEstado,
    )
    expect(r.map((c) => [c.nombreArchivo, c.movimientos, c.cargos, c.conciliados])).toEqual([
      ['b.csv', 1, 1, 0],
      ['a.xlsx', 4, 3, 2],
    ])
  })

  it('cargosResueltos: asignados o ignorados, del más nuevo al más antiguo', () => {
    expect(cargosResueltos(conEstado).map((m) => m.id)).toEqual(['m3', 'm2'])
  })

  it('asignacionDePropuesta', () => {
    const m = { ...conEstado[0]!, asignado: false }
    expect(
      asignacionDePropuesta({
        movimiento: m,
        tipo: 'pago-existente',
        pagoId: 'p',
        confianza: 'Pago ya registrado · nombre',
        marcada: true,
      }),
    ).toEqual({ movimientoId: 'm1', tipo: 'pago', pagoId: 'p' })
    expect(
      asignacionDePropuesta({
        movimiento: m,
        tipo: 'rendiciones',
        rendicionIds: ['r1', 'r2'],
        confianza: 'Varias rendiciones · nombre',
        marcada: true,
      }),
    ).toEqual({ movimientoId: 'm1', tipo: 'rendiciones', rendicionIds: ['r1', 'r2'] })
  })

  it('leerEleccionManual', () => {
    expect(leerEleccionManual('m', 'x')).toBe('ignorar')
    expect(leerEleccionManual('m', 'r:r1')).toEqual({
      movimientoId: 'm',
      tipo: 'rendiciones',
      rendicionIds: ['r1'],
    })
    expect(leerEleccionManual('m', 'a:p-1')).toEqual({
      movimientoId: 'm',
      tipo: 'anticipo',
      personaId: 'p-1',
    })
    expect(leerEleccionManual('m', '')).toBeNull()
  })
})
