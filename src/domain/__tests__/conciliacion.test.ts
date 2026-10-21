import { describe, expect, it } from 'vitest'
import type { RendicionParaPago, TipoPago } from '@/types/pagos'
import { asignarPagos } from '../asignacion'
import {
  candidatas,
  coincidenciaNombre,
  personasParaAnticipo,
  proponer,
  type MovimientoParaConciliar,
  type PagoParaConciliar,
} from '../conciliacion'
import { dnum, norm } from '../formato'

// Personas FICTICIAS
const nombres = new Map([
  ['A', 'Juana Pérez Soto'],
  ['B', 'Mario Rojas'],
  ['C', 'Laura Rojas'],
])
const R = (
  id: string,
  personaId: string,
  fecha: string,
  total: number,
  nro = 1,
): RendicionParaPago => ({
  id,
  personaId,
  nro,
  fecha,
  total,
})
const M = (
  id: string,
  fecha: string,
  cargo: number,
  descripcion = 'TRANSFERENCIA',
): MovimientoParaConciliar => ({
  id,
  fecha,
  descripcion,
  referencia: '',
  cargo,
  abono: 0,
  asignado: false,
  ignorado: false,
})
const P = (
  id: string,
  personaId: string,
  fecha: string,
  monto: number,
  extra: Partial<PagoParaConciliar> = {},
): PagoParaConciliar => ({
  id,
  personaId,
  fecha,
  monto,
  tipo: 'Pago',
  rendicionIds: [],
  movimientoId: null,
  ...extra,
})

function correr(
  movimientos: MovimientoParaConciliar[],
  rendiciones: RendicionParaPago[],
  pagos: PagoParaConciliar[] = [],
) {
  return proponer({
    movimientos,
    rendiciones,
    pagos,
    asignacion: asignarPagos(rendiciones, pagos),
    nombres,
  })
}

describe('coincidenciaNombre', () => {
  it('cuenta palabras de 4+ letras del nombre presentes en la glosa', () => {
    expect(coincidenciaNombre('Juana Pérez Soto', 'TRANSF A JUANA PEREZ')).toBe(2)
    expect(coincidenciaNombre('Juana Pérez Soto', 'TRANSF A SOTO')).toBe(1)
    expect(coincidenciaNombre('Juana Pérez Soto', 'TRANSF A JUAN')).toBe(0) // "juana" no está en "juan"
    expect(coincidenciaNombre('Ana Li', 'ANA LI')).toBe(0) // palabras de menos de 4 letras no cuentan
  })
})

describe('proponer', () => {
  it('nivel 1: pago ya registrado con nombre en la glosa', () => {
    const r = correr(
      [M('m1', '2026-10-10', 50000, 'TRANSF MARIO ROJAS')],
      [R('rB', 'B', '2026-10-01', 50000)],
      [P('pB', 'B', '2026-10-08', 50000), P('pA', 'A', '2026-10-09', 50000)],
    )
    expect(r.propuestas).toMatchObject([
      {
        tipo: 'pago-existente',
        pagoId: 'pB',
        confianza: 'Pago ya registrado · nombre',
        marcada: true,
      },
    ])
  })

  it('nivel 1: apellido compartido en la glosa = ambiguo, no propone (igual que el prototipo)', () => {
    // "MARIO ROJAS" también coincide con Laura Rojas por el apellido.
    const r = correr(
      [M('m1', '2026-10-10', 50000, 'TRANSF MARIO ROJAS')],
      [],
      [P('pB', 'B', '2026-10-08', 50000), P('pC', 'C', '2026-10-09', 50000)],
    )
    expect(r.propuestas).toEqual([])
  })

  it('nivel 1: un único pago por monto queda sin marcar', () => {
    const r = correr([M('m1', '2026-10-10', 50000)], [], [P('pB', 'B', '2026-10-14', 50000)])
    expect(r.propuestas[0]).toMatchObject({
      confianza: 'Pago ya registrado · monto',
      marcada: false,
    })
  })

  it('nivel 1 ignora pagos con cartola, "No genera pago", fuera de ±5 días o ya usados', () => {
    const r = correr(
      [M('m1', '2026-10-10', 50000), M('m2', '2026-10-11', 50000)],
      [],
      [
        P('p1', 'A', '2026-10-10', 50000, { movimientoId: 'otro' }),
        P('p2', 'A', '2026-10-10', 50000, { tipo: 'No genera pago' as TipoPago }),
        P('p3', 'A', '2026-10-20', 50000),
        P('p4', 'A', '2026-10-10', 50000),
      ],
    )
    expect(r.propuestas.map((p) => p.tipo === 'pago-existente' && p.pagoId)).toEqual(['p4'])
    expect(r.sinAsignar.map((m) => m.id)).toEqual(['m2'])
  })

  it('nivel 2: una rendición con el saldo exacto y nombre', () => {
    const r = correr(
      [M('m1', '2026-10-10', 70389, 'PAGO JUANA PEREZ')],
      [R('rA', 'A', '2026-10-09', 70389), R('rB', 'B', '2026-10-09', 70389)],
    )
    expect(r.propuestas[0]).toMatchObject({
      rendicionIds: ['rA'],
      confianza: 'Monto y nombre',
      marcada: true,
    })
    expect(r.pendientes.map((x) => x.id)).toEqual(['rB'])
  })

  it('nivel 2: solo monto (sin nombre) queda sin marcar; con dos iguales no propone', () => {
    const una = correr([M('m1', '2026-10-10', 70389)], [R('rA', 'A', '2026-10-09', 70389)])
    expect(una.propuestas[0]).toMatchObject({ confianza: 'Solo monto', marcada: false })
    const dos = correr(
      [M('m1', '2026-10-10', 70389)],
      [R('rA', 'A', '2026-10-09', 70389), R('rB', 'B', '2026-10-09', 70389)],
    )
    expect(dos.propuestas).toEqual([])
  })

  it('nivel 2: el cargo no puede ser más de 3 días anterior a la rendición', () => {
    expect(
      correr([M('m1', '2026-10-05', 1000)], [R('rA', 'A', '2026-10-09', 1000)]).propuestas,
    ).toEqual([])
    expect(
      correr([M('m1', '2026-10-06', 1000)], [R('rA', 'A', '2026-10-09', 1000)]).propuestas,
    ).toHaveLength(1)
  })

  it('nivel 3: varias rendiciones de la persona nombrada que suman el cargo', () => {
    const r = correr(
      [M('m1', '2026-10-20', 35000, 'TRANSF LAURA ROJAS')],
      [
        R('c1', 'C', '2026-10-01', 10000, 1),
        R('c2', 'C', '2026-10-02', 7000, 2),
        R('c3', 'C', '2026-10-03', 25000, 3),
      ],
    )
    expect(r.propuestas[0]).toMatchObject({
      tipo: 'rendiciones',
      rendicionIds: ['c1', 'c3'],
      confianza: 'Varias rendiciones · nombre',
      marcada: true,
    })
  })

  it('una rendición usada no se vuelve a proponer', () => {
    const r = correr(
      [M('m1', '2026-10-10', 5000, 'JUANA PEREZ'), M('m2', '2026-10-11', 5000, 'JUANA PEREZ')],
      [R('rA', 'A', '2026-10-01', 5000)],
    )
    expect(r.propuestas).toHaveLength(1)
    expect(r.sinAsignar.map((m) => m.id)).toEqual(['m2'])
  })

  it('omite abonos, cargos ya asignados o ignorados, y rendiciones pagadas', () => {
    const r = correr(
      [
        { ...M('m1', '2026-10-10', 0), abono: 5000 },
        { ...M('m2', '2026-10-10', 5000), asignado: true },
        { ...M('m3', '2026-10-10', 5000), ignorado: true },
        M('m4', '2026-10-10', 5000),
      ],
      [R('rA', 'A', '2026-10-01', 5000)],
      [P('p1', 'A', '2026-10-02', 5000, { rendicionIds: ['rA'], movimientoId: 'x' })],
    )
    expect(r.propuestas).toEqual([])
    expect(r.sinAsignar.map((m) => m.id)).toEqual(['m4'])
    expect(r.pendientes).toEqual([])
  })
})

describe('asignación manual', () => {
  const rends = [
    R('r1', 'A', '2026-10-01', 9000),
    R('r2', 'B', '2026-10-01', 5000),
    R('r3', 'C', '2026-10-01', 5200),
    R('r4', 'B', '2026-12-01', 5000), // posterior al cargo
  ]
  const a = asignarPagos(rends, [])
  it('candidatas: primero con nombre, luego por cercanía de saldo; respeta la fecha', () => {
    const c = candidatas(M('m', '2026-10-10', 5000, 'MARIO ROJAS'), rends, a, nombres)
    // B tiene 2 palabras ("mario", "rojas"), C tiene 1 ("rojas"), A ninguna.
    expect(c.map((r) => r.id)).toEqual(['r2', 'r3', 'r1'])
  })
  it('personas para anticipo: primero la nombrada', () => {
    const ps = [{ nombre: 'Juana Pérez Soto' }, { nombre: 'Mario Rojas' }]
    expect(personasParaAnticipo(M('m', '2026-10-10', 1, 'ANTICIPO MARIO'), ps)[0]!.nombre).toBe(
      'Mario Rojas',
    )
  })
})

// ---------- Paridad con proposals() del prototipo (copiado tal cual; st viene de asignarPagos) ----------
/* eslint-disable */
// prettier-ignore
function proposalsOriginal(S: any, st: any){
  const nameHit = (name: any, desc: any) => { const d=norm(desc); return norm(name).split(" ").filter((t: any)=>t.length>=4).filter((t: any)=>d.includes(t)).length; };
  const pend = S.rends.filter((r: any)=>st[r._id].saldo>1);
  const freePagos = S.pagos.filter((p: any)=>!p.cartola && p.tipo!=="No genera pago" && p.monto>0);
  const used=new Set(), usedP=new Set(); const props: any[]=[];
  const movs: any[]=[]; for (const c of S.cartolas) c.movs.forEach((m: any,i: any)=>{ if (m.c>0 && !m.pago && !m.ign) movs.push({...m,cartola:c._id,idx:i,banco:c.banco}); });
  movs.sort((a: any,b: any)=>a.f.localeCompare(b.f));
  for (const m of movs){
    const key=m.cartola+":"+m.idx;
    const ex = freePagos.filter((p: any)=>!usedP.has(p._id) && Math.abs(p.monto-m.c)<=1 && Math.abs(dnum(p.fecha||m.f)-dnum(m.f))<=5);
    const exN = ex.filter((p: any)=>nameHit(p.solicitante,m.d)>0);
    const exPick = exN.length===1?exN[0]: ex.length===1?ex[0]:null;
    if (exPick){ usedP.add(exPick._id); props.push({key,m,kind:"link",pago:exPick,conf:exN.length===1?"Pago ya registrado · nombre":"Pago ya registrado · monto"}); continue; }
    const ok = (r: any) => !used.has(r._id) && dnum(m.f) >= dnum(r.fecha)-3;
    const exact = pend.filter((r: any)=>ok(r) && Math.abs(st[r._id].saldo-m.c)<=1);
    const named = exact.filter((r: any)=>nameHit(r.solicitante,m.d)>0);
    let pick: any=null, conf="";
    if (named.length===1){ pick=[named[0]]; conf="Monto y nombre"; }
    else if (exact.length===1){ pick=[exact[0]]; conf="Solo monto"; }
    else if (!exact.length){
      const people: any={}; pend.filter((r: any)=>ok(r) && nameHit(r.solicitante,m.d)>0).forEach((r: any)=>{(people[norm(r.solicitante)] ||= []).push(r);});
      for (const rs of Object.values(people) as any){
        rs.sort((a: any,b: any)=>a.fecha.localeCompare(b.fecha)); const n=Math.min(rs.length,12);
        for (let mask=1; mask<(1<<n) && !pick; mask++){ let s=0, sel=[]; for(let i=0;i<n;i++) if(mask&(1<<i)){ s+=st[rs[i]._id].saldo; sel.push(rs[i]); } if (sel.length>1 && Math.abs(s-m.c)<=sel.length) { pick=sel; conf="Varias rendiciones · nombre"; } }
        if (pick) break;
      }
    }
    if (pick){ pick.forEach((r: any)=>used.add(r._id)); props.push({key,m,kind:"rend",rends:pick,conf}); }
  }
  return {props, movs: movs.filter(m=>!props.some(p=>p.key===m.cartola+":"+m.idx)), pend: pend.filter((r: any)=>!used.has(r._id))};
}
/* eslint-enable */

describe('paridad con proposals() del prototipo', () => {
  it('300 escenarios aleatorios dan las mismas propuestas', () => {
    let semilla = 11
    const rnd = () => (semilla = (semilla * 16807) % 2147483647) / 2147483647
    const ent = (n: number) => Math.floor(rnd() * n)
    const fecha = (base = 1) => `2026-10-${String(base + ent(20)).padStart(2, '0')}`
    const ids = [...nombres.keys()]

    for (let caso = 0; caso < 300; caso++) {
      const rends: RendicionParaPago[] = []
      for (let i = 0, n = 2 + ent(10); i < n; i++)
        rends.push(R(`r${i}`, ids[ent(3)]!, fecha(), 1000 * (1 + ent(12)), i + 1))
      const pagos: PagoParaConciliar[] = []
      for (let i = 0, n = ent(5); i < n; i++)
        pagos.push(
          P(`p${i}`, ids[ent(3)]!, rnd() < 0.15 ? '' : fecha(), 1000 * (1 + ent(12)), {
            movimientoId: rnd() < 0.2 ? 'x' : null,
            tipo: rnd() < 0.1 ? 'No genera pago' : rnd() < 0.3 ? 'Anticipo' : 'Pago',
            rendicionIds: rnd() < 0.3 && rends.length ? [rends[ent(rends.length)]!.id] : [],
          }),
        )
      const glosas = [
        'TRANSFERENCIA',
        'TRANSF JUANA PEREZ',
        'PAGO MARIO ROJAS',
        'ROJAS',
        'LAURA',
        'SOTO PEREZ',
      ]
      const movimientos: MovimientoParaConciliar[] = []
      for (let i = 0, n = 1 + ent(8); i < n; i++) {
        // Montos que a veces calzan con un saldo o con la suma de dos
        const r1 = rends[ent(rends.length)]!.total
        const r2 = rends[ent(rends.length)]!.total
        const cargo = rnd() < 0.4 ? r1 : rnd() < 0.5 ? r1 + r2 : 1000 * (1 + ent(20))
        movimientos.push({
          ...M(`m${i}`, fecha(3), rnd() < 0.1 ? 0 : cargo, glosas[ent(glosas.length)]),
          abono: rnd() < 0.1 ? 500 : 0,
          asignado: rnd() < 0.1,
          ignorado: rnd() < 0.1,
        })
      }

      const asignacion = asignarPagos(rends, pagos)
      const nuevo = proponer({ movimientos, rendiciones: rends, pagos, asignacion, nombres })

      const st: Record<string, { saldo: number }> = {}
      for (const r of rends) st[r.id] = { saldo: asignacion.porRendicion.get(r.id)!.saldo }
      const S = {
        rends: rends.map((r) => ({
          _id: r.id,
          solicitante: nombres.get(r.personaId),
          fecha: r.fecha,
        })),
        pagos: pagos.map((p) => ({
          _id: p.id,
          solicitante: nombres.get(p.personaId),
          fecha: p.fecha,
          monto: p.monto,
          tipo: p.tipo,
          cartola: p.movimientoId,
        })),
        cartolas: [
          {
            _id: 'c1',
            banco: 'X',
            movs: movimientos.map((m) => ({
              f: m.fecha,
              d: m.descripcion,
              c: m.cargo,
              a: m.abono,
              pago: m.asignado ? 'x' : null,
              ign: m.ignorado,
            })),
          },
        ],
      }
      const orig = proposalsOriginal(S, st)

      expect(
        nuevo.propuestas.map((p) => [
          p.movimiento.id,
          p.tipo === 'pago-existente' ? p.pagoId : p.rendicionIds.join(','),
          p.confianza,
        ]),
      ).toEqual(
        orig.props.map(
          (p: {
            m: { f: string }
            key: string
            kind: string
            pago?: { _id: string }
            rends?: { _id: string }[]
            conf: string
          }) => [
            `m${p.key.split(':')[1]}`,
            p.kind === 'link' ? p.pago!._id : p.rends!.map((r) => r._id).join(','),
            p.conf,
          ],
        ),
      )
      expect(nuevo.sinAsignar.map((m) => m.id)).toEqual(
        orig.movs.map((m: { idx: number }) => `m${m.idx}`),
      )
      expect(nuevo.pendientes.map((r) => r.id)).toEqual(
        orig.pend.map((r: { _id: string }) => r._id),
      )
    }
  })
})
