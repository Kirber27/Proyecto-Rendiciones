import { describe, expect, it } from 'vitest'
import { cuadra, sumaLineas, totalLinea, totalRendicion } from '../rendicion'

describe('totalLinea', () => {
  it('factura: neto + iva + exento + otros', () => {
    expect(totalLinea({ neto: 10000, iva: 1900, exento: 500, otros: 0 })).toBe(12400)
  })
  it('boleta: el monto va en exento y acepta texto chileno', () => {
    expect(totalLinea({ exento: '70.389' })).toBe(70389)
  })
  it('línea vacía = 0', () => {
    expect(totalLinea({})).toBe(0)
  })
})

describe('totales de rendición', () => {
  const r = { lineas: [{ exento: 70389 }, { neto: '10.000', iva: '1.900' }] }

  it('suma las líneas', () => {
    expect(sumaLineas(r)).toBe(82289)
    expect(sumaLineas({})).toBe(0)
  })
  it('usa el total guardado si existe', () => {
    expect(totalRendicion({ ...r, total: 99 })).toBe(99)
    expect(totalRendicion(r)).toBe(82289)
  })
})

describe('cuadra', () => {
  it('tolera ±1 peso', () => {
    expect(cuadra(70389, 70389)).toBe(true)
    expect(cuadra(70389, 70390)).toBe(true)
    expect(cuadra(70389, 70391)).toBe(false)
  })
  it('sin total del formulario no aplica', () => {
    expect(cuadra(70389, null)).toBeNull()
  })
})
