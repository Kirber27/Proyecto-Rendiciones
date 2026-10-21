// Paridad con el prototipo: las funciones originales (copiadas tal cual de
// CLAUDE/app/rendiciones-heca.html) deben dar el mismo resultado que las portadas.
import { describe, expect, it } from 'vitest'
import { norm, num, parseDate } from '../formato'

/* eslint-disable */
// prettier-ignore
const original = {
  norm: (s: any) => (s??"").toString().normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/\s+/g," ").trim(),
  num: (v: any) => { if (v==null || v==="") return 0; if (typeof v==="number") return v;
    let s = String(v).replace(/[^\d,.\-]/g,""); if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g,"").replace(",","."); else s = s.replace(/[.,]/g,""); const n = parseFloat(s); return isNaN(n)?0:n; },
  parseDate(v: any){
    const iso = (d: Date) => d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
    if (v==null || v==="") return "";
    if (v instanceof Date && !isNaN(v as any)) return iso(v);
    if (typeof v==="number"){ const d=new Date(Math.round((v-25569)*86400000)); return d.getUTCFullYear()+"-"+String(d.getUTCMonth()+1).padStart(2,"0")+"-"+String(d.getUTCDate()).padStart(2,"0"); }
    const s=String(v).trim(); let m;
    if ((m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return m[1]+"-"+m[2].padStart(2,"0")+"-"+m[3].padStart(2,"0");
    if ((m=s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/))) { const y=m[3].length===2?"20"+m[3]:m[3]; return y+"-"+m[2].padStart(2,"0")+"-"+m[1].padStart(2,"0"); }
    return "";
  },
}
/* eslint-enable */

const montos = [
  '70.389',
  '$ 70.389',
  '1.234,50',
  '12,5',
  '1,234',
  '-1.000',
  '',
  ' 0 ',
  'CLP 1.500.000',
  '3.5',
  'x',
  0,
  42,
  -7.5,
  null,
  undefined,
]
const fechas = [
  '2026-10-14',
  '2026-1-5',
  '14-10-2026',
  '14/10/26',
  '5.3.2026',
  '2026/10/14',
  46000,
  45658.5,
  'hoy',
  '',
  null,
  new Date(2026, 9, 14),
]
const textos = [
  '  Rodrigo  Ibañez ',
  'ÁLVARO MARTÍNEZ',
  'Ana Jocelyn  Schnell',
  'Arleen Cedeño',
  '',
  null,
  123,
]

describe('paridad con el prototipo', () => {
  it.each(montos)('num(%j)', (v) => expect(num(v)).toBe(original.num(v)))
  it.each(fechas)('parseDate(%j)', (v) => expect(parseDate(v)).toBe(original.parseDate(v)))
  it.each(textos)('norm(%j)', (v) => expect(norm(v)).toBe(original.norm(v)))
})
