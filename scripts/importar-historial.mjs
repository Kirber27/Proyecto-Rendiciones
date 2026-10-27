#!/usr/bin/env node
// Importa el historial 2026 (CLAUDE/datos/historial_2026/b00..b07.json) a Supabase.
// Usa la clave secreta (service role): SOLO se corre en tu terminal, nunca en el navegador ni en CI.
//
//   SUPABASE_SECRET_KEY='sb_secret_…' npm run db:historial -- --ensayo   # revisa sin escribir
//   SUPABASE_SECRET_KEY='sb_secret_…' npm run db:historial               # importa
//
// Idempotente: una rendición (por folio) o un pago (por código H0001…) que ya existe NO se toca,
// así no se pisan ediciones posteriores. Se puede correr de nuevo para completar lo que falte.
import { readdirSync, readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'

const [mayor] = process.versions.node.split('.').map(Number)
if (mayor < 22) {
  console.error(`Este script necesita Node 22 o superior (tienes ${process.version}). Con nvm: nvm install 22 && nvm use 22`)
  process.exit(1)
}
const { createClient } = await import('@supabase/supabase-js')

const { values: args } = parseArgs({ options: { ensayo: { type: 'boolean', default: false } } })
const ENSAYO = args.ensayo
const URL = process.env.VITE_SUPABASE_URL
const CLAVE = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !CLAVE) {
  console.error('Faltan VITE_SUPABASE_URL (en .env.local) y SUPABASE_SECRET_KEY (en la terminal).')
  process.exit(1)
}
const db = createClient(URL, CLAVE, { auth: { persistSession: false, autoRefreshToken: false } })

const DIR = 'CLAUDE/datos/historial_2026'
const codes = JSON.parse(readFileSync('CLAUDE/datos/codes.json', 'utf8'))
const norm = (s) =>
  (s ?? '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
const clp = (n) => '$ ' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')

// ---------- Lotes ----------
const rends = []
const pagos = []
for (const f of readdirSync(DIR).filter((x) => x.endsWith('.json')).sort()) {
  for (const op of JSON.parse(readFileSync(`${DIR}/${f}`, 'utf8'))) {
    if (op.collection === 'rendiciones') rends.push({ folio: op.doc_id, ...op.data })
    else if (op.collection === 'pagos') pagos.push({ codigo: op.doc_id, ...op.data })
  }
}
console.log(`Lotes: ${rends.length} rendiciones, ${pagos.length} pagos${ENSAYO ? '  (ENSAYO: no se escribe nada)' : ''}`)

// ---------- Catálogos de la base ----------
async function leer(tabla, columnas) {
  const { data, error } = await db.from(tabla).select(columnas)
  if (error) throw new Error(`${tabla}: ${error.message}`)
  return data
}
const porNorm = (filas, campo) => new Map(filas.map((x) => [norm(x[campo]), x.id]))
const empresas = porNorm(await leer('empresas', 'id, nombre'), 'nombre')
const subcuentas = porNorm(await leer('subcuentas', 'id, nombre'), 'nombre')
const cuentas = porNorm(await leer('cuentas', 'id, nombre'), 'nombre')
const ccs = porNorm(await leer('centros_costo', 'id, codigo'), 'codigo')
const medios = porNorm(await leer('medios_pago', 'id, nombre'), 'nombre')
const personas = porNorm(await leer('personas', 'id, nombre_norm'), 'nombre_norm')
const codigosUsados = new Set((await leer('personas', 'codigo')).map((p) => p.codigo))

const avisos = []
const avisar = (t) => avisos.push(t)
const idDe = (mapa, valor, que, donde) => {
  if (!valor || !String(valor).trim()) return null
  const id = mapa.get(norm(valor))
  if (id == null) avisar(`${donde}: ${que} "${valor}" no está en el catálogo (queda vacío)`)
  return id ?? null
}

// ---------- Personas faltantes ----------
async function personaId(nombre) {
  const k = norm(nombre)
  if (personas.has(k)) return personas.get(k)
  let codigo = codes[k] ?? k.replace(/[^a-z]/g, '').slice(0, 3).toUpperCase()
  if (codigosUsados.has(codigo)) throw new Error(`Código ${codigo} ocupado para la persona nueva "${nombre}"`)
  avisar(`Persona nueva creada: "${nombre}" (${codigo})`)
  if (ENSAYO) {
    personas.set(k, `ensayo-${codigo}`)
    return personas.get(k)
  }
  const { data, error } = await db.from('personas').insert({ nombre, codigo }).select('id').single()
  if (error) throw new Error(`persona ${nombre}: ${error.message}`)
  codigosUsados.add(codigo)
  personas.set(k, data.id)
  return data.id
}

// ---------- Rendiciones ----------
const existentes = new Map((await leer('rendiciones', 'id, folio')).filter((r) => r.folio).map((r) => [r.folio, r.id]))
const folioAId = new Map(existentes)
let nuevas = 0
let lineasNuevas = 0
for (const r of rends) {
  if (existentes.has(r.folio)) continue
  const donde = r.folio
  const lineas = r.lineas.map((l, i) => {
    if (!l.sub || !l.cue) avisar(`${donde} línea ${i + 1}: sin subcuenta o cuenta en el Excel (revisar)`)
    return {
      orden: i + 1,
      fecha: l.fecha || r.fecha,
      tipo: l.tipo,
      proveedor: l.proveedor ?? '',
      rut: l.rut ?? '',
      numero: String(l.numero ?? ''),
      neto: l.neto || 0,
      iva: l.iva || 0,
      exento: l.exento || 0,
      otros: l.otros || 0,
      detalle: l.detalle ?? '',
      subcuenta_id: idDe(subcuentas, l.sub, 'subcuenta', `${donde} línea ${i + 1}`),
      cuenta_id: idDe(cuentas, l.cue, 'cuenta', `${donde} línea ${i + 1}`),
      centro_costo_id: idDe(ccs, l.cc, 'C.C.', `${donde} línea ${i + 1}`),
    }
  })
  const cabecera = {
    folio: r.folio,
    persona_id: await personaId(r.solicitante),
    nro: r.nro,
    fecha: r.fecha,
    empresa_id: idDe(empresas, r.empresa, 'empresa', donde),
    fondo: r.fondo ?? '',
    total_formulario: r.totalForm ?? null,
    estado: 'aprobada',
    origen: 'Histórico',
    exportada: !!r.exportada,
    obs: r.obs ?? '',
    enviado_en: r.creadoEn ?? null,
    decidido_en: r.creadoEn ?? null,
    creado_en: r.creadoEn ?? undefined,
  }
  nuevas++
  lineasNuevas += lineas.length
  if (ENSAYO) {
    folioAId.set(r.folio, `ensayo-${r.folio}`)
    continue
  }
  const { data, error } = await db.from('rendiciones').insert(cabecera).select('id').single()
  if (error) throw new Error(`rendición ${r.folio}: ${error.message}`)
  const id = data.id
  const ls = await db.from('rendicion_lineas').insert(lineas.map((l) => ({ ...l, rendicion_id: id })))
  const ev = ls.error
    ? null
    : await db.from('rendicion_eventos').insert({
        rendicion_id: id,
        evento: 'Ingresada (historial)',
        nota: 'Histórico',
        creado_en: `${r.fecha}T12:00:00Z`,
      })
  if (ls.error || ev?.error) {
    await db.from('rendiciones').delete().eq('id', id) // deshacer para poder reintentar limpio
    throw new Error(`rendición ${r.folio}: ${(ls.error ?? ev.error).message}`)
  }
  folioAId.set(r.folio, id)
  process.stdout.write('.')
}
if (nuevas && !ENSAYO) process.stdout.write('\n')

// ---------- Pagos ----------
const pagosExistentes = new Set((await leer('pagos', 'codigo_hist')).map((p) => p.codigo_hist).filter(Boolean))
let pagosNuevos = 0
for (const p of pagos) {
  if (pagosExistentes.has(p.codigo)) continue
  const donde = p.codigo
  const medio = norm(p.banco) === 'no informado' ? null : idDe(medios, p.banco, 'medio de pago', donde)
  if (!p.fecha) avisar(`${donde}: pago sin fecha (queda vacía)`)
  const fila = {
    codigo_hist: p.codigo,
    persona_id: await personaId(p.solicitante),
    fecha: p.fecha || null,
    medio_pago_id: medio,
    monto: p.monto,
    tipo: p.tipo,
    descripcion: p.desc ?? '',
    origen: 'Histórico',
    obs: [p.obs, norm(p.banco) === 'no informado' ? 'Banco no informado en el Excel' : ''].filter(Boolean).join(' · '),
  }
  const ids = (p.rends ?? []).map((f) => {
    const id = folioAId.get(f)
    if (!id) avisar(`${donde}: rendición ${f} no existe (vínculo omitido)`)
    return id
  }).filter(Boolean)
  pagosNuevos++
  if (ENSAYO) continue
  const { data, error } = await db.from('pagos').insert(fila).select('id').single()
  if (error) throw new Error(`pago ${p.codigo}: ${error.message}`)
  if (ids.length) {
    const v = await db.from('pago_rendiciones').insert(ids.map((rendicion_id) => ({ pago_id: data.id, rendicion_id })))
    if (v.error) {
      await db.from('pagos').delete().eq('id', data.id)
      throw new Error(`pago ${p.codigo} vínculos: ${v.error.message}`)
    }
  }
}

// ---------- Resumen ----------
console.log(`\nNuevas: ${nuevas} rendiciones (${lineasNuevas} líneas), ${pagosNuevos} pagos. Ya existían: ${rends.length - nuevas} rendiciones, ${pagos.length - pagosNuevos} pagos.`)
if (!ENSAYO) {
  const h = await db.from('rendiciones').select('total').eq('origen', 'Histórico')
  const hp = await db.from('pagos').select('monto').eq('origen', 'Histórico')
  const nl = await db.from('rendicion_lineas').select('id', { count: 'exact', head: true })
  const suma = (xs, k) => xs.reduce((s, x) => s + Number(x[k]), 0)
  console.log(`En la base (Histórico): ${h.data.length} rendiciones por ${clp(suma(h.data, 'total'))}, ${nl.count} líneas, ${hp.data.length} pagos por ${clp(suma(hp.data, 'monto'))}`)
  console.log('Esperado:               182 rendiciones por $ 45.024.174, 612 líneas, 174 pagos por $ 45.045.931')
}
if (avisos.length) console.log(`\nAvisos (${avisos.length}):\n  ` + avisos.join('\n  '))
