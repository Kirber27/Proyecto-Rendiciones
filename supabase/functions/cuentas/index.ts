// Cuentas con contraseña (spec 10). Solo el administrador: crea la cuenta de una persona o le asigna
// una contraseña nueva. La app no envía correos: la contraseña temporal se devuelve al administrador,
// que se la entrega a la persona; al entrar, la app le pide elegir una propia
// (user_metadata.debe_cambiar_clave). Usa la clave de servicio que Supabase inyecta: sin secretos propios.
import { createClient } from '@supabase/supabase-js'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function responder(cuerpo: unknown, status = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
const fallo = (status: number, message: string) => responder({ message }, status)

const URL_SUPABASE = Deno.env.get('SUPABASE_URL')!
const CLAVE_ANON = Deno.env.get('SUPABASE_ANON_KEY')!
const CLAVE_SERVICIO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

/** Sin 0/O ni 1/I/L para que se pueda dictar o copiar a mano sin errores. */
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

/** Contraseña temporal: 12 caracteres al azar en grupos de 4 ("K7QM-4XPR-2HTW"). */
function claveTemporal(): string {
  const tope = 256 - (256 % ALFABETO.length) // muestreo por rechazo: sin sesgo
  const letras: string[] = []
  while (letras.length < 12) {
    for (const b of crypto.getRandomValues(new Uint8Array(16))) {
      if (b < tope && letras.length < 12) letras.push(ALFABETO[b % ALFABETO.length]!)
    }
  }
  const s = letras.join('')
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return fallo(405, 'Método no permitido.')

  // ---------- Quién pide: sesión válida y administrador activo (misma regla que es_admin()) ----------
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const anon = createClient(URL_SUPABASE, CLAVE_ANON, { auth: { persistSession: false } })
  const { data: u } = await anon.auth.getUser(jwt)
  if (!u?.user) return fallo(401, 'Tu sesión expiró. Vuelve a ingresar.')
  const admin = createClient(URL_SUPABASE, CLAVE_SERVICIO, { auth: { persistSession: false } })
  const { data: yo } = await admin
    .from('personas')
    .select('id')
    .eq('user_id', u.user.id)
    .eq('rol', 'administrador')
    .is('eliminada_en', null)
    .maybeSingle()
  if (!yo) return fallo(403, 'Solo un administrador puede crear cuentas o asignar contraseñas.')

  // ---------- Qué pide ----------
  let accion: unknown
  let personaId: unknown
  try {
    ;({ accion, personaId } = await req.json())
  } catch {
    return fallo(400, 'Cuerpo inválido.')
  }
  if ((accion !== 'crear' && accion !== 'restablecer') || typeof personaId !== 'string')
    return fallo(400, 'Cuerpo inválido.')

  const { data: p } = await admin
    .from('personas')
    .select('id, nombre, correo, user_id, eliminada_en')
    .eq('id', personaId)
    .maybeSingle()
  if (!p || p.eliminada_en) return fallo(404, 'La persona no existe o está eliminada.')

  const clave = claveTemporal()
  const marca = { debe_cambiar_clave: true }

  if (accion === 'crear') {
    if (p.user_id) return fallo(409, 'Esta persona ya tiene cuenta: usa "Nueva contraseña".')
    if (!p.correo) return fallo(400, 'Registra primero el correo de la persona.')
    const { error } = await admin.auth.admin.createUser({
      email: String(p.correo).toLowerCase(),
      password: clave,
      email_confirm: true, // sin correo de confirmación
      user_metadata: marca,
    })
    if (error) {
      if (error.code === 'email_exists' || /already (been )?registered|exists/i.test(error.message))
        return fallo(
          409,
          'Ya existe una cuenta con ese correo: vincúlala en "Cuentas de usuario" y usa "Nueva contraseña".',
        )
      return fallo(error.status ?? 500, error.message)
    }
    // El trigger de auth.users la vincula con la persona del mismo correo.
    return responder({ clave })
  }

  if (!p.user_id) return fallo(409, 'Esta persona aún no tiene cuenta: usa "Crear cuenta".')
  const { error } = await admin.auth.admin.updateUserById(p.user_id, {
    password: clave,
    user_metadata: marca,
  })
  if (error) return fallo(error.status ?? 500, error.message)
  return responder({ clave })
})
