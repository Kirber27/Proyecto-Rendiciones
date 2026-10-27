#!/usr/bin/env node
// Contraseña temporal para una cuenta, desde la terminal (spec 10, R3.3 y R5.1): para la cuenta que
// ya existía (entraba con código por correo) o si el único administrador olvidó su contraseña.
// Usa la clave secreta (service role): SOLO se corre en tu terminal, nunca en el navegador ni en CI.
//
//   SUPABASE_SECRET_KEY='sb_secret_…' npm run cuenta:clave -- correo@hecaglobal.com
//
// Si el correo no tiene cuenta pero está registrado en Perfiles, la crea (el trigger la vincula).
// La contraseña temporal solo se imprime aquí; al entrar, la app pide elegir una propia.
import { randomInt } from 'node:crypto'

const [mayor] = process.versions.node.split('.').map(Number)
if (mayor < 22) {
  console.error(`Este script necesita Node 22 o superior (tienes ${process.version}). Con nvm: nvm install 22 && nvm use 22`)
  process.exit(1)
}
const { createClient } = await import('@supabase/supabase-js')

const correo = (process.argv[2] ?? '').trim().toLowerCase()
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
  console.error("Uso: SUPABASE_SECRET_KEY='sb_secret_…' npm run cuenta:clave -- correo@hecaglobal.com")
  process.exit(1)
}
const URL = process.env.VITE_SUPABASE_URL
const CLAVE = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !CLAVE) {
  console.error('Faltan VITE_SUPABASE_URL (en .env.local) y SUPABASE_SECRET_KEY (en la terminal).')
  process.exit(1)
}
const db = createClient(URL, CLAVE, { auth: { persistSession: false, autoRefreshToken: false } })

// Mismo formato que la Edge Function `cuentas`: 12 caracteres sin 0/O ni 1/I/L, en grupos de 4.
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const s = Array.from({ length: 12 }, () => ALFABETO[randomInt(ALFABETO.length)]).join('')
const clave = `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`
const marca = { debe_cambiar_clave: true }

function fallar(texto, error) {
  console.error(texto + (error ? ` (${error.message})` : ''))
  process.exit(1)
}

/** Cuenta de Auth con ese correo, o null (la API lista de a 1.000). */
async function buscarCuenta() {
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) fallar('No se pudieron leer las cuentas', error)
    const u = data.users.find((x) => x.email?.toLowerCase() === correo)
    if (u) return u
    if (data.users.length < 1000) return null
  }
}

const cuenta = await buscarCuenta()
if (cuenta) {
  const { error } = await db.auth.admin.updateUserById(cuenta.id, { password: clave, user_metadata: marca })
  if (error) fallar('No se pudo asignar la contraseña', error)
  console.log(`Contraseña temporal asignada a ${correo}.`)
} else {
  const { data: p, error } = await db
    .from('personas')
    .select('nombre')
    .eq('correo', correo)
    .is('eliminada_en', null)
    .maybeSingle()
  if (error) fallar('No se pudo leer Perfiles', error)
  if (!p) fallar(`${correo} no tiene cuenta ni está registrado en Perfiles.`)
  const { error: e2 } = await db.auth.admin.createUser({
    email: correo,
    password: clave,
    email_confirm: true,
    user_metadata: marca,
  })
  if (e2) fallar('No se pudo crear la cuenta', e2)
  console.log(`Cuenta creada para ${p.nombre.trim()} (${correo}).`)
}
console.log(`\n    ${clave}\n`)
console.log('Entra con ella en la app: te pedirá elegir una propia. No la guardes en ningún archivo.')
