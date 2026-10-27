#!/usr/bin/env node
// Genera la migración de datos iniciales desde los JSON del prototipo (CLAUDE/datos):
// catálogos (grafía exacta), empresas, medios de pago, personas del historial y el administrador inicial.
//
// Uso: npm run db:datos -- --admin-nombre "Nombre Apellido" --admin-correo correo@dominio.cl [--admin-codigo ABC]
// Escribe supabase/migrations/20261026000008_datos_iniciales.sql (no editar a mano: regenerar).
import { readFileSync, writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'

const { values: args } = parseArgs({
  options: {
    'admin-nombre': { type: 'string' },
    'admin-correo': { type: 'string' },
    'admin-codigo': { type: 'string' },
  },
})
if (!args['admin-nombre'] || !args['admin-correo']) {
  console.error('Faltan --admin-nombre y --admin-correo')
  process.exit(1)
}

const DATOS = 'CLAUDE/datos'
const SALIDA = 'supabase/migrations/20261026000008_datos_iniciales.sql'
const lists = JSON.parse(readFileSync(`${DATOS}/lists.json`, 'utf8'))
const codes = JSON.parse(readFileSync(`${DATOS}/codes.json`, 'utf8'))
const subACuenta = JSON.parse(readFileSync(`${DATOS}/subcuenta_a_cuenta.json`, 'utf8'))

// Mismas reglas que src/domain/formato.ts
const norm = (s) =>
  (s ?? '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
const tr = (s) => (s ?? '').toString().replace(/\s+/g, ' ').trim()
const q = (s) => (s == null ? 'null' : `'${String(s).replace(/'/g, "''")}'`)

// Empresas del prototipo (EMP): nombre, RUT, C.C. por defecto
const EMPRESAS = [
  ['Heca Global SPA', '76723245-4', 'HG'],
  ['Hecaglobal Instruments SPA', '76886693-7', 'HGI.'],
  ['Siga Sonriendo SPA', '77422425-4', 'SS'],
  ['Sonrie Pro Financial SPA', '77219167-7', null],
]

const sql = []
sql.push('-- GENERADO por scripts/generar-datos-iniciales.mjs desde CLAUDE/datos. No editar a mano.')
sql.push('-- Catálogos con la grafía exacta del Excel original (espacios finales incluidos).\n')

sql.push('insert into public.centros_costo (codigo, orden) values')
sql.push(lists.cc.map((c, i) => `  (${q(c)}, ${i + 1})`).join(',\n') + ';\n')

sql.push('insert into public.cuentas (nombre, orden) values')
sql.push(lists.cue.map((c, i) => `  (${q(c)}, ${i + 1})`).join(',\n') + ';\n')

// Cuenta sugerida: subcuenta_a_cuenta.json usa nombres recortados → buscar la grafía exacta
const cuentaExacta = (nombre) => lists.cue.find((c) => norm(c) === norm(nombre)) ?? null
const sinCuenta = []
sql.push('insert into public.subcuentas (nombre, cuenta_sugerida_id, orden) values')
sql.push(
  lists.sub
    .map((s, i) => {
      const sugerida = subACuenta[tr(s)]
      const exacta = sugerida ? cuentaExacta(sugerida) : null
      if (sugerida && !exacta) sinCuenta.push(`${s} → ${sugerida}`)
      const ref = exacta ? `(select id from public.cuentas where nombre = ${q(exacta)})` : 'null'
      return `  (${q(s)}, ${ref}, ${i + 1})`
    })
    .join(',\n') + ';\n',
)

sql.push('insert into public.empresas (nombre, rut, centro_costo_id) values')
sql.push(
  EMPRESAS.map(
    ([n, rut, cc]) =>
      `  (${q(n)}, ${q(rut)}, ${cc ? `(select id from public.centros_costo where codigo = ${q(cc)})` : 'null'})`,
  ).join(',\n') + ';\n',
)

sql.push('insert into public.medios_pago (nombre, orden) values')
sql.push(lists.pag.map((m, i) => `  (${q(m)}, ${i + 1})`).join(',\n') + ';\n')

// Personas del historial (sin correo: se completa en Perfiles) + administrador inicial
const codigos = new Set()
const filas = lists.sol.map((nombre) => {
  const codigo = codes[norm(nombre)]
  if (!codigo) throw new Error(`Sin código para ${nombre}`)
  if (codigos.has(codigo)) throw new Error(`Código repetido ${codigo}`)
  codigos.add(codigo)
  return `  (${q(nombre)}, ${q(codigo)}, null, 'solicitante', false)`
})
const adminNombre = tr(args['admin-nombre'])
const adminCodigo = (args['admin-codigo'] ?? '').toUpperCase() || sugerir(adminNombre)
if (!/^[A-Z]{2,4}$/.test(adminCodigo) || codigos.has(adminCodigo))
  throw new Error(`Código de administrador inválido o repetido: ${adminCodigo}`)
filas.push(`  (${q(adminNombre)}, ${q(adminCodigo)}, ${q(args['admin-correo'].trim().toLowerCase())}, 'administrador', true)`)

sql.push('-- Personas del historial 2026 (códigos de codes.json) y administrador inicial.')
sql.push('insert into public.personas (nombre, codigo, correo, rol, es_nueva) values')
sql.push(filas.join(',\n') + ';\n')

writeFileSync(SALIDA, sql.join('\n'))

console.log(`Escrito ${SALIDA}`)
console.log(
  `  ${lists.cc.length} C.C., ${lists.cue.length} cuentas, ${lists.sub.length} subcuentas, ` +
    `${EMPRESAS.length} empresas, ${lists.pag.length} medios de pago, ${filas.length} personas`,
)
console.log(`  Administrador: ${adminNombre} (${adminCodigo}) ${args['admin-correo']}`)
if (sinCuenta.length) console.warn('  Sugerencias sin cuenta exacta:', sinCuenta)

/** Igual que sugerirCodigo de src/domain/personas.ts (sin usados). */
function sugerir(nombre) {
  const p = tr(nombre).split(' ')
  return norm((p[0] ?? '').slice(0, 1) + (p[1] ?? p[0] ?? '').slice(0, 2)).toUpperCase().replace(/[^A-Z]/g, '')
}
