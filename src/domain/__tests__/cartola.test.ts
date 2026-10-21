import { describe, expect, it } from 'vitest'
import type { MovimientoCartola } from '@/types/banco'
import {
  adivinarColumnas,
  claveMovimiento,
  construirMovimientos,
  detectarEncabezados,
  resumenMovimientos,
  separarDuplicados,
} from '../cartola'
import { num, parseDate, tr } from '../formato'

// ---- Cartolas FICTICIAS en los formatos típicos ----

/** Formato 1: títulos arriba, columnas Cargo y Abono separadas, montos como texto chileno. */
const cartolaCargoAbono = [
  ['Banco Ejemplo S.A.'],
  ['Cuenta Corriente Nº 000-12345-6', '', ''],
  [],
  ['Fecha', 'Descripción', 'Nº Documento', 'Cargos ($)', 'Abonos ($)', 'Saldo'],
  ['14/10/2026', 'TRANSF A JUANA PEREZ', '000123', '70.389', '', '1.000.000'],
  ['15/10/2026', 'DEPOSITO CLIENTE', '000124', '', '250.000', '1.250.000'],
  ['', 'Saldo final', '', '', '', '1.250.000'],
  ['16/10/2026', 'COMISION MANTENCION', '', '0', '', '1.250.000'],
]

/** Formato 2: una sola columna "Monto" con signo; fechas como número serial de Excel. */
const cartolaMonto = [
  ['Fecha Operación', 'Glosa', 'Monto', 'Nº Operación'],
  [46309, 'PAGO PROVEEDOR', -15000, 'OP-1'],
  [46310, 'ABONO REMUNERACION', 120000, 'OP-2'],
]

/** Formato 3: Date reales y encabezados con "Débito/Crédito". */
const cartolaDebito = [
  ['FECHA', 'DETALLE', 'DÉBITO', 'CRÉDITO'],
  [new Date(2026, 9, 1), '  TRANSFERENCIA   A   MARIO SOTO  ', 182500, null],
]

describe('detectarEncabezados', () => {
  it('salta los títulos y toma la primera fila con "fecha"', () => {
    const r = detectarEncabezados(cartolaCargoAbono)
    expect(r.indice).toBe(3)
    expect(r.encabezados[0]).toBe('Fecha')
    expect(r.datos).toHaveLength(4)
  })
  it('sin fila con "fecha" usa la primera', () => {
    expect(
      detectarEncabezados([
        ['a', 'b'],
        [1, 2],
      ]).indice,
    ).toBe(0)
    expect(detectarEncabezados([]).encabezados).toEqual([])
  })
})

describe('adivinarColumnas', () => {
  it('formato cargo/abono', () => {
    expect(adivinarColumnas(detectarEncabezados(cartolaCargoAbono).encabezados)).toEqual({
      fecha: 0,
      descripcion: 1,
      cargo: 3,
      abono: 4,
      monto: -1,
      referencia: 2,
    })
  })
  it('formato monto con signo', () => {
    expect(adivinarColumnas(cartolaMonto[0] as string[])).toEqual({
      fecha: 0,
      descripcion: 1,
      cargo: -1,
      abono: -1,
      monto: 2,
      referencia: 3,
    })
  })
  it('débito/crédito con tildes y mayúsculas', () => {
    expect(adivinarColumnas(cartolaDebito[0] as string[])).toMatchObject({ cargo: 2, abono: 3 })
  })
  it('una columna no se asigna a dos campos', () => {
    // "Fecha movimiento" calza con fecha y con descripción: solo queda como fecha.
    expect(adivinarColumnas(['Fecha movimiento', 'Monto'])).toMatchObject({
      fecha: 0,
      descripcion: -1,
    })
  })
})

describe('construirMovimientos', () => {
  const leer = (filas: unknown[][]) => {
    const { encabezados, datos } = detectarEncabezados(filas)
    return construirMovimientos(datos, adivinarColumnas(encabezados))
  }

  it('cargo/abono: descarta filas sin fecha y sin monto', () => {
    expect(leer(cartolaCargoAbono)).toEqual<MovimientoCartola[]>([
      {
        fecha: '2026-10-14',
        descripcion: 'TRANSF A JUANA PEREZ',
        referencia: '000123',
        cargo: 70389,
        abono: 0,
      },
      {
        fecha: '2026-10-15',
        descripcion: 'DEPOSITO CLIENTE',
        referencia: '000124',
        cargo: 0,
        abono: 250000,
      },
    ])
  })

  it('monto con signo: negativo = cargo, positivo = abono', () => {
    const m = leer(cartolaMonto)
    expect(m.map((x) => [x.fecha, x.cargo, x.abono])).toEqual([
      ['2026-10-14', 15000, 0],
      ['2026-10-15', 0, 120000],
    ])
  })

  it('fechas Date, glosa limpia y montos numéricos', () => {
    expect(leer(cartolaDebito)).toEqual([
      {
        fecha: '2026-10-01',
        descripcion: 'TRANSFERENCIA A MARIO SOTO',
        referencia: '',
        cargo: 182500,
        abono: 0,
      },
    ])
  })

  it('recorta glosa a 140 y referencia a 40 caracteres', () => {
    const [m] = leer([
      ['Fecha', 'Glosa', 'Cargo', 'Referencia'],
      ['2026-10-01', 'x'.repeat(200), 100, 'r'.repeat(60)],
    ])
    expect(m!.descripcion).toHaveLength(140)
    expect(m!.referencia).toHaveLength(40)
  })
})

describe('resumen y duplicados', () => {
  const mov = (fecha: string, cargo: number, descripcion = 'TRANSF'): MovimientoCartola => ({
    fecha,
    descripcion,
    referencia: '',
    cargo,
    abono: 0,
  })

  it('resumenMovimientos', () => {
    expect(
      resumenMovimientos([
        mov('2026-10-01', 1000),
        mov('2026-10-02', 2500),
        { ...mov('2026-10-03', 0), abono: 9 },
      ]),
    ).toEqual({ movimientos: 3, cargos: 2, totalCargos: 3500, abonos: 1 })
  })

  it('la clave ignora mayúsculas, tildes y espacios de la glosa', () => {
    expect(claveMovimiento(mov('2026-10-01', 1000, 'Transf  a Pérez'))).toBe(
      claveMovimiento(mov('2026-10-01', 1000, 'TRANSF A PEREZ')),
    )
  })

  it('separa duplicados contando repeticiones', () => {
    const existentes = [mov('2026-10-01', 1000, 'ESTACIONAMIENTO'), mov('2026-10-02', 5000)]
    const nuevos = [
      mov('2026-10-01', 1000, 'ESTACIONAMIENTO'),
      mov('2026-10-01', 1000, 'ESTACIONAMIENTO'), // segundo idéntico: es nuevo
      mov('2026-10-03', 7000),
    ]
    const r = separarDuplicados(nuevos, existentes)
    expect(r.duplicados).toHaveLength(1)
    expect(r.nuevos.map((m) => m.fecha)).toEqual(['2026-10-01', '2026-10-03'])
  })
})

// ---- Paridad con el prototipo (GUESS + mapeo de leerCartola + buildMovs, copiados tal cual) ----
/* eslint-disable */
// prettier-ignore
const original = (() => {
  const GUESS: any = {f:/fecha/i, d:/descrip|glosa|detalle|concepto|movimiento/i, c:/cargo|d[eé]bito|giro|egreso|retiro/i, a:/abono|cr[eé]dito|dep[oó]sito|ingreso/i, m:/^monto|importe/i, r:/operaci|documento|n[°º.]|folio|referencia/i};
  function leer(rows: any[]){
    let hi = rows.findIndex((r: any)=>r.some((c: any)=>/fecha/i.test(String(c)))); if (hi<0) hi=0;
    const headers = rows[hi].map((x: any)=>String(x).trim());
    const map: any={}; for (const [k,re] of Object.entries(GUESS) as any){ map[k]=headers.findIndex((x: any,j: any)=>re.test(x) && !Object.values(map).includes(j)); }
    return {headers, data: rows.slice(hi+1), map};
  }
  function buildMovs(bf: any){
    const {map,data}=bf; const out=[];
    for (const r of data){
      const f=parseDate(r[map.f]); if(!f) continue;
      let c = map.c>=0? Math.abs(num(r[map.c])) : 0, a = map.a>=0? Math.abs(num(r[map.a])) : 0;
      if (map.c<0 && map.a<0 && map.m>=0){ const v=num(r[map.m]); if (v<0) c=-v; else a=v; }
      if (!c && !a) continue;
      out.push({f, d:tr(r[map.d]??"").slice(0,140), r:tr(r[map.r]??"").slice(0,40), c, a, pago:null, ign:false});
    }
    return out;
  }
  return { leer, buildMovs };
})()
/* eslint-enable */

describe('paridad con el prototipo', () => {
  it('mismas columnas y movimientos en cartolas variadas', () => {
    const encabezadosPosibles = [
      ['Fecha', 'Descripción', 'Nº Documento', 'Cargos', 'Abonos', 'Saldo'],
      ['Fecha Operación', 'Glosa', 'Monto', 'Nº Operación'],
      ['FECHA', 'DETALLE', 'DÉBITO', 'CRÉDITO'],
      ['Fecha', 'Concepto', 'Giros', 'Depósitos', 'Folio'],
      ['Fecha contable', 'Movimiento', 'Importe'],
    ]
    let semilla = 7
    const rnd = () => (semilla = (semilla * 16807) % 2147483647) / 2147483647
    const valores = [
      '14/10/2026',
      '2026-10-15',
      46310,
      '',
      'x',
      '70.389',
      '-1.500',
      2500,
      -900,
      '1.234,50',
      null,
      'TRANSF A X',
    ]
    for (const enc of encabezadosPosibles) {
      for (let caso = 0; caso < 40; caso++) {
        const filas: unknown[][] = [['Banco'], enc]
        for (let i = 0; i < 6; i++)
          filas.push(enc.map(() => valores[Math.floor(rnd() * valores.length)]))
        const o = original.leer(filas)
        const n = detectarEncabezados(filas)
        const mapa = adivinarColumnas(n.encabezados)
        expect(n.encabezados).toEqual(o.headers)
        expect([
          mapa.fecha,
          mapa.descripcion,
          mapa.cargo,
          mapa.abono,
          mapa.monto,
          mapa.referencia,
        ]).toEqual([o.map.f, o.map.d, o.map.c, o.map.a, o.map.m, o.map.r])
        const esperado = original
          .buildMovs(o)
          .map((m: { f: string; d: string; r: string; c: number; a: number }) => ({
            fecha: m.f,
            descripcion: m.d,
            referencia: m.r,
            cargo: m.c,
            abono: m.a,
          }))
        expect(construirMovimientos(n.datos, mapa)).toEqual(esperado)
      }
    }
  })
})
