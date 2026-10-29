import { describe, expect, it } from 'vitest'
import { catalogosDemo } from '@/dev/catalogosDemo'
import type { BorradorRendicion } from '@/types/rendicion'
import {
  borradorNuevo,
  claveDocumento,
  cuadra,
  ivaDe,
  ivaLinea,
  lineaVacia,
  gastosConProblemas,
  limpiarRendicion,
  lineaConDatos,
  repetidosEnFormulario,
  sumaLineas,
  tieneDatos,
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

describe('borradorNuevo', () => {
  it('fecha de hoy, empresa por defecto (HGI) y una línea con su C.C.', () => {
    const d = borradorNuevo({ catalogos: catalogosDemo, personaFija: 'p-1', hoy: '2026-10-26' })
    expect(d).toMatchObject({
      personaId: 'p-1',
      nro: '',
      fecha: '2026-10-26',
      empresaId: 2,
      fondo: '',
      totalFormulario: '',
      respaldos: [],
    })
    expect(d.lineas).toEqual([lineaVacia({ fecha: '2026-10-26', centroCostoId: 3 })])
  })
  it('sin persona fija el solicitante queda vacío; sin empresas, sin empresa', () => {
    const d = borradorNuevo({ catalogos: { empresas: [] }, personaFija: null, hoy: '2026-10-26' })
    expect(d.personaId).toBeNull()
    expect(d.empresaId).toBeNull()
    expect(d.lineas[0]!.centroCostoId).toBeNull()
  })
})

describe('tieneDatos', () => {
  const vacio = () => borradorNuevo({ catalogos: catalogosDemo, personaFija: 'p-1', hoy: '2026-10-26' })
  it('un formulario recién creado no tiene datos', () => {
    expect(tieneDatos(vacio())).toBe(false)
  })
  it.each<[string, (d: BorradorRendicion) => void]>([
    ['fondo', (d) => (d.fondo = 'FONDOS POR RENDIR')],
    ['total del formulario', (d) => (d.totalFormulario = '1.000')],
    ['respaldo guardado', (d) => d.respaldos.push('p-1/r/a.jpg')],
    ['segunda línea', (d) => d.lineas.push(lineaVacia())],
    ['proveedor', (d) => (d.lineas[0]!.proveedor = 'COPEC')],
    ['proveedor de la lista', (d) => (d.lineas[0]!.proveedorId = 'pv-1')],
    ['monto', (d) => (d.lineas[0]!.exento = '15.000')],
    ['subcuenta', (d) => (d.lineas[0]!.subcuentaId = 8)],
  ])('con %s sí tiene datos', (_, cambiar) => {
    const d = vacio()
    cambiar(d)
    expect(tieneDatos(d)).toBe(true)
  })
  it('el Nº no cuenta: se llena solo al elegir el solicitante', () => {
    const d = vacio()
    d.nro = '4'
    expect(tieneDatos(d)).toBe(false)
  })
  it('espacios en blanco no cuentan', () => {
    const d = vacio()
    d.lineas[0]!.detalle = ' '
    expect(tieneDatos(d)).toBe(false)
  })
})

describe('validarRendicion', () => {
  it('una rendición completa no tiene problemas', () => {
    expect(validarRendicion(borrador(), ctxPersona)).toEqual([])
    expect(validarRendicion(borrador(), ctxTesoreria)).toEqual([])
  })

  it('exige solicitante activo y fecha', () => {
    const p = validarRendicion(borrador({ personaId: 'otra', nro: '', fecha: '' }), ctxPersona)
    expect(p).toEqual(['Elige el solicitante de la lista.', 'Falta la fecha.'])
    expect(validarRendicion(borrador({ personaId: null }), ctxPersona)).toContain(
      'Elige el solicitante de la lista.',
    )
  })

  it('Rendir gastos exige proveedor de la lista en cada línea; aprobar y el libro no', () => {
    const d = borrador() // la línea demo trae solo el texto "ISP" (como el historial)
    expect(validarRendicion(d, { ...ctxPersona, exigirProveedor: true })).toEqual([
      'Gasto 1: elige el proveedor.',
    ])
    expect(validarRendicion(d, ctxTesoreria)).toEqual([])
    d.lineas[0]!.proveedorId = 'pv-1'
    expect(validarRendicion(d, { ...ctxPersona, exigirProveedor: true })).toEqual([])
  })

  it('no valida el Nº: es correlativo y lo asigna el servidor', () => {
    expect(validarRendicion(borrador({ nro: '' }), ctxPersona)).toEqual([])
  })

  it('cada línea necesita monto', () => {
    const d = borrador({ totalFormulario: '' })
    d.lineas.push(lineaVacia())
    expect(validarRendicion(d, ctxPersona)).toEqual(['Gasto 2: falta el monto.'])
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
      'Gasto 1: elige la subcuenta.',
      'Gasto 1: elige la cuenta.',
    ])
  })

  it('Rendir gastos exige al menos un respaldo; sin el dato (libro) no se exige', () => {
    const falta = 'Adjunta al menos un respaldo: la foto del formulario o de las boletas.'
    expect(validarRendicion(borrador(), { ...ctxPersona, respaldos: 0 })).toEqual([falta])
    expect(validarRendicion(borrador(), { ...ctxPersona, respaldos: 2 })).toEqual([])
    expect(validarRendicion(borrador(), ctxTesoreria)).toEqual([])
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
          proveedor_id: null,
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

  it('Nº faltante elegido: viaja aparte en nro_faltante', () => {
    expect(limpiarRendicion(borrador()).nro_faltante).toBeUndefined()
    expect(limpiarRendicion(borrador({ nro: '4', nroFaltante: true }))).toMatchObject({
      nro: 4,
      nro_faltante: 4,
    })
    expect(limpiarRendicion(borrador({ nro: '', nroFaltante: true })).nro_faltante).toBeUndefined()
  })

  it('total del formulario vacío queda null', () => {
    expect(totalFormularioDe({ totalFormulario: '' })).toBeNull()
    expect(limpiarRendicion(borrador({ totalFormulario: '' })).total_formulario).toBeNull()
  })

  it('sin persona lanza error (debe validarse antes)', () => {
    expect(() => limpiarRendicion(borrador({ personaId: null }))).toThrow()
  })
})

// RUT FICTICIOS (calculados con el módulo 11)
describe('Nº de documento único por proveedor', () => {
  const l = (rut: string, numero: string, tipo: 'Boleta' | 'Factura' = 'Boleta') =>
    lineaVacia({ rut, numero, tipo, exento: '1.000' })

  it('claveDocumento: RUT normalizado + tipo + Nº sin importar mayúsculas ni espacios', () => {
    expect(claveDocumento(l('12.345.678-5', ' a-1 '))).toBe('12345678-5|Boleta|A-1')
    expect(claveDocumento(l('12345678-5', ''))).toBeNull()
    expect(claveDocumento(l('', '9'))).toBeNull()
  })

  it('repetidosEnFormulario: cada repetida apunta a la primera', () => {
    const r = repetidosEnFormulario([
      l('12345678-5', 'A-1'),
      l('12.345.678-5', 'a-1'),
      l('12345678-5', 'A-1', 'Factura'), // otro tipo: no repite
      l('76000000-0', 'A-1'), // otro proveedor: no repite
      l('12345678-5', 'A-1'),
    ])
    expect([...r]).toEqual([
      [1, 0],
      [4, 0],
    ])
  })

  it('validarRendicion avisa los repetidos del formulario y los marcados por la base', () => {
    const d: BorradorRendicion = {
      ...borradorNuevo({ catalogos: catalogosDemo, personaFija: 'p-1', hoy: '2026-10-27' }),
      lineas: [l('12345678-5', 'A-1'), l('12345678-5', 'A-1'), { ...l('76000000-0', 'B-2'), numeroRepetido: true }],
    }
    expect(validarRendicion(d, { esTesoreria: false, personasActivas: ['p-1'] })).toEqual([
      'Gasto 2: repite el Nº de documento del gasto 1.',
      'Gasto 3: este Nº de documento ya está cargado para este proveedor.',
    ])
  })
})

describe('IVA calculado', () => {
  it('ivaDe: neto × 19 % redondeado al peso', () => {
    expect(ivaDe(10000)).toBe(1900)
    expect(ivaDe('84.034')).toBe(15966) // 15.966,46
    expect(ivaDe('50')).toBe(10) // 9,5 sube
    expect(ivaDe('')).toBe(0)
  })
  it('ivaLinea: en Factura se calcula; en el resto es vacío', () => {
    expect(ivaLinea({ tipo: 'Factura', neto: '10.000' })).toBe('1.900')
    expect(ivaLinea({ tipo: 'Factura', neto: '' })).toBe('')
    expect(ivaLinea({ tipo: 'Boleta', neto: '10.000' })).toBe('')
    expect(ivaLinea({ tipo: 'Transferencia', neto: '10.000' })).toBe('')
  })
})

describe('gastos con problemas', () => {
  it('gastosConProblemas: índices de los mensajes "Gasto N: …"', () => {
    expect([...gastosConProblemas(['Falta la fecha.', 'Gasto 2: falta el monto.', 'Gasto 2: elige la cuenta.', 'Gasto 10: x'])]).toEqual([1, 9])
    expect(gastosConProblemas([]).size).toBe(0)
  })

  it('lineaConDatos: vacía no; con monto, proveedor o detalle sí', () => {
    expect(lineaConDatos(lineaVacia())).toBe(false)
    expect(lineaConDatos(lineaVacia({ exento: '1.000' }))).toBe(true)
    expect(lineaConDatos(lineaVacia({ proveedor: 'ISP' }))).toBe(true)
    expect(lineaConDatos(lineaVacia({ detalle: 'peaje' }))).toBe(true)
  })
})
