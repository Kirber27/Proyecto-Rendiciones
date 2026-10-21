import { describe, expect, it } from 'vitest'
import type { BorradorRendicion } from '@/types/rendicion'
import {
  cuadra,
  lineaVacia,
  limpiarRendicion,
  sumaLineas,
  totalFormularioDe,
  totalLinea,
  totalRendicion,
  validarRendicion,
} from '../rendicion'

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

// ---- Validación y limpieza (2.1) ----

const PERSONA = '11111111-1111-1111-1111-111111111111'
const ctxPersona = { esTesoreria: false, personasActivas: [PERSONA] }
const ctxTesoreria = { esTesoreria: true, personasActivas: [PERSONA] }

/** Caso de prueba documentado: rendición Nº 42, boleta ISP de $70.389. */
function borrador(cambios: Partial<BorradorRendicion> = {}): BorradorRendicion {
  return {
    personaId: PERSONA,
    nro: '42',
    fecha: '2026-10-14',
    empresaId: 2,
    fondo: ' FONDOS POR RENDIR  CDA ',
    totalFormulario: '70.389',
    dudas: [],
    respaldos: [],
    lineas: [
      lineaVacia({
        tipo: 'Boleta',
        proveedor: ' ISP ',
        numero: '2026101400444231',
        exento: '70.389',
        detalle: 'CDA IMP ADEOR 07',
        subcuentaId: 40,
        cuentaId: 9,
        centroCostoId: 3,
      }),
    ],
    ...cambios,
  }
}

describe('lineaVacia', () => {
  it('crea una boleta vacía y acepta valores base', () => {
    const l = lineaVacia({ fecha: '2026-10-14', centroCostoId: 3 })
    expect(l.tipo).toBe('Boleta')
    expect(l.fecha).toBe('2026-10-14')
    expect(l.centroCostoId).toBe(3)
    expect(l.subcuentaId).toBeNull()
  })
})

describe('validarRendicion', () => {
  it('una rendición completa no tiene problemas', () => {
    expect(validarRendicion(borrador(), ctxPersona)).toEqual([])
    expect(validarRendicion(borrador(), ctxTesoreria)).toEqual([])
  })

  it('exige solicitante activo, Nº y fecha', () => {
    const p = validarRendicion(borrador({ personaId: 'otra', nro: '', fecha: '' }), ctxPersona)
    expect(p).toEqual([
      'Elige el solicitante de la lista.',
      'Falta el Nº de rendición.',
      'Falta la fecha.',
    ])
    expect(validarRendicion(borrador({ personaId: null }), ctxPersona)).toContain(
      'Elige el solicitante de la lista.',
    )
  })

  it('el Nº debe ser un entero positivo', () => {
    for (const nro of ['4a', '0', '-3', '4.5']) {
      expect(validarRendicion(borrador({ nro }), ctxPersona)).toContain(
        'El Nº de rendición debe ser un número.',
      )
    }
    expect(validarRendicion(borrador({ nro: ' 042 ' }), ctxPersona)).toEqual([])
  })

  it('cada línea necesita monto', () => {
    const d = borrador({ totalFormulario: '' })
    d.lineas.push(lineaVacia())
    expect(validarRendicion(d, ctxPersona)).toEqual(['Línea 2: falta el monto.'])
  })

  it('sin líneas no se puede enviar', () => {
    expect(validarRendicion(borrador({ lineas: [], totalFormulario: '' }), ctxPersona)).toEqual([
      'Agrega al menos un gasto.',
    ])
  })

  it('tesorería exige subcuenta y cuenta; la persona no', () => {
    const d = borrador()
    d.lineas[0]!.subcuentaId = null
    d.lineas[0]!.cuentaId = null
    expect(validarRendicion(d, ctxPersona)).toEqual([])
    expect(validarRendicion(d, ctxTesoreria)).toEqual([
      'Línea 1: elige la subcuenta.',
      'Línea 1: elige la cuenta.',
    ])
  })

  it('la suma debe cuadrar con el total del formulario (±1)', () => {
    expect(validarRendicion(borrador({ totalFormulario: '70.390' }), ctxPersona)).toEqual([])
    expect(validarRendicion(borrador({ totalFormulario: '71.000' }), ctxPersona)).toEqual([
      'La suma de los gastos no cuadra con el total del formulario.',
    ])
    expect(validarRendicion(borrador({ totalFormulario: '  ' }), ctxPersona)).toEqual([])
  })
})

describe('limpiarRendicion', () => {
  it('convierte el borrador al formato de la base', () => {
    expect(limpiarRendicion(borrador())).toEqual({
      persona_id: PERSONA,
      nro: 42,
      fecha: '2026-10-14',
      empresa_id: 2,
      fondo: 'FONDOS POR RENDIR CDA',
      total_formulario: 70389,
      lineas: [
        {
          orden: 1,
          fecha: '2026-10-14', // hereda la fecha del formulario
          tipo: 'Boleta',
          proveedor: 'ISP',
          rut: '',
          numero: '2026101400444231',
          neto: 0,
          iva: 0,
          exento: 70389,
          otros: 0,
          detalle: 'CDA IMP ADEOR 07',
          subcuenta_id: 40,
          cuenta_id: 9,
          centro_costo_id: 3,
        },
      ],
    })
  })

  it('conserva el id y la fecha propia de la línea', () => {
    const d = borrador({ id: 'abc' })
    d.lineas[0]!.fecha = '2026-10-10'
    const p = limpiarRendicion(d)
    expect(p.id).toBe('abc')
    expect(p.lineas[0]!.fecha).toBe('2026-10-10')
  })

  it('total del formulario vacío queda null', () => {
    expect(totalFormularioDe({ totalFormulario: '' })).toBeNull()
    expect(limpiarRendicion(borrador({ totalFormulario: '' })).total_formulario).toBeNull()
  })

  it('sin persona lanza error (debe validarse antes)', () => {
    expect(() => limpiarRendicion(borrador({ personaId: null }))).toThrow()
  })
})
