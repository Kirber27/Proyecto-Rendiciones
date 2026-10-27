import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { PagoParaAsignar, RendicionParaPago, TipoPago } from '@/types/pagos'
import { asignarPagos, estadoPago, faltantesCorrelativo } from '../asignacion'
import { norm } from '../formato'

// ---------- helpers ----------
const R = (
  id: string,
  nro: number,
  fecha: string,
  total: number,
  personaId = 'A',
): RendicionParaPago => ({
  id,
  personaId,
  nro,
  fecha,
  total,
})
const P = (
  id: string,
  fecha: string,
  monto: number,
  rendicionIds: string[] = [],
  tipo: TipoPago = 'Pago',
  personaId = 'A',
): PagoParaAsignar => ({ id, personaId, fecha, monto, tipo, rendicionIds })

describe('estadoPago', () => {
  it('clasifica con las tolerancias del prototipo', () => {
    expect(estadoPago(0, 0)).toBe('Sin monto')
    expect(estadoPago(0.4, 0)).toBe('Sin monto')
    expect(estadoPago(1000, 999)).toBe('Pagada')
    expect(estadoPago(1000, 998)).toBe('Pago parcial')
    expect(estadoPago(1000, 0.5)).toBe('Pendiente de pago')
    expect(estadoPago(1000, 0)).toBe('Pendiente de pago')
  })
})

describe('faltantesCorrelativo', () => {
  it('lista los Nº que faltan entre 1 y el máximo', () => {
    expect(faltantesCorrelativo([1, 2, 5, 3])).toEqual({ max: 5, faltantes: [4] })
    expect(faltantesCorrelativo([])).toEqual({ max: 0, faltantes: [] })
    expect(faltantesCorrelativo([0, 2])).toEqual({ max: 2, faltantes: [1] })
  })
})

describe('asignarPagos', () => {
  it('pago vinculado exacto deja la rendición pagada con su fecha', () => {
    const a = asignarPagos(
      [R('A-001', 1, '2026-01-05', 50000)],
      [P('p1', '2026-01-10', 50000, ['A-001'])],
    )
    expect(a.porRendicion.get('A-001')).toEqual({
      pagado: 50000,
      saldo: 0,
      estado: 'Pagada',
      ultimo: '2026-01-10',
    })
    expect(a.porPersona.get('A')).toMatchObject({ rendido: 50000, pagado: 50000, saldo: 0 })
  })

  it('pago agrupado vinculado a 2 rendiciones las cubre en orden', () => {
    const a = asignarPagos(
      [R('A-001', 1, '2026-01-05', 30000), R('A-002', 2, '2026-01-06', 20000)],
      [P('p1', '2026-01-10', 45000, ['A-001', 'A-002'])],
    )
    expect(a.porRendicion.get('A-001')!.estado).toBe('Pagada')
    expect(a.porRendicion.get('A-002')).toMatchObject({
      pagado: 15000,
      saldo: 5000,
      estado: 'Pago parcial',
    })
  })

  it('anticipo sin vínculo paga desde la más antigua (FIFO)', () => {
    const a = asignarPagos(
      [
        R('A-002', 2, '2026-02-01', 10000),
        R('A-001', 1, '2026-01-01', 10000),
        R('A-003', 3, '2026-03-01', 10000),
      ],
      [P('p1', '2025-12-20', 15000, [], 'Anticipo')],
    )
    expect(a.porRendicion.get('A-001')).toMatchObject({ estado: 'Pagada', ultimo: '2025-12-20' })
    expect(a.porRendicion.get('A-002')).toMatchObject({ pagado: 5000, estado: 'Pago parcial' })
    expect(a.porRendicion.get('A-003')!.estado).toBe('Pendiente de pago')
    expect(a.porPersona.get('A')).toMatchObject({
      rendido: 30000,
      pagado: 15000,
      saldo: 15000,
      anticipos: 15000,
    })
  })

  it('el sobrante de un pago vinculado pasa al pozo', () => {
    const a = asignarPagos(
      [R('A-001', 1, '2026-01-01', 10000), R('A-002', 2, '2026-01-02', 10000)],
      [P('p1', '2026-01-15', 20000, ['A-002'])],
    )
    expect(a.porRendicion.get('A-002')!.estado).toBe('Pagada')
    expect(a.porRendicion.get('A-001')!.estado).toBe('Pagada')
  })

  it('una devolución de la persona resta del pozo y del pagado', () => {
    const a = asignarPagos(
      [R('A-001', 1, '2026-01-01', 10000)],
      [
        P('p1', '2026-01-01', 30000, [], 'Anticipo'),
        P('p2', '2026-01-20', -20000, [], 'Devolución de la persona'),
      ],
    )
    expect(a.porRendicion.get('A-001')!.estado).toBe('Pagada')
    expect(a.porPersona.get('A')).toMatchObject({ pagado: 10000, saldo: 0 })
  })

  it('saldo negativo = fondos por rendir', () => {
    const a = asignarPagos(
      [R('A-001', 1, '2026-01-01', 10000)],
      [P('p1', '2026-01-01', 50000, [], 'Anticipo')],
    )
    expect(a.porPersona.get('A')!.saldo).toBe(-40000)
    expect(a.porRendicion.get('A-001')!.estado).toBe('Pagada')
  })

  it('rendición sin monto y persona solo con pagos', () => {
    const a = asignarPagos(
      [R('A-001', 1, '2026-01-01', 0)],
      [P('p1', '2026-01-01', 5000, [], 'Anticipo', 'B')],
    )
    expect(a.porRendicion.get('A-001')!.estado).toBe('Sin monto')
    expect(a.porPersona.get('B')).toMatchObject({
      rendido: 0,
      pagado: 5000,
      saldo: -5000,
      n: 0,
      max: 0,
    })
  })

  it('cada persona tiene su propio pozo', () => {
    const a = asignarPagos(
      [R('A-001', 1, '2026-01-01', 10000, 'A'), R('B-001', 1, '2026-01-01', 10000, 'B')],
      [P('p1', '2026-01-02', 10000, [], 'Pago', 'A')],
    )
    expect(a.porRendicion.get('A-001')!.estado).toBe('Pagada')
    expect(a.porRendicion.get('B-001')!.estado).toBe('Pendiente de pago')
  })

  it('un vínculo a una rendición de otra persona se ignora (va al pozo propio)', () => {
    const a = asignarPagos(
      [R('A-001', 1, '2026-01-01', 10000, 'A'), R('B-001', 1, '2026-01-01', 10000, 'B')],
      [P('p1', '2026-01-02', 10000, ['B-001'], 'Pago', 'A')],
    )
    expect(a.porRendicion.get('B-001')!.estado).toBe('Pendiente de pago')
    expect(a.porRendicion.get('A-001')!.estado).toBe('Pagada')
  })

  it('cuenta el correlativo y sus faltantes', () => {
    const a = asignarPagos([R('A-001', 1, '2026-01-01', 1), R('A-004', 4, '2026-01-02', 1)], [])
    expect(a.porPersona.get('A')).toMatchObject({ n: 2, max: 4, faltantes: [2, 3] })
  })
})

// ---------- Paridad con alloc() del prototipo (copiado tal cual, con S como parámetro) ----------
/* eslint-disable */
// prettier-ignore
function allocOriginal(S: any){
  const T = (r: any) => r.total;
  const st: any = {}; S.rends.forEach((r: any)=>st[r._id]={pagado:0, ultimo:""});
  const byP: any = {};
  for (const r of S.rends) (byP[norm(r.solicitante)] ||= {rends:[],pagos:[]}).rends.push(r);
  for (const p of S.pagos) (byP[norm(p.solicitante)] ||= {rends:[],pagos:[]}).pagos.push(p);
  const per: any = {};
  for (const [k,g] of Object.entries(byP) as any){
    const rs = g.rends.slice().sort((a: any,b: any)=>(a.fecha||"").localeCompare(b.fecha||"")||a.nro-b.nro);
    let pool = 0;
    for (const p of g.pagos.slice().sort((a: any,b: any)=>(a.fecha||"").localeCompare(b.fecha||""))){
      let m = p.monto||0;
      for (const id of (p.rends||[])){ const r=rs.find((x: any)=>x._id===id); if(!r) continue; const need=T(r)-st[id].pagado; const a=Math.max(0,Math.min(need,m)); st[id].pagado+=a; m-=a; if(a>0) st[id].ultimo=p.fecha||st[id].ultimo; }
      pool += m;
    }
    for (const r of rs){ const need=T(r)-st[r._id].pagado; if (need>0.5 && pool>0.5){ const a=Math.min(need,pool); st[r._id].pagado+=a; pool-=a; } }
    const rendido = rs.reduce((s: any,r: any)=>s+T(r),0), pagado = g.pagos.reduce((s: any,p: any)=>s+(p.monto||0),0);
    const nros = rs.map((r: any)=>r.nro).filter((n: any)=>n>0); const max = nros.length?Math.max(...nros):0;
    const falt=[]; for(let i=1;i<=max;i++) if(!nros.includes(i)) falt.push(i);
    per[k] = {rendido, pagado, saldo: rendido-pagado, n: rs.length, max, falt,
      anticipos: g.pagos.filter((p: any)=>p.tipo==="Anticipo").reduce((s: any,p: any)=>s+p.monto,0)};
  }
  for (const r of S.rends){ const s=st[r._id]; const t=T(r); s.estado = t<=0.5 ? "Sin monto" : s.pagado>=t-1 ? "Pagada" : s.pagado>0.5 ? "Pago parcial" : "Pendiente de pago"; s.saldo=t-s.pagado; }
  return {st, per};
}
/* eslint-enable */
/* eslint-disable @typescript-eslint/no-explicit-any -- los datos de paridad tienen la forma sin tipos del prototipo */

/** Corre ambas versiones sobre los mismos datos (formato del prototipo) y compara. */
function compararConOriginal(S: { rends: any[]; pagos: any[] }) {
  const orig = allocOriginal(S)
  const nuevo = asignarPagos(
    S.rends.map((r) => ({
      id: r._id,
      personaId: norm(r.solicitante),
      nro: r.nro,
      fecha: r.fecha,
      total: r.total,
    })),
    S.pagos.map((p) => ({
      id: p._id,
      personaId: norm(p.solicitante),
      fecha: p.fecha,
      monto: p.monto,
      tipo: p.tipo,
      rendicionIds: p.rends,
    })),
  )
  for (const r of S.rends) {
    const o = orig.st[r._id]
    const n = nuevo.porRendicion.get(r._id)!
    expect(n.pagado).toBeCloseTo(o.pagado, 6)
    expect(n.saldo).toBeCloseTo(o.saldo, 6)
    expect(n.estado).toBe(o.estado)
    if (o.ultimo) expect(n.ultimo).toBe(o.ultimo) // donde el original tenía fecha, debe ser la misma
  }
  for (const [k, o] of Object.entries<any>(orig.per)) {
    const n = nuevo.porPersona.get(k)!
    expect(n.rendido).toBeCloseTo(o.rendido, 6)
    expect(n.pagado).toBeCloseTo(o.pagado, 6)
    expect(n.saldo).toBeCloseTo(o.saldo, 6)
    expect(n.anticipos).toBeCloseTo(o.anticipos, 6)
    expect([n.n, n.max, n.faltantes]).toEqual([o.n, o.max, o.falt])
  }
  return nuevo
}

/** Generador pseudoaleatorio con semilla (mulberry32), para escenarios reproducibles. */
function azar(semilla: number) {
  let a = semilla
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('paridad con alloc() del prototipo', () => {
  it('200 escenarios aleatorios dan el mismo resultado', () => {
    const rnd = azar(42)
    const ent = (n: number) => Math.floor(rnd() * n)
    const fecha = () =>
      rnd() < 0.08
        ? ''
        : `2026-${String(1 + ent(12)).padStart(2, '0')}-${String(1 + ent(28)).padStart(2, '0')}`
    for (let caso = 0; caso < 200; caso++) {
      const personas = ['Ana Uno', 'Beto Dos', 'Carla Tres'].slice(0, 1 + ent(3))
      const rends: any[] = []
      personas.forEach((sol, pi) => {
        for (let i = 0, n = ent(8); i < n; i++) {
          const nro = 1 + ent(10)
          rends.push({
            _id: `${pi}-${i}`,
            solicitante: sol,
            nro,
            fecha: fecha() || '2026-06-01',
            total: rnd() < 0.05 ? 0 : 1000 * (1 + ent(200)) + (rnd() < 0.2 ? 0.5 : 0),
          })
        }
      })
      const pagos: any[] = []
      for (let i = 0, n = ent(10); i < n; i++) {
        const sol = personas[ent(personas.length)]!
        const propias = rends.filter((r) => r.solicitante === sol)
        const vinc = propias.filter(() => rnd() < 0.3).map((r) => r._id)
        if (rnd() < 0.1 && rends.length) vinc.push(rends[ent(rends.length)]._id) // vínculo cruzado
        const tipo: TipoPago =
          rnd() < 0.1 ? 'Devolución de la persona' : rnd() < 0.3 ? 'Anticipo' : 'Pago'
        const monto = (tipo === 'Devolución de la persona' ? -1 : 1) * 1000 * (1 + ent(250))
        pagos.push({
          _id: `p${i}`,
          solicitante: sol,
          fecha: fecha(),
          monto,
          tipo,
          rends: tipo === 'Pago' ? vinc : [],
        })
      }
      compararConOriginal({ rends, pagos })
    }
  })

  // Historial 2026 real, leído desde los lotes del prototipo (no se copia al repo de tests).
  const dir = 'CLAUDE/datos/historial_2026'
  it.skipIf(!existsSync(dir))('historial 2026: totales, saldos documentados y paridad', () => {
    const rends: any[] = []
    const pagos: any[] = []
    for (const f of readdirSync(dir)
      .filter((x) => x.endsWith('.json'))
      .sort()) {
      for (const op of JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'))) {
        if (op.collection === 'rendiciones') rends.push({ _id: op.doc_id, ...op.data })
        else pagos.push({ _id: op.doc_id, ...op.data })
      }
    }
    expect(rends).toHaveLength(182)
    expect(pagos).toHaveLength(174)

    const a = compararConOriginal({ rends, pagos })
    const cuentas = [...a.porPersona.values()]
    expect(Math.round(cuentas.reduce((s, c) => s + c.rendido, 0))).toBe(45024174)
    expect(Math.round(cuentas.reduce((s, c) => s + c.pagado, 0))).toBe(45045931)

    // Saldos al cargar el historial (CLAUDE/CLAUDE.md §9); el resto, al día.
    const esperados: Record<string, number> = {
      'dailin arellano': -471991,
      'raul diaz': -17220,
      'abel kottwitz': 202214,
      'tomas castro': 188980,
      'brigitte moran mesa': 71188,
      'pia cotronea': 5072,
    }
    for (const c of cuentas) {
      const esperado = esperados[c.personaId]
      if (esperado != null) expect(Math.round(c.saldo)).toBe(esperado)
      else expect(Math.abs(c.saldo)).toBeLessThanOrEqual(1)
    }
    // Correlativo de David Herce: en el historial (máx. Nº 35) faltan 20, 21, 27 y 28.
    expect(a.porPersona.get('david herce')!.faltantes).toEqual([20, 21, 27, 28])
    // Con la DHE-042 aprobada en la app aparecen además 36 a 41 (lo documentado en CLAUDE.md §9).
    const conDhe042 = asignarPagos(
      [
        ...rends.map((r) => ({
          id: r._id,
          personaId: norm(r.solicitante),
          nro: r.nro,
          fecha: r.fecha,
          total: r.total,
        })),
        { id: 'DHE-042', personaId: 'david herce', nro: 42, fecha: '2026-10-14', total: 70389 },
      ],
      [],
    )
    expect(conDhe042.porPersona.get('david herce')!.faltantes).toEqual([
      20, 21, 27, 28, 36, 37, 38, 39, 40, 41,
    ])
  })
})
