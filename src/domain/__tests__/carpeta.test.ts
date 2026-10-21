import { describe, expect, it } from 'vitest'
import type { EstadoPagoRendicion } from '@/types/pagos'
import type { EventoRendicion } from '@/types/rendicion'
import {
  estadoActual,
  eventoDePago,
  filtrarCarpeta,
  gruposDeCarpeta,
  itemsCarpeta,
  ordenarCarpetas,
  ordenarEventos,
  type RendicionCarpeta,
} from '../carpeta'

const ev = (evento: string, fecha: string, nota: string | null = null): EventoRendicion => ({
  evento,
  fecha,
  nota,
})
const rend = (c: Partial<RendicionCarpeta>): RendicionCarpeta => ({
  id: 'r',
  folio: null,
  nro: 1,
  fecha: '2026-10-01',
  total: 10000,
  estado: 'en_revision',
  aprobacionAnulada: false,
  origen: 'App',
  respaldos: 0,
  notaTesoreria: null,
  eventos: [ev('Enviada', '2026-10-01T10:00:00Z')],
  ...c,
})
const pago = (c: Partial<EstadoPagoRendicion>): EstadoPagoRendicion => ({
  pagado: 0,
  saldo: 10000,
  estado: 'Pendiente de pago',
  ultimo: '',
  ...c,
})

describe('estadoActual', () => {
  it('en revisión, reenviada y aprobación anulada', () => {
    expect(estadoActual(rend({}))).toBe('En revisión')
    expect(estadoActual(rend({ aprobacionAnulada: true }))).toBe('Aprobación anulada')
    // Caso que el prototipo mostraba como "Observada": observada y luego corregida y reenviada.
    const reenviada = rend({
      eventos: [
        ev('Reenviada', '2026-10-05T09:00:00Z'),
        ev('Enviada', '2026-10-01T10:00:00Z'),
        ev('Observada', '2026-10-02T12:00:00Z', 'Falta la boleta del taxi'),
      ],
    })
    expect(estadoActual(reenviada)).toBe('Reenviada')
  })

  it('observada, rechazada y eliminada salen del estado guardado', () => {
    expect(estadoActual(rend({ estado: 'observada' }))).toBe('Observada')
    expect(estadoActual(rend({ estado: 'rechazada' }))).toBe('Rechazada')
    expect(estadoActual(rend({ estado: 'eliminada' }))).toBe('Eliminada')
  })

  it('aprobada muestra el estado de pago', () => {
    const r = rend({ estado: 'aprobada' })
    expect(estadoActual(r, pago({}))).toBe('Pendiente de pago')
    expect(estadoActual(r, pago({ estado: 'Pago parcial' }))).toBe('Pago parcial')
    expect(estadoActual(r, pago({ estado: 'Pagada' }))).toBe('Pagada')
    expect(estadoActual(r, pago({ estado: 'Sin monto' }))).toBe('Aprobada')
    expect(
      estadoActual(
        rend({ estado: 'aprobada', origen: 'Histórico' }),
        pago({ estado: 'Sin monto' }),
      ),
    ).toBe('Ingresada (historial)')
  })
})

describe('eventos', () => {
  it('se ordenan por fecha; los sin fecha van al final', () => {
    const r = ordenarEventos([
      ev('B', ''),
      ev('C', '2026-10-03'),
      ev('A', '2026-10-01T08:00:00Z'),
      ev('D', ''),
    ])
    expect(r.map((e) => e.evento)).toEqual(['A', 'C', 'B', 'D'])
  })

  it('evento de pago con su nota', () => {
    expect(
      eventoDePago(pago({ estado: 'Pagada', pagado: 10000, saldo: 0, ultimo: '2026-10-20' })),
    ).toEqual({
      evento: 'Pagada',
      fecha: '2026-10-20',
      nota: 'Pagado $ 10.000',
    })
    expect(
      eventoDePago(
        pago({ estado: 'Pago parcial', pagado: 4000, saldo: 6000, ultimo: '2026-10-18' }),
      )!.nota,
    ).toBe('Pagado $ 4.000 · falta $ 6.000')
    expect(eventoDePago(pago({}))).toEqual({
      evento: 'Pendiente de pago',
      fecha: '',
      nota: 'Falta $ 10.000',
    })
    expect(eventoDePago(pago({ estado: 'Sin monto' }))).toBeNull()
  })
})

describe('itemsCarpeta', () => {
  const rendiciones = [
    rend({
      id: 'a',
      nro: 1,
      fecha: '2026-09-01',
      estado: 'aprobada',
      folio: 'JPE-001',
      eventos: [ev('Aprobada', '2026-09-02')],
    }),
    rend({
      id: 'b',
      nro: 2,
      fecha: '2026-10-01',
      estado: 'observada',
      notaTesoreria: 'Falta la boleta del taxi',
      respaldos: 2,
    }),
    rend({ id: 'c', nro: 3, fecha: '2026-10-01' }),
    rend({ id: 'd', nro: 4, fecha: '2026-08-01', estado: 'eliminada', folio: 'JPE-004' }),
  ]
  const pagos = new Map([
    ['a', pago({ estado: 'Pagada', pagado: 10000, saldo: 0, ultimo: '2026-09-10' })],
  ])
  const items = itemsCarpeta(rendiciones, pagos)

  it('ordena de la más reciente a la más antigua (y por Nº)', () => {
    expect(items.map((i) => i.id)).toEqual(['c', 'b', 'a', 'd'])
  })

  it('arma etiqueta, estado, grupo y línea de tiempo', () => {
    const [c, b, a, d] = items
    expect(c).toMatchObject({
      etiqueta: 'Envío 003',
      actual: 'En revisión',
      grupo: 'En revisión',
      puedeCorregir: false,
    })
    expect(b).toMatchObject({
      actual: 'Observada',
      grupo: 'Observadas o rechazadas',
      puedeCorregir: true,
      notaTesoreria: 'Falta la boleta del taxi',
      respaldos: 2,
    })
    expect(a).toMatchObject({ etiqueta: 'JPE-001', actual: 'Pagada', grupo: 'Pagadas' })
    expect(a!.eventos.map((e) => e.evento)).toEqual(['Aprobada', 'Pagada'])
    expect(d).toMatchObject({ actual: 'Eliminada', grupo: 'Eliminadas' })
  })

  it('una rendición no aprobada no agrega evento de pago aunque tenga datos de pago', () => {
    const r = itemsCarpeta([rend({ id: 'x' })], new Map([['x', pago({ estado: 'Pagada' })]]))
    expect(r[0]!.eventos.map((e) => e.evento)).toEqual(['Enviada'])
  })

  it('grupos con conteo: Eliminadas solo si hay', () => {
    expect(gruposDeCarpeta(items)).toEqual([
      { grupo: 'En revisión', cantidad: 1 },
      { grupo: 'Observadas o rechazadas', cantidad: 1 },
      { grupo: 'Por pagar', cantidad: 0 },
      { grupo: 'Pagadas', cantidad: 1 },
      { grupo: 'Eliminadas', cantidad: 1 },
    ])
    expect(
      gruposDeCarpeta(items.filter((i) => i.grupo !== 'Eliminadas')).map((g) => g.grupo),
    ).not.toContain('Eliminadas')
  })

  it('filtro por casillas: sin selección muestra todas', () => {
    expect(filtrarCarpeta(items, new Set())).toHaveLength(4)
    expect(
      filtrarCarpeta(items, new Set(['Pagadas', 'En revisión'] as const)).map((i) => i.id),
    ).toEqual(['c', 'a'])
  })
})

describe('ordenarCarpetas', () => {
  const carpetas = [
    { personaId: '1', nombre: 'Laura Rojas', rendiciones: 3, porAprobar: 0, saldo: 0 },
    { personaId: '2', nombre: 'Mario Soto', rendiciones: 10, porAprobar: 0, saldo: 5000 },
    { personaId: '3', nombre: 'Juana Pérez', rendiciones: 1, porAprobar: 2, saldo: 0 },
    { personaId: '4', nombre: 'Ana Muñoz', rendiciones: 3, porAprobar: 0, saldo: 0 },
  ]
  it('más por aprobar, luego más rendiciones, luego nombre', () => {
    expect(ordenarCarpetas(carpetas).map((c) => c.personaId)).toEqual(['3', '2', '4', '1'])
  })
  it('busca por nombre sin tildes', () => {
    expect(ordenarCarpetas(carpetas, 'perez').map((c) => c.nombre)).toEqual(['Juana Pérez'])
    expect(ordenarCarpetas(carpetas, 'MUNOZ')).toHaveLength(1)
  })
})
