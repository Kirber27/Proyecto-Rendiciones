// Edge Function: lee la foto del formulario y las boletas con Claude y devuelve las líneas de gasto.
//
// POST /functions/v1/leer-rendicion   (Authorization: Bearer <JWT del usuario>)
//   body: { imagenes: [{ media_type, data (base64) }], nota: string }
//   200 → { respuesta: RespuestaLectura }
//   4xx/5xx → { code: CodigoErrorLectura, message }
//
// La API key de Anthropic solo vive como secreto de la función (ANTHROPIC_API_KEY).
// Spec: .kiro/specs/02-rendir-gastos (R2.2, R2.3, R2.8).
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import {
  construirPrompt,
  ErrorLectura,
  ESQUEMA_SALIDA,
  extraerRespuesta,
  type CodigoErrorLectura,
} from '../_shared/lectura.ts'

const MODELO = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-opus-5-5'
/** Esfuerzo de razonamiento. 'medium' equilibra precisión y espera (la persona aguarda en el celular). */
const ESFUERZO = (Deno.env.get('ANTHROPIC_EFFORT') ?? 'medium') as 'low' | 'medium' | 'high'
/** Lecturas por usuario por día (R2.8). */
const LIMITE_DIA = Number(Deno.env.get('LIMITE_LECTURAS_DIA') ?? '30')
/** Imágenes por lectura (el cliente arma recortes hasta este número). */
const MAX_IMAGENES = 20
const TIPOS_IMAGEN = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

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
const fallo = (code: CodigoErrorLectura, status: number, message: string) =>
  responder({ code, message }, status)

const URL_SUPABASE = Deno.env.get('SUPABASE_URL')!
const CLAVE_ANON = Deno.env.get('SUPABASE_ANON_KEY')!
const CLAVE_SERVICIO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const anthropic = new Anthropic() // lee ANTHROPIC_API_KEY; reintenta 2 veces 429/5xx por defecto

interface Imagen {
  media_type: string
  data: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return fallo('error', 405, 'Método no permitido')

  // ---------- Sesión del usuario ----------
  const authHeader = req.headers.get('Authorization') ?? ''
  const db = createClient(URL_SUPABASE, CLAVE_ANON, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })
  const { data: u } = await db.auth.getUser(authHeader.replace(/^Bearer\s+/i, ''))
  if (!u?.user) return fallo('unauthorized', 401, 'Sesión no válida')
  const userId = u.user.id
  const admin = createClient(URL_SUPABASE, CLAVE_SERVICIO, { auth: { persistSession: false } })

  // ---------- Cupo diario ----------
  const desde = new Date()
  desde.setUTCHours(0, 0, 0, 0)
  const { count } = await admin
    .from('lecturas_ia')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('creado_en', desde.toISOString())
  if ((count ?? 0) >= LIMITE_DIA)
    return fallo('rate_limited', 429, `Límite diario de ${LIMITE_DIA} lecturas alcanzado`)

  // ---------- Entrada ----------
  let imagenes: Imagen[]
  let nota = ''
  try {
    const cuerpo = await req.json()
    imagenes = Array.isArray(cuerpo?.imagenes) ? cuerpo.imagenes : []
    nota = typeof cuerpo?.nota === 'string' ? cuerpo.nota.slice(0, 5000) : ''
  } catch {
    return fallo('error', 400, 'Cuerpo inválido')
  }
  if (!imagenes.length || imagenes.length > MAX_IMAGENES)
    return fallo('image_rejected', 400, `Envía entre 1 y ${MAX_IMAGENES} imágenes`)
  if (
    imagenes.some((i) => !TIPOS_IMAGEN.has(i?.media_type) || typeof i?.data !== 'string' || !i.data)
  )
    return fallo('image_rejected', 400, 'Formato de imagen no soportado')

  // ---------- Listas desde la base (con los permisos del usuario) ----------
  const [subs, pers, emps] = await Promise.all([
    db.from('subcuentas').select('nombre').eq('activa', true).order('orden'),
    db.from('personas').select('nombre').is('eliminada_en', null).order('nombre_norm'),
    db.from('empresas').select('nombre').order('id'),
  ])
  if (subs.error || pers.error || emps.error)
    return fallo('error', 500, 'No se pudieron leer los catálogos')
  const prompt = construirPrompt(
    {
      subcuentas: subs.data.map((x) => x.nombre),
      solicitantes: pers.data.map((x) => x.nombre),
      empresas: emps.data.map((x) => x.nombre),
    },
    nota,
  )

  // ---------- Claude ----------
  const registrar = (ok: boolean, error: string | null, uso?: Anthropic.Beta.BetaUsage) =>
    admin.from('lecturas_ia').insert({
      user_id: userId,
      imagenes: imagenes.length,
      tokens_entrada: uso?.input_tokens ?? null,
      tokens_salida: uso?.output_tokens ?? null,
      ok,
      error,
    })

  try {
    const r = await anthropic.beta.messages.create({
      model: MODELO,
      max_tokens: 16000,
      // Si el modelo declina por política, la API reintenta en el modelo de respaldo recomendado.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: ESFUERZO, format: { type: 'json_schema', schema: ESQUEMA_SALIDA } },
      messages: [
        {
          role: 'user',
          content: [
            ...imagenes.map((i) => ({
              type: 'image' as const,
              source: {
                type: 'base64' as const,
                media_type: i.media_type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
                data: i.data,
              },
            })),
            { type: 'text' as const, text: prompt },
          ],
        },
      ],
    })

    if (r.stop_reason === 'refusal') {
      await registrar(false, `refusal:${r.stop_details?.category ?? ''}`, r.usage)
      return fallo('error', 422, 'El modelo no pudo procesar estas imágenes')
    }
    if (r.stop_reason === 'max_tokens') {
      await registrar(false, 'max_tokens', r.usage)
      return fallo('invalid_json', 422, 'La respuesta quedó incompleta')
    }
    const salida = r.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
    const respuesta = extraerRespuesta(salida)
    await registrar(true, null, r.usage)
    return responder({ respuesta })
  } catch (e) {
    if (e instanceof ErrorLectura) {
      await registrar(false, e.codigo)
      return fallo(e.codigo, 422, 'No se pudieron ordenar los datos')
    }
    if (e instanceof Anthropic.RateLimitError) {
      await registrar(false, 'anthropic_429')
      return fallo('rate_limited', 429, 'Servicio de lectura ocupado')
    }
    if (e instanceof Anthropic.BadRequestError) {
      // Lo más común: una imagen que la API no puede abrir.
      await registrar(false, `anthropic_400:${e.message.slice(0, 200)}`)
      return fallo(
        /image/i.test(e.message) ? 'image_rejected' : 'error',
        400,
        'Solicitud rechazada',
      )
    }
    if (e instanceof Anthropic.APIError) {
      await registrar(false, `anthropic_${e.status ?? 'x'}`)
      return fallo('error', 502, 'El servicio de lectura no respondió')
    }
    await registrar(false, String(e).slice(0, 200))
    return fallo('error', 500, 'Error inesperado')
  }
})
