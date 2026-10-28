import { existsSync, readdirSync, readFileSync } from 'node:fs'
import * as XLSX from 'xlsx'
import { describe, expect, it } from 'vitest'
import { construirLibroExcel } from '@/services/excel'
import {
  ENCABEZADOS_EXCEL,
  filasExcel,
  nombreArchivoExcel,
  seleccionarParaExportar,
  serialExcel,
  type LineaExport,
  type PagoExport,
  type RendicionExport,
} from '../exportar'
import { dnum, MESES, semana } from '../formato'

const linea = (cambios: Partial<LineaExport> = {}): LineaExport => ({
  fecha: '',
  tipo: 'Boleta',
  proveedor: '',
  numero: '',
  neto: 0,
  iva: 0,
  exento: 0,
  otros: 0,
  detalle: '',
  subcuenta: 'Bencina',
  cuenta: 'Operacionales',
  centroCosto: 'HGI.',
  ...cambios,
})

// Rendición FICTICIA de 3 líneas
const rend: RendicionExport = {
  id: 'r1',
  folio: 'JPE-012',
  solicitante: 'Juana Pérez ',
  nro: 12,
  fecha: '2026-10-07',
  exportada: false,
  lineas: [
    linea({
      tipo: 'Factura',
      proveedor: 'COPEC',
      numero: '4471',
      neto: 10000,
      iva: 1900,
      exento: 300,
      otros: 200,
      detalle: 'Combustible ruta',
    }),
    linea({ fecha: '2026-09-30', exento: 5000, otros: 500, subcuenta: 'Estacionamiento' }),
    linea({ tipo: 'Transferencia', exento: 20000, detalle: 'Peoneta' }),
  ],
}
const pagos: PagoExport[] = [
  {
    rendicionIds: ['r1'],
    medioPago: 'Banco Internacional HGI ',
    fecha: '2026-10-20',
    monto: 30000,
  },
  { rendicionIds: ['r1'], medioPago: 'Cash CLP', fecha: '2026-10-15', monto: 7900 },
]

describe('encabezados', () => {
  it('son los de la hoja "Rendiciones" original, con sus espacios finales', () => {
    expect(ENCABEZADOS_EXCEL).toHaveLength(17)
    expect(ENCABEZADOS_EXCEL.filter((h) => h.endsWith(' '))).toEqual([
      'Fecha ',
      'Cuenta ',
      'Concepto ',
      'Monto Neto ',
      'Monto Exento ',
      'Total ',
      'Pagado por ',
      'Fecha de Pago ',
      'Monto ',
    ])
  })
})

describe('filasExcel', () => {
  const filas = filasExcel([rend], pagos)

  it('una fila por línea, con fecha serial, semana y mes', () => {
    expect(filas).toHaveLength(3)
    expect(filas[0]!.slice(0, 5)).toEqual([
      'Juana Pérez ',
      12,
      serialExcel('2026-10-07'),
      'Del 05 al 09',
      'octubre',
    ])
    expect(filas[1]!.slice(2, 5)).toEqual([serialExcel('2026-09-30'), 'Del 28 al 02', 'septiembre'])
  })

  it('factura separa neto/IVA y suma otros al exento; otros tipos van todo en exento', () => {
    // [C.C., Cuenta, Detalle(=subcuenta), Concepto, Tipo, Neto, Exento, IVA, Total]
    expect(filas[0]!.slice(5, 14)).toEqual([
      'HGI.',
      'Operacionales',
      'Bencina',
      'Combustible ruta · COPEC · Doc 4471',
      'Factura',
      10000,
      500,
      1900,
      12400,
    ])
    expect(filas[1]!.slice(7, 14)).toEqual([
      'Estacionamiento',
      '',
      'Boleta',
      null,
      5500,
      null,
      5500,
    ])
    expect(filas[2]!.slice(8, 14)).toEqual(['Peoneta', 'Transferencia', null, 20000, null, 20000])
  })

  it('el pago va solo en la última línea: medio y fecha del más reciente, suma de todos', () => {
    expect(filas[0]!.slice(14)).toEqual([null, null, null])
    expect(filas[1]!.slice(14)).toEqual([null, null, null])
    expect(filas[2]!.slice(14)).toEqual([
      'Banco Internacional HGI ',
      serialExcel('2026-10-20'),
      37900,
    ])
  })

  it('sin pagos las columnas de pago quedan vacías', () => {
    expect(filasExcel([rend], []).at(-1)!.slice(14)).toEqual([null, null, null])
  })
})

describe('selección y nombre', () => {
  it('solo nuevas, ordenadas por fecha y folio', () => {
    const rs = [
      { folio: 'B-002', fecha: '2026-10-02', exportada: false },
      { folio: 'A-001', fecha: '2026-10-02', exportada: false },
      { folio: 'C-001', fecha: '2026-09-01', exportada: true },
    ]
    expect(seleccionarParaExportar(rs, true).map((r) => r.folio)).toEqual(['A-001', 'B-002'])
    expect(seleccionarParaExportar(rs, false).map((r) => r.folio)).toEqual([
      'C-001',
      'A-001',
      'B-002',
    ])
  })
  it('nombre del archivo', () => {
    expect(nombreArchivoExcel('2026-10-21')).toBe('Rendiciones_2026-10-21.xlsx')
    expect(nombreArchivoExcel('2026-10-21', 'busqueda')).toBe(
      'Rendiciones_busqueda_2026-10-21.xlsx',
    )
  })
})

describe('archivo .xlsx', () => {
  it('se puede abrir: hoja "Rendiciones", encabezados, fechas y montos con formato', async () => {
    const datos = await construirLibroExcel(filasExcel([rend], pagos))
    const wb = XLSX.read(datos, { type: 'array', cellDates: true, cellNF: true, cellStyles: true })
    expect(wb.SheetNames).toEqual(['Rendiciones'])
    const ws = wb.Sheets['Rendiciones']!
    const filas = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true })
    expect(filas[0]).toEqual([...ENCABEZADOS_EXCEL])
    expect(filas).toHaveLength(4)
    // Fecha como fecha real de Excel con formato dd-mm-yyyy
    expect(ws['C2'].t).toBe('d')
    expect(ws['C2'].z).toBe('dd-mm-yyyy')
    expect((ws['C2'].v as Date).toISOString().slice(0, 10)).toBe('2026-10-07')
    expect(ws['P4'].z).toBe('dd-mm-yyyy')
    // Montos con separador de miles
    expect(ws['N2'].z).toBe('#,##0')
    expect(ws['N2'].v).toBe(12400)
    expect(ws['Q4'].v).toBe(37900)
    expect(ws['!cols']).toHaveLength(17)
  })
})

// ---------- Paridad con exportar() del prototipo sobre el historial 2026 ----------
/* eslint-disable */
// prettier-ignore
function filasOriginal(list: any[], S: { pagos: any[] }){
  const lineTotal = (l: any) => l.neto+l.iva+l.exento+l.otros;
  const rows: any[]=[]; const pagosBy: any={}; S.pagos.forEach((p: any)=>(p.rends||[]).forEach((id: any)=>(pagosBy[id] ||= []).push(p)));
  for (const r of list){
    const ps = pagosBy[r._id]||[];
    (r.lineas||[]).forEach((l: any,i: any)=>{
      const fac=l.tipo==="Factura"; const neto=fac?l.neto:0, exe=fac?(l.exento+l.otros):lineTotal(l), iva=fac?l.iva:0;
      const last=i===r.lineas.length-1; const p=last&&ps.length?ps[ps.length-1]:null; const f=l.fecha||r.fecha;
      const concepto=[l.detalle, l.proveedor, l.numero?"Doc "+l.numero:""].filter(Boolean).join(" · ");
      rows.push([r.solicitante, r.nro, dnum(f)+25569, semana(f), MESES[Number(f.split("-")[1])-1], l.cc||"", l.cue||"", l.sub||"", concepto, l.tipo,
        neto||null, exe||null, iva||null, neto+exe+iva, p?p.banco:null, p&&p.fecha?dnum(p.fecha)+25569:null, p?ps.reduce((s: any,x: any)=>s+x.monto,0):null]);
    });
  }
  return rows;
}
/* eslint-enable */

const dir = 'CLAUDE/datos/historial_2026'
describe.skipIf(!existsSync(dir))('paridad con exportar() del prototipo', () => {
  it('historial 2026 completo: mismas filas', () => {
    const rends: any[] = [] // eslint-disable-line @typescript-eslint/no-explicit-any
    const ps: any[] = [] // eslint-disable-line @typescript-eslint/no-explicit-any
    for (const f of readdirSync(dir)
      .filter((x) => x.endsWith('.json'))
      .sort()) {
      for (const op of JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'))) {
        if (op.collection === 'rendiciones') rends.push({ _id: op.doc_id, ...op.data })
        else ps.push({ _id: op.doc_id, ...op.data })
      }
    }
    // El prototipo toma el último pago en orden de carga; se ordenan por fecha para comparar.
    ps.sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''))
    const lista = rends
      .slice()
      .sort((a, b) => a.fecha.localeCompare(b.fecha) || a._id.localeCompare(b._id))

    const nuevo = filasExcel(
      seleccionarParaExportar(
        rends.map((r) => ({
          id: r._id,
          folio: r._id,
          solicitante: r.solicitante,
          nro: r.nro,
          fecha: r.fecha,
          exportada: r.exportada,
          lineas: r.lineas.map((l: Record<string, never>) => ({
            ...l,
            subcuenta: l.sub,
            cuenta: l.cue,
            centroCosto: l.cc,
          })),
        })),
        false,
      ),
      ps.map((p) => ({
        rendicionIds: p.rends,
        medioPago: p.banco,
        fecha: p.fecha,
        monto: p.monto,
      })),
    )
    const original = filasOriginal(lista, { pagos: ps })
    expect(nuevo).toHaveLength(612)
    expect(nuevo).toEqual(original)
  })
})
