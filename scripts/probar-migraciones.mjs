#!/usr/bin/env node
// Prueba las migraciones SIN Docker: las aplica sobre PGlite (Postgres en WebAssembly) con imitaciones
// mínimas de los esquemas auth y storage de Supabase, y verifica datos iniciales, triggers, el hook de
// correo y las políticas RLS con usuarios simulados. Uso: npm run db:probar
// No reemplaza probar contra Supabase real (roles, grants y Storage reales difieren en detalles).
import { PGlite } from '@electric-sql/pglite'
import { citext } from '@electric-sql/pglite/contrib/citext'
import { unaccent } from '@electric-sql/pglite/contrib/unaccent'
import { readdirSync, readFileSync } from 'node:fs'

const repo = process.argv[2] ?? '.'
const db = new PGlite({ extensions: { citext, unaccent } })
let fallos = 0
const ok = (cond, msg) => {
  console.log(`${cond ? '✔' : '✘'} ${msg}`)
  if (!cond) fallos++
}
const debeFallar = async (sql, msg, params) => {
  try {
    await db.query(sql, params)
    ok(false, `${msg} (no falló)`)
  } catch (e) {
    ok(true, `${msg} → ${e.message.split('\n')[0]}`)
  }
}

// ---------- Stubs de Supabase ----------
await db.exec(`
  create schema extensions;
  create role authenticated nologin; create role anon nologin; create role supabase_auth_admin nologin;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, last_sign_in_at timestamptz, created_at timestamptz default now());
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as
    $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
`)

// ---------- Migraciones ----------
const dir = `${repo}/supabase/migrations`
for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
  try {
    await db.exec(readFileSync(`${dir}/${f}`, 'utf8'))
    ok(true, `migración ${f}`)
  } catch (e) {
    ok(false, `migración ${f}: ${e.message}`)
    process.exit(1)
  }
}

// Permisos por defecto de Supabase para el rol authenticated
await db.exec(`
  grant usage on schema public, extensions, auth, storage to authenticated;
  grant select, insert, update, delete on all tables in schema public to authenticated;
  grant select, insert, update, delete on storage.objects to authenticated;
  grant execute on all functions in schema public, auth, storage to authenticated;
`)

const uno = async (sql, p) => (await db.query(sql, p)).rows[0]
const valor = async (sql, p) => Object.values((await uno(sql, p)) ?? {})[0]

// ---------- Datos iniciales ----------
ok((await valor('select count(*)::int from public.personas')) === 27, '27 personas')
ok((await valor('select count(*)::int from public.subcuentas')) === 62, '62 subcuentas')
ok(
  (await valor(`select c.nombre from public.subcuentas s join public.cuentas c on c.id = s.cuenta_sugerida_id where s.nombre = 'Instituto Salud Publica (CDA)'`)) ===
    'Importaciones / Export. ',
  'cuenta sugerida con grafía exacta',
)
ok((await valor(`select public.normalizar('  Rodrigo  Ibañez ')`)) === 'rodrigo ibanez', 'normalizar()')
ok((await valor(`select nombre_norm from public.personas where codigo = 'RIB'`)) === 'rodrigo ibanez', 'nombre_norm generado')

// ---------- Hook de correo ----------
ok(JSON.stringify(await valor(`select public.hook_validar_correo('{"user":{"email":"KJPR.2904@gmail.com"}}')`)) === '{}', 'hook: correo registrado (sin importar mayúsculas)')
const rechazo = await valor(`select public.hook_validar_correo('{"user":{"email":"otro@x.cl"}}')`)
ok(rechazo?.error?.http_code === 403, `hook: correo no registrado → ${rechazo?.error?.message}`)

// ---------- Vínculo cuenta → persona ----------
await db.exec(`update public.personas set correo = 'raul@ejemplo.cl' where codigo = 'RDI'`)
const admin = await valor(`insert into auth.users (email) values ('kjpr.2904@gmail.com') returning id`)
const raul = await valor(`insert into auth.users (email) values ('Raul@Ejemplo.cl') returning id`)
const extra = await valor(`insert into auth.users (email) values ('nadie@ejemplo.cl') returning id`)
ok((await valor(`select codigo from public.personas where user_id = $1`, [admin])) === 'KPI', 'admin vinculado por correo')
ok((await valor(`select codigo from public.personas where user_id = $1`, [raul])) === 'RDI', 'solicitante vinculado (correo sin importar mayúsculas)')
const raulPersona = await valor(`select id from public.personas where codigo = 'RDI'`)
const dhePersona = await valor(`select id from public.personas where codigo = 'DHE'`)

// ---------- Rendiciones y total por trigger ----------
const r1 = await valor(`insert into public.rendiciones (persona_id, nro, fecha) values ($1, 1, '2026-10-01') returning id`, [raulPersona])
const r2 = await valor(`insert into public.rendiciones (persona_id, nro, fecha, folio, estado) values ($1, 42, '2026-10-14', 'DHE-042', 'aprobada') returning id`, [dhePersona])
await db.query(`insert into public.rendicion_lineas (rendicion_id, exento) values ($1, 70389), ($1, 1000.5)`, [r1])
await db.query(`insert into public.rendicion_lineas (rendicion_id, neto, iva) values ($1, 10000, 1900)`, [r2])
ok(Number(await valor(`select total from public.rendiciones where id = $1`, [r1])) === 71389.5, 'total = suma de líneas')
await db.query(`delete from public.rendicion_lineas where rendicion_id = $1 and exento = 1000.5`, [r1])
ok(Number(await valor(`select total from public.rendiciones where id = $1`, [r1])) === 70389, 'total se recalcula al borrar línea')
await db.query(`insert into public.rendicion_eventos (rendicion_id, evento) values ($1, 'Enviada'), ($2, 'Aprobada')`, [r1, r2])
const pago = await valor(`insert into public.pagos (persona_id, fecha, monto) values ($1, '2026-10-20', 11900) returning id`, [dhePersona])
await db.query(`insert into public.pago_rendiciones values ($1, $2)`, [pago, r2])
await debeFallar(`insert into public.pagos (persona_id, monto, tipo) values ($1, 500, 'Devolución de la persona')`, 'devolución debe ser negativa', [dhePersona])
await debeFallar(`update public.personas set rol = 'tesorero' where codigo in ('DHE', 'MGU')`, 'un solo tesorero')

// ---------- RLS ----------
async function como(uid, fn) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false);`)
  try {
    await fn()
  } finally {
    await db.exec(`reset role;`)
  }
}

await como(raul, async () => {
  ok((await valor(`select public.mi_rol()::text`)) === 'solicitante', 'Raúl: rol solicitante')
  ok((await valor(`select count(*)::int from public.rendiciones`)) === 1, 'Raúl: ve solo su rendición')
  ok((await valor(`select count(*)::int from public.rendicion_lineas`)) === 1, 'Raúl: ve solo sus líneas')
  ok((await valor(`select count(*)::int from public.rendicion_eventos`)) === 1, 'Raúl: ve solo sus eventos')
  ok((await valor(`select count(*)::int from public.pagos`)) === 0, 'Raúl: no ve pagos ajenos')
  ok((await valor(`select count(*)::int from public.pago_rendiciones`)) === 0, 'Raúl: no ve vínculos ajenos')
  ok((await valor(`select count(*)::int from public.personas`)) === 27, 'Raúl: ve las personas activas')
  ok((await valor(`select count(*)::int from public.subcuentas`)) === 62, 'Raúl: lee catálogos')
  await debeFallar(`insert into public.rendiciones (persona_id, nro, fecha) values ('${raulPersona}', 2, '2026-10-02')`, 'Raúl: no inserta rendiciones directo (solo RPC)')
  ok((await db.query(`update public.personas set rol = 'administrador' where codigo = 'RDI'`)).affectedRows === 0, 'Raúl: no cambia su rol (0 filas)')
  ok((await valor(`select rol::text from public.personas where codigo = 'RDI'`)) === 'solicitante', 'Raúl: su rol sigue igual')
  await debeFallar(`insert into public.cuentas (nombre) values ('X')`, 'Raúl: no edita catálogos')
  await debeFallar(`insert into public.cartolas (nombre_archivo) values ('x.xlsx')`, 'Raúl: no carga cartolas')
  await db.query(`insert into storage.objects (bucket_id, name) values ('respaldos', $1)`, [`${raulPersona}/r/x.jpg`])
  ok(true, 'Raúl: sube foto a su carpeta')
  await debeFallar(`insert into storage.objects (bucket_id, name) values ('respaldos', '${dhePersona}/r/x.jpg')`, 'Raúl: no sube a carpeta ajena')
  ok((await db.query(`delete from storage.objects`)).affectedRows === 0, 'Raúl: no borra fotos (0 filas)')
})

await como(extra, async () => {
  ok((await valor(`select count(*)::int from public.rendiciones`)) === 0, 'cuenta sin persona: no ve rendiciones')
  ok((await valor(`select public.es_tesoreria()`)) === false, 'cuenta sin persona: no es tesorería')
})

await como(admin, async () => {
  ok((await valor(`select public.es_admin()`)) === true, 'admin: es_admin()')
  ok((await valor(`select count(*)::int from public.rendiciones`)) === 2, 'admin: ve todas las rendiciones')
  ok((await valor(`select count(*)::int from public.pagos`)) === 1, 'admin: ve todos los pagos')
  ok((await valor(`select count(*)::int from storage.objects`)) === 1, 'admin: ve todas las fotos')
  await db.query(`insert into public.cartolas (nombre_archivo) values ('x.xlsx')`)
  ok(true, 'admin: carga cartolas')
  ok((await db.query(`update public.personas set correo = 'manuel@ejemplo.cl' where codigo = 'MGU'`)).affectedRows === 1, 'admin: edita personas')
})

// ---------- RPC de Perfiles (8.2) ----------
const huerfana = await valor(`insert into auth.users (email) values ('ana.munoz@ejemplo.cl') returning id`)
await como(admin, async () => {
  const ana = await valor(`select public.guardar_persona('{"nombre":"  Ana   Muñoz ","codigo":"amu","correo":"Ana.Munoz@Ejemplo.cl"}')`)
  const fila = await uno(`select nombre, codigo, correo::text, es_nueva, rol::text, user_id from public.personas where id = $1`, [ana])
  ok(fila.nombre === 'Ana Muñoz' && fila.codigo === 'AMU' && fila.correo === 'ana.munoz@ejemplo.cl' && fila.es_nueva && fila.rol === 'solicitante', 'guardar_persona: alta normalizada')
  ok(fila.user_id === huerfana, 'guardar_persona: vincula la cuenta que ya existía con ese correo')
  await debeFallar(`select public.guardar_persona('{"nombre":"Otra Persona","codigo":"AMU"}')`, 'guardar_persona: código repetido')
  await debeFallar(`select public.guardar_persona('{"nombre":"david  HERCE","codigo":"DHZ"}')`, 'guardar_persona: persona repetida')
  await debeFallar(`select public.guardar_persona('{"nombre":"Otra Persona","codigo":"OPE","correo":"ANA.MUNOZ@ejemplo.cl"}')`, 'guardar_persona: correo repetido')
  await debeFallar(`select public.guardar_persona('{"nombre":"Sinapellido","codigo":"SIN"}')`, 'guardar_persona: exige nombre y apellido')
  // Edición: cambiar correo conservando la grafía exacta del nombre del historial
  const dhe = await valor(`select id from public.personas where codigo = 'DHE'`)
  await db.query(`select public.guardar_persona(jsonb_build_object('id', $1::text, 'nombre', 'David Herce', 'codigo', 'DHE', 'correo', 'david@ejemplo.cl'))`, [dhe])
  ok((await valor(`select nombre from public.personas where id = $1`, [dhe])) === 'David Herce ', 'guardar_persona: conserva la grafía del historial')

  // Funciones
  const mso = await valor(`select id from public.personas where codigo = 'MGU'`)
  const tca = await valor(`select id from public.personas where codigo = 'TCA'`)
  ok((await valor(`select public.asignar_rol($1, 'tesorero')`, [mso])) === null, 'asignar_rol: primer tesorero')
  ok((await valor(`select public.asignar_rol($1, 'tesorero')`, [tca])) === mso, 'asignar_rol: nuevo tesorero degrada al anterior')
  ok((await valor(`select rol::text from public.personas where id = $1`, [mso])) === 'solicitante', 'asignar_rol: el anterior quedó solicitante')
  const kpi = await valor(`select id from public.personas where codigo = 'KPI'`)
  await debeFallar(`select public.asignar_rol('${kpi}', 'solicitante')`, 'asignar_rol: no deja sin Administrador')
  await debeFallar(`select public.eliminar_persona('${kpi}')`, 'eliminar_persona: no al último Administrador')

  // Eliminar / restaurar
  await db.query(`select public.eliminar_persona($1)`, [tca])
  const el = await uno(`select eliminada_en is not null as e, rol::text, user_id from public.personas where id = $1`, [tca])
  ok(el.e && el.rol === 'solicitante', 'eliminar_persona: marca eliminada y libera el cupo de tesorero')
  await db.query(`select public.restaurar_persona($1)`, [tca])
  ok((await valor(`select eliminada_en is null from public.personas where id = $1`, [tca])) === true, 'restaurar_persona')

  // Cuentas
  const cuentas = (await db.query(`select * from public.listar_cuentas()`)).rows
  ok(cuentas.length === 4 && cuentas.some((c) => c.persona_nombre === 'Ana Muñoz'), 'listar_cuentas: cuentas con su persona')
  await db.query(`select public.vincular_cuenta($1, $2)`, [extra, mso])
  ok((await valor(`select codigo from public.personas where user_id = $1`, [extra])) === 'MGU', 'vincular_cuenta')
  await db.query(`select public.vincular_cuenta($1, null)`, [extra])
  ok((await valor(`select count(*)::int from public.personas where user_id = $1`, [extra])) === 0, 'vincular_cuenta: desvincular')
})
await como(raul, async () => {
  await debeFallar(`select public.guardar_persona('{"nombre":"Hacker Malo","codigo":"HMA"}')`, 'solicitante: no puede usar guardar_persona')
  await debeFallar(`select public.asignar_rol('${raulPersona}', 'administrador')`, 'solicitante: no puede cambiarse la función')
  await debeFallar(`select * from public.listar_cuentas()`, 'solicitante: no ve las cuentas')
})

// ---------- RPC enviar_rendicion (2.7) ----------
// Proveedor de prueba (RUT ficticio 9.999.999-3): desde la 11.4 cada línea enviada elige uno.
const prov = await valor(`insert into public.proveedores (nombre, rut) values ('Bencinera Prueba', '9999999-3') returning id`)
const nuevaId = '00000000-0000-4000-8000-000000000001'
const linea = (exento) => ({ tipo: 'Boleta', proveedor_id: prov, exento, subcuenta_id: 8 })
const envio = (extra = {}) =>
  JSON.stringify({
    id: nuevaId,
    persona_id: raulPersona,
    nro: 33,
    fecha: '2026-10-20',
    empresa_id: 2,
    fondo: 'FONDOS POR RENDIR',
    total_formulario: 25000,
    lineas: [linea(15000), linea(10000)],
    respaldos: [`${raulPersona}/${nuevaId}/a.jpg`],
    ...extra,
  })
await como(raul, async () => {
  ok((await valor(`select public.siguiente_nro($1)`, [raulPersona])) === 2, 'siguiente_nro: mayor Nº de la persona + 1')
  await debeFallar(`select public.siguiente_nro('${dhePersona}')`, 'siguiente_nro: un solicitante no ve el de otra persona')
  ok((await valor(`select public.enviar_rendicion($1::jsonb)`, [envio()])) === nuevaId, 'enviar_rendicion: crea la rendición')
  ok((await valor(`select nro from public.rendiciones where id = $1`, [nuevaId])) === 2, 'enviar_rendicion: asigna el correlativo e ignora el Nº del payload')
  const r = await uno(`select estado::text, total, origen::text, folio from public.rendiciones where id = $1`, [nuevaId])
  ok(r.estado === 'en_revision' && Number(r.total) === 25000 && r.origen === 'App' && r.folio === null, 'enviar_rendicion: en revisión, total por trigger, sin folio')
  ok((await valor(`select nota from public.rendicion_eventos where rendicion_id = $1 and evento = 'Enviada'`, [nuevaId])) === '2 gasto(s) por $ 25.000', 'enviar_rendicion: evento Enviada con resumen')
  ok((await valor(`select count(*)::int from public.respaldos where rendicion_id = $1`, [nuevaId])) === 1, 'enviar_rendicion: guarda el respaldo')
  await debeFallar(`select public.enviar_rendicion($1::jsonb)`, 'enviar_rendicion: no a nombre de otra persona', [envio({ id: '00000000-0000-4000-8000-000000000002', persona_id: dhePersona, respaldos: [] })])
  await debeFallar(`select public.enviar_rendicion($1::jsonb)`, 'enviar_rendicion: foto de otra carpeta', [envio({ id: '00000000-0000-4000-8000-000000000003', respaldos: [`${dhePersona}/x/a.jpg`] })])
  await debeFallar(`select public.enviar_rendicion($1::jsonb)`, 'enviar_rendicion: sin líneas', [envio({ id: '00000000-0000-4000-8000-000000000004', lineas: [] })])
  const l = await uno(`select proveedor_id, proveedor, rut from public.rendicion_lineas where rendicion_id = $1 order by orden limit 1`, [nuevaId])
  ok(l.proveedor_id === prov && l.proveedor === 'Bencinera Prueba' && l.rut === '9999999-3', 'enviar_rendicion: nombre y RUT de la línea salen del registro de proveedores')
  const sinProv = '00000000-0000-4000-8000-00000000000a'
  await debeFallar(`select public.enviar_rendicion($1::jsonb)`, 'enviar_rendicion: exige proveedor de la lista en cada línea', [envio({ id: sinProv, lineas: [linea(25000), { tipo: 'Boleta', proveedor: 'Escrito a mano', exento: 1 }], respaldos: [`${raulPersona}/${sinProv}/a.jpg`] })])
  ok((await valor(`select count(*)::int from public.rendiciones where id = $1`, [sinProv])) === 0, 'enviar_rendicion: sin proveedor no deja nada a medias')
  await debeFallar(`select public.enviar_rendicion($1::jsonb)`, 'enviar_rendicion: proveedor inexistente', [envio({ id: sinProv, lineas: [{ ...linea(1), proveedor_id: '00000000-0000-4000-8000-0000000000ff' }], respaldos: [`${raulPersona}/${sinProv}/a.jpg`] })])
})
{
  const borrado = await valor(`insert into public.proveedores (nombre, rut, eliminado_en) values ('Cerrado', '10000001-6', now()) returning id`)
  await como(raul, async () => {
    const id = '00000000-0000-4000-8000-00000000000b'
    await debeFallar(`select public.enviar_rendicion($1::jsonb)`, 'enviar_rendicion: no con un proveedor eliminado', [envio({ id, lineas: [{ ...linea(1), proveedor_id: borrado }], respaldos: [`${raulPersona}/${id}/a.jpg`] })])
  })
  await db.query(`delete from public.proveedores where id = $1`, [borrado])
}

// ---------- Respaldos obligatorios y PDF (2.11) ----------
ok((await valor(`select 'application/pdf' = any(allowed_mime_types) from storage.buckets where id = 'respaldos'`)) === true, 'bucket respaldos: acepta PDF')
await como(raul, async () => {
  const sinRespaldo = '00000000-0000-4000-8000-000000000007'
  await debeFallar(`select public.enviar_rendicion($1::jsonb)`, 'enviar_rendicion: sin respaldos no se envía', [envio({ id: sinRespaldo, respaldos: [] })])
  ok((await valor(`select count(*)::int from public.rendiciones where id = $1`, [sinRespaldo])) === 0, 'enviar_rendicion: sin respaldos no deja nada a medias')
  const conPdf = '00000000-0000-4000-8000-000000000008'
  await db.query(`select public.enviar_rendicion($1::jsonb)`, [envio({ id: conPdf, respaldos: [`${raulPersona}/${conPdf}/a.jpg`, `${raulPersona}/${conPdf}/b.pdf`] })])
  const mimes = (await db.query(`select mime from public.respaldos where rendicion_id = $1 order by orden`, [conPdf])).rows.map((x) => x.mime)
  ok(JSON.stringify(mimes) === '["image/jpeg","application/pdf"]', 'enviar_rendicion: guarda fotos y PDF con su mime')
  await debeFallar(`select public.enviar_rendicion($1::jsonb)`, 'enviar_rendicion: extensión no permitida', [envio({ id: '00000000-0000-4000-8000-000000000009', respaldos: [`${raulPersona}/00000000-0000-4000-8000-000000000009/a.exe`] })])
})
await db.query(`update public.rendiciones set estado = 'observada' where id = $1`, ['00000000-0000-4000-8000-000000000008'])
await como(raul, async () => {
  const conPdf = '00000000-0000-4000-8000-000000000008'
  await db.query(`select public.enviar_rendicion($1::jsonb)`, [envio({ id: conPdf, respaldos: [] })])
  ok((await valor(`select estado::text from public.rendiciones where id = $1`, [conPdf])) === 'en_revision', 'reenvío: sin adjuntos nuevos pasa si ya tiene respaldos guardados')
})
// Tesorería la observa (por ahora directo; la RPC de decisiones es 3.2) y Raúl la reenvía corregida
await db.query(`update public.rendiciones set estado = 'observada' where id = $1`, [nuevaId])
await como(raul, async () => {
  await db.query(`select public.enviar_rendicion($1::jsonb)`, [envio({ lineas: [linea(25000)], respaldos: [`${raulPersona}/${nuevaId}/a.jpg`, `${raulPersona}/${nuevaId}/b.jpg`] })])
  const r = await uno(`select estado::text, total from public.rendiciones where id = $1`, [nuevaId])
  ok(r.estado === 'en_revision' && Number(r.total) === 25000, 'reenvío: vuelve a revisión con las líneas nuevas')
  ok((await valor(`select nro from public.rendiciones where id = $1`, [nuevaId])) === 2, 'reenvío: conserva el Nº')
  ok((await valor(`select count(*)::int from public.rendicion_lineas where rendicion_id = $1`, [nuevaId])) === 1, 'reenvío: reemplaza las líneas')
  ok((await valor(`select count(*)::int from public.respaldos where rendicion_id = $1`, [nuevaId])) === 2, 'reenvío: suma solo las fotos nuevas')
  ok((await valor(`select nota from public.rendicion_eventos where rendicion_id = $1 and evento = 'Reenviada'`, [nuevaId])).includes('corregida tras observación'), 'reenvío: evento Reenviada')
})
await db.query(`update public.rendiciones set estado = 'aprobada' where id = $1`, [nuevaId])
await como(raul, async () => {
  await debeFallar(`select public.enviar_rendicion($1::jsonb)`, 'reenvío: no si ya está aprobada', [envio()])
})
await como(admin, async () => {
  const otraId = '00000000-0000-4000-8000-000000000005'
  const id = await valor(`select public.enviar_rendicion($1::jsonb)`, [envio({ id: otraId, persona_id: dhePersona, respaldos: [`${dhePersona}/${otraId}/a.jpg`] })])
  ok(id === otraId, 'enviar_rendicion: tesorería puede enviar a nombre de otra persona')
  ok((await valor(`select nro from public.rendiciones where id = $1`, [otraId])) === 43, 'enviar_rendicion: correlativo de la otra persona (DHE-042 → 43)')
  ok((await valor(`select public.siguiente_nro($1)`, [raulPersona])) === 4, 'siguiente_nro: tesorería ve el de cualquiera')
})
await como(extra, async () => {
  await debeFallar(`select public.enviar_rendicion($1::jsonb)`, 'enviar_rendicion: cuenta sin persona no puede enviar', [envio({ id: '00000000-0000-4000-8000-000000000006' })])
})

// ---------- Por aprobar (spec 03) ----------
const ids = { a: '00000000-0000-4000-8000-0000000000a1', b: '00000000-0000-4000-8000-0000000000b1', c: '00000000-0000-4000-8000-0000000000c1' }
const envioRaul = (id, lineas) =>
  JSON.stringify({ id, persona_id: raulPersona, nro: 1, fecha: '2026-10-21', empresa_id: 2, lineas, respaldos: [`${raulPersona}/${id}/a.jpg`] })
const conCuenta = [{ tipo: 'Boleta', proveedor_id: prov, exento: 1000, subcuenta_id: 8, cuenta_id: 2, centro_costo_id: 3 }]
const sinCuenta = [{ tipo: 'Boleta', proveedor_id: prov, exento: 1000, subcuenta_id: 8 }]
const version = async (id) => valor(`select editado_en::text from public.rendiciones where id = $1`, [id])
await como(raul, async () => {
  for (const id of [ids.a, ids.b, ids.c]) await db.query(`select public.enviar_rendicion($1::jsonb)`, [envioRaul(id, sinCuenta)])
  const nros = (await db.query(`select nro from public.rendiciones where id in ($1, $2, $3) order by nro`, [ids.a, ids.b, ids.c])).rows.map((x) => x.nro)
  ok(JSON.stringify(nros) === '[4,5,6]', `enviar_rendicion: correlativos seguidos (${nros})`)
  await debeFallar(`select public.aprobar_rendicion('${ids.a}', '{"lineas": []}'::jsonb, null)`, 'aprobar: un solicitante no puede')
  ok((await valor(`select count(*)::int from public.v_rendiciones`)) >= 3 && (await valor(`select count(*)::int from public.v_rendiciones where persona_id <> $1`, [raulPersona])) === 0, 'v_rendiciones: el solicitante solo ve lo suyo')
  ok((await valor(`select n_lineas from public.v_rendiciones where id = $1`, [ids.a])) === 1, 'v_rendiciones: cuenta líneas')
})
await como(admin, async () => {
  ok((await valor(`select ultimo_evento from public.v_rendiciones where id = $1`, [ids.a])) === 'Enviada', 'v_rendiciones: último evento')
  await debeFallar(`select public.aprobar_rendicion('${ids.a}', $1::jsonb, null)`, 'aprobar: exige cuenta en cada línea', [JSON.stringify({ lineas: sinCuenta })])
  const f1 = await valor(`select public.aprobar_rendicion($1, $2::jsonb, $3::timestamptz)`, [ids.a, JSON.stringify({ lineas: conCuenta, empresa_id: 2 }), await version(ids.a)])
  ok(f1 === 'RDI-004', `aprobar: folio ${f1}`)
  const r = await uno(`select estado::text, decidido_por from public.rendiciones where id = $1`, [ids.a])
  ok(r.estado === 'aprobada' && r.decidido_por === admin, 'aprobar: queda aprobada y registra quién')
  ok((await valor(`select nota from public.rendicion_eventos where rendicion_id = $1 and evento = 'Aprobada'`, [ids.a])) === 'Ingresada al libro como RDI-004', 'aprobar: evento con el folio')
  await debeFallar(`select public.aprobar_rendicion('${ids.a}', $1::jsonb, null)`, 'aprobar: no dos veces', [JSON.stringify({ lineas: conCuenta })])
  // Un folio igual ya existe (p. ej. del historial): lleva sufijo
  await db.exec(`reset role; update public.rendiciones set folio = 'RDI-005' where id = '${r1}'; set role authenticated;`)
  const f2 = await valor(`select public.aprobar_rendicion($1, $2::jsonb, null)`, [ids.b, JSON.stringify({ lineas: conCuenta, nro: 99 })])
  ok(/^RDI-005-[0-9a-f]{2}$/.test(f2), `aprobar: folio repetido lleva sufijo e ignora el Nº del payload (${f2})`)
  await db.exec(`reset role; update public.rendiciones set folio = null where id = '${r1}'; set role authenticated;`)
  await debeFallar(`select public.observar_rendicion('${ids.c}', '  ', null)`, 'observar: exige motivo')
  const vieja = await version(ids.c)
  await db.query(`select public.observar_rendicion($1, 'Falta la boleta del taxi', $2::timestamptz)`, [ids.c, vieja])
  ok((await valor(`select nota_tesoreria from public.rendiciones where id = $1`, [ids.c])) === 'Falta la boleta del taxi', 'observar: guarda el motivo')
})
await como(raul, async () => {
  await db.query(`select public.enviar_rendicion($1::jsonb)`, [envioRaul(ids.c, conCuenta)])
  ok((await valor(`select estado::text from public.rendiciones where id = $1`, [ids.c])) === 'en_revision', 'observada → reenviada vuelve a revisión')
})
await como(admin, async () => {
  ok((await valor(`select ultimo_evento from public.v_rendiciones where id = $1`, [ids.c])) === 'Reenviada', 'v_rendiciones: marca Reenviada')
  await debeFallar(`select public.aprobar_rendicion('${ids.c}', $1::jsonb, '2000-01-01'::timestamptz)`, 'aprobar: versión vieja no pisa un reenvío', [JSON.stringify({ lineas: conCuenta })])
  await db.query(`select public.rechazar_rendicion($1, '', null)`, [ids.c])
  ok((await valor(`select nota_tesoreria from public.rendiciones where id = $1`, [ids.c])) === 'Rechazada por tesorería.', 'rechazar: motivo por defecto')
})
await como(raul, async () => {
  await debeFallar(`select public.enviar_rendicion($1::jsonb)`, 'rechazada no se puede reenviar', [envioRaul(ids.c, conCuenta)])
})

// ---------- Libro (spec 04) ----------
const conCuenta2 = [{ tipo: 'Boleta', proveedor: 'Texto del historial', exento: 2500, subcuenta_id: 8, cuenta_id: 2, centro_costo_id: 3 }, ...conCuenta]
await como(raul, async () => {
  await debeFallar(`select public.editar_rendicion('${ids.a}', $1::jsonb, null)`, 'editar: un solicitante no puede', [JSON.stringify({ lineas: conCuenta })])
  await debeFallar(`select public.eliminar_rendicion('${ids.a}', null)`, 'eliminar: un solicitante no puede')
  await debeFallar(`select public.marcar_exportadas(array['${ids.a}']::uuid[])`, 'marcar_exportadas: un solicitante no puede')
})
await db.query(`update public.rendiciones set origen = 'Histórico' where id = $1`, [r2])
await como(admin, async () => {
  const v = await version(ids.a)
  await debeFallar(`select public.editar_rendicion('${ids.a}', $1::jsonb, null)`, 'editar: exige cuenta en cada línea', [JSON.stringify({ lineas: sinCuenta })])
  const f = await valor(`select public.editar_rendicion($1, $2::jsonb, $3::timestamptz)`, [ids.a, JSON.stringify({ lineas: conCuenta2, empresa_id: 2 }), v])
  ok(f === 'RDI-004', 'editar: conserva el folio si no cambia la persona')
  ok(Number(await valor(`select total from public.rendiciones where id = $1`, [ids.a])) === 3500, 'editar: total con las líneas nuevas')
  ok((await valor(`select proveedor from public.rendicion_lineas where rendicion_id = $1 and proveedor_id is null`, [ids.a])) === 'Texto del historial', 'editar: una línea sin proveedor de la lista conserva su texto')
  ok((await valor(`select count(*)::int from public.rendicion_eventos where rendicion_id = $1 and evento = 'Editada por tesorería'`, [ids.a])) === 1, 'editar: evento Editada por tesorería')
  await debeFallar(`select public.editar_rendicion('${ids.a}', $1::jsonb, $2::timestamptz)`, 'editar: versión vieja no pisa otra edición', [JSON.stringify({ lineas: conCuenta }), v])
  ok((await valor(`select public.editar_rendicion($1, $2::jsonb, null)`, [ids.a, JSON.stringify({ lineas: conCuenta, nro: 36 })])) === 'RDI-004', 'editar: ignora el Nº del payload')
  const fd = await valor(`select public.editar_rendicion($1, $2::jsonb, null)`, [ids.a, JSON.stringify({ lineas: conCuenta, persona_id: dhePersona })])
  ok(fd === 'DHE-044', `editar: otra persona → su siguiente Nº y nuevo folio (${fd})`)
  const f2 = await valor(`select public.editar_rendicion($1, $2::jsonb, null)`, [ids.a, JSON.stringify({ lineas: conCuenta, persona_id: raulPersona })])
  ok(f2 === 'RDI-007', `editar: de vuelta a la persona original → siguiente Nº (${f2})`)
  await debeFallar(`select public.editar_rendicion('${ids.c}', $1::jsonb, null)`, 'editar: solo aprobadas', [JSON.stringify({ lineas: conCuenta })])

  // Anular: solo origen App; vuelve a revisión con el folio
  await debeFallar(`select public.anular_aprobacion('${r2}', null)`, 'anular: historial no tiene aprobación que anular')
  await db.query(`select public.anular_aprobacion($1, null)`, [ids.a])
  const an = await uno(`select estado::text, aprobacion_anulada, folio from public.rendiciones where id = $1`, [ids.a])
  ok(an.estado === 'en_revision' && an.aprobacion_anulada && an.folio === 'RDI-007', 'anular: en revisión, marcada y con su folio')
  ok((await valor(`select ultimo_evento from public.v_rendiciones where id = $1`, [ids.a])) === 'Aprobación anulada', 'anular: evento')
  await debeFallar(`select public.anular_aprobacion('${ids.a}', null)`, 'anular: no dos veces')
  ok((await valor(`select public.aprobar_rendicion($1, $2::jsonb, null)`, [ids.a, JSON.stringify({ lineas: conCuenta })])) === 'RDI-007', 'reaprobar: conserva el folio')

  // Eliminar y restaurar al estado anterior
  await db.query(`select public.eliminar_rendicion($1, '')`, [ids.a])
  const el = await uno(`select estado::text, estado_previo::text, nota_tesoreria from public.rendiciones where id = $1`, [ids.a])
  ok(el.estado === 'eliminada' && el.estado_previo === 'aprobada' && el.nota_tesoreria === 'Eliminada por tesorería.', 'eliminar: guarda el estado previo y el motivo')
  await debeFallar(`select public.eliminar_rendicion('${ids.a}', null)`, 'eliminar: no dos veces')
  ok((await valor(`select public.restaurar_rendicion($1)::text`, [ids.a])) === 'aprobada', 'restaurar: vuelve a aprobada')
  ok((await valor(`select nota_tesoreria from public.rendiciones where id = $1`, [ids.a])) === null, 'restaurar: limpia el motivo de eliminación')
  await debeFallar(`select public.restaurar_rendicion('${ids.a}')`, 'restaurar: solo eliminadas')
  await db.query(`select public.eliminar_rendicion($1, 'Duplicada')`, [ids.c])
  ok((await valor(`select public.restaurar_rendicion($1)::text`, [ids.c])) === 'rechazada', 'restaurar: una rechazada vuelve a rechazada')

  // Exportadas: solo aprobadas, una vez
  ok((await valor(`select public.marcar_exportadas(array[$1, $2, $3]::uuid[])`, [ids.a, ids.b, ids.c])) === 2, 'marcar_exportadas: solo aprobadas')
  ok((await valor(`select public.marcar_exportadas(array[$1]::uuid[])`, [ids.a])) === 0, 'marcar_exportadas: no repite')
})

// ---------- Pagos (spec 06) ----------
const pagoJson = (c) => JSON.stringify({ persona_id: raulPersona, tipo: 'Pago', fecha: '2026-10-25', medio_pago_id: 2, monto: 1000, rendicion_ids: [], ...c })
await como(raul, async () => {
  await debeFallar(`select public.registrar_pago($1::jsonb)`, 'registrar_pago: un solicitante no puede', [pagoJson({})])
})
await como(admin, async () => {
  await debeFallar(`select public.registrar_pago($1::jsonb)`, 'registrar_pago: exige monto', [pagoJson({ monto: 0 })])
  await debeFallar(`select public.registrar_pago($1::jsonb)`, 'registrar_pago: no vincula rendiciones de otra persona', [pagoJson({ rendicion_ids: [r2] })])
  await debeFallar(`select public.registrar_pago($1::jsonb)`, 'registrar_pago: no vincula rendiciones no aprobadas', [pagoJson({ rendicion_ids: [ids.c] })])
  const pg = await valor(`select public.registrar_pago($1::jsonb)`, [pagoJson({ monto: 3500, rendicion_ids: [ids.a, ids.a, ids.b] })])
  const fila = await uno(`select monto, origen::text, creado_por from public.pagos where id = $1`, [pg])
  ok(Number(fila.monto) === 3500 && fila.origen === 'App' && fila.creado_por === admin, 'registrar_pago: guarda monto, origen y quién')
  ok((await valor(`select count(*)::int from public.pago_rendiciones where pago_id = $1`, [pg])) === 2, 'registrar_pago: vínculos sin repetir')
  const dev = await valor(`select public.registrar_pago($1::jsonb)`, [pagoJson({ tipo: 'Devolución de la persona', monto: 500 })])
  ok(Number(await valor(`select monto from public.pagos where id = $1`, [dev])) === -500, 'registrar_pago: devolución en negativo')
  const ant = await valor(`select public.registrar_pago($1::jsonb)`, [pagoJson({ tipo: 'Anticipo', monto: -800, fecha: '' })])
  const a = await uno(`select monto, fecha = current_date as hoy from public.pagos where id = $1`, [ant])
  ok(Number(a.monto) === 800 && a.hoy, 'registrar_pago: anticipo en positivo y fecha de hoy por defecto')
  await db.exec(`reset role`)
  const cartola = await valor(`insert into public.cartolas (nombre_archivo) values ('c.xlsx') returning id`)
  const mov = await valor(`insert into public.cartola_movimientos (cartola_id, idx, fecha, cargo) values ($1, 0, '2026-10-25', 800) returning id`, [cartola])
  await db.query(`update public.pagos set movimiento_id = $1 where id = $2`, [mov, ant])
  await db.exec(`set role authenticated`)
  await debeFallar(`select public.eliminar_pago('${ant}')`, 'eliminar_pago: no los de cartola')
  await db.query(`select public.eliminar_pago($1)`, [pg])
  ok((await valor(`select count(*)::int from public.pago_rendiciones where pago_id = $1`, [pg])) === 0, 'eliminar_pago: borra el pago y sus vínculos')
  await debeFallar(`select public.eliminar_pago('${pg}')`, 'eliminar_pago: ya no existe')
})
await como(raul, async () => {
  ok((await valor(`select count(*)::int from public.pagos`)) === 2, 'Raúl: ve sus pagos registrados por tesorería')
  await debeFallar(`select public.eliminar_pago('${dhePersona}')`, 'eliminar_pago: un solicitante no puede')
})

// ---------- Banco (spec 07) ----------
const movsJson = JSON.stringify({
  nombre_archivo: 'cartola-octubre.xlsx',
  medio_pago_id: 2,
  movimientos: [
    { idx: 0, fecha: '2026-10-22', descripcion: 'TRANSF RAUL DIAZ', referencia: '1', cargo: 1000, abono: 0 },
    { idx: 1, fecha: '2026-10-23', descripcion: 'TRANSF RAUL DIAZ', referencia: '2', cargo: 3000, abono: 0 },
    { idx: 2, fecha: '2026-10-24', descripcion: 'COMISION', referencia: '3', cargo: 990, abono: 0 },
    { idx: 3, fecha: '2026-10-24', descripcion: 'ABONO CLIENTE', referencia: '4', cargo: 0, abono: 50000 },
    { idx: 4, fecha: '2026-10-25', descripcion: 'PAGO MANUAL', referencia: '5', cargo: 700, abono: 0 },
  ],
})
let cart, mv
await como(raul, async () => {
  await debeFallar(`select public.guardar_cartola($1::jsonb)`, 'guardar_cartola: un solicitante no puede', [movsJson])
})
await como(admin, async () => {
  await debeFallar(`select public.guardar_cartola('{"movimientos": []}'::jsonb)`, 'guardar_cartola: sin movimientos')
  cart = await valor(`select public.guardar_cartola($1::jsonb)`, [movsJson])
  ok((await valor(`select count(*)::int from public.cartola_movimientos where cartola_id = $1`, [cart])) === 5, 'guardar_cartola: guarda los movimientos')
  mv = Object.fromEntries((await db.query(`select idx, id from public.cartola_movimientos where cartola_id = $1`, [cart])).rows.map((r) => [r.idx, r.id]))
  // pago manual previo (sin cartola) para vincular
  const manual = await valor(`select public.registrar_pago($1::jsonb)`, [pagoJson({ monto: 700, fecha: '2026-10-25' })])
  const lote = [
    { movimiento_id: mv[0], tipo: 'rendiciones', rendicion_ids: [ids.a] },
    { movimiento_id: mv[1], tipo: 'anticipo', persona_id: raulPersona },
    { movimiento_id: mv[4], tipo: 'pago', pago_id: manual },
  ]
  await debeFallar(`select public.confirmar_conciliacion($1::jsonb)`, 'confirmar: rendiciones de distintas personas', [JSON.stringify([{ movimiento_id: mv[0], tipo: 'rendiciones', rendicion_ids: [ids.a, r2] }])])
  await debeFallar(`select public.confirmar_conciliacion($1::jsonb)`, 'confirmar: un abono no se asigna', [JSON.stringify([{ movimiento_id: mv[3], tipo: 'anticipo', persona_id: raulPersona }])])
  ok((await valor(`select public.confirmar_conciliacion($1::jsonb)`, [JSON.stringify(lote)])) === 3, 'confirmar: 3 conciliados')
  const creado = await uno(`select monto, tipo::text, obs, medio_pago_id, fecha::text from public.pagos where movimiento_id = $1`, [mv[0]])
  ok(Number(creado.monto) === 1000 && creado.tipo === 'Pago' && creado.obs === 'Banco' && creado.medio_pago_id === 2 && creado.fecha === '2026-10-22', 'confirmar: pago con monto, fecha y banco del cargo')
  ok((await valor(`select count(*)::int from public.pago_rendiciones pr join public.pagos p on p.id = pr.pago_id where p.movimiento_id = $1`, [mv[0]])) === 1, 'confirmar: vínculo a la rendición')
  ok((await valor(`select tipo::text from public.pagos where movimiento_id = $1`, [mv[1]])) === 'Anticipo', 'confirmar: anticipo')
  ok((await valor(`select id from public.pagos where movimiento_id = $1`, [mv[4]])) === manual, 'confirmar: vincula el pago ya registrado')
  await debeFallar(`select public.confirmar_conciliacion($1::jsonb)`, 'confirmar: un cargo no se asigna dos veces', [JSON.stringify([lote[1]])])
  await debeFallar(`select public.confirmar_conciliacion($1::jsonb)`, 'confirmar: todo o nada', [JSON.stringify([{ movimiento_id: mv[2], tipo: 'anticipo', persona_id: raulPersona }, lote[0]])])
  ok((await valor(`select count(*)::int from public.pagos where movimiento_id = $1`, [mv[2]])) === 0, 'confirmar: lote fallido no deja nada a medias')

  await db.query(`select public.ignorar_movimiento($1, true)`, [mv[2]])
  await debeFallar(`select public.confirmar_conciliacion($1::jsonb)`, 'confirmar: no un cargo ignorado', [JSON.stringify([{ movimiento_id: mv[2], tipo: 'anticipo', persona_id: raulPersona }])])
  await db.query(`select public.deshacer_asignacion($1)`, [mv[2]])
  ok((await valor(`select ignorado from public.cartola_movimientos where id = $1`, [mv[2]])) === false, 'deshacer: desmarca ignorado')
  await db.query(`select public.deshacer_asignacion($1)`, [mv[4]])
  ok((await uno(`select movimiento_id from public.pagos where id = $1`, [manual])).movimiento_id === null, 'deshacer: el pago manual solo se desvincula')
  await db.query(`select public.deshacer_asignacion($1)`, [mv[1]])
  ok((await valor(`select count(*)::int from public.pagos where movimiento_id = $1`, [mv[1]])) === 0, 'deshacer: borra el pago creado desde Banco')
  await debeFallar(`select public.deshacer_asignacion('${mv[1]}')`, 'deshacer: cargo sin asignar')

  await db.query(`select public.confirmar_conciliacion($1::jsonb)`, [JSON.stringify([lote[2]])])
  ok((await valor(`select public.eliminar_cartola($1)`, [cart])) === 1, 'eliminar_cartola: borra solo los pagos creados desde Banco')
  ok((await valor(`select count(*)::int from public.pagos where id = $1 and movimiento_id is null`, [manual])) === 1, 'eliminar_cartola: el pago manual queda, sin cartola')
  ok((await valor(`select count(*)::int from public.cartola_movimientos where cartola_id = $1`, [cart])) === 0, 'eliminar_cartola: borra sus movimientos')
})

// ---------- Proveedores (spec 11.2) ----------
// RUT ficticios: 12.345.678-5, 11.111.111-1, 10.000.013-K, 76.000.000-0
ok((await valor(`select public.normalizar_rut(' 10.000.013-k ')`)) === '10000013-K', 'normalizar_rut: sin puntos, DV en mayúscula')
ok((await valor(`select public.normalizar_rut('abc')`)) === '', 'normalizar_rut: sin forma de RUT → vacío')
ok((await valor(`select public.rut_valido('12.345.678-5') and public.rut_valido('10000013K') and public.rut_valido('76000000-0')`)) === true, 'rut_valido: DV correcto (incluye K y 0)')
ok((await valor(`select public.rut_valido('12.345.678-4') or public.rut_valido('') or public.rut_valido(null)`)) === false, 'rut_valido: DV incorrecto o vacío')
// Precarga: líneas ya guardadas con RUT válido (escrito de distintas formas) e inválido
{
  const lin = (proveedor, rut) => db.query(`insert into public.rendicion_lineas (rendicion_id, proveedor, rut, exento) values ($1, $2, $3, 1)`, [r2, proveedor, rut])
  await lin('Ferretería Uno', '12.345.678-5')
  await lin('Ferreteria Uno SpA', '123456785')
  await lin('Ferretería Uno', '12345678-5')
  await lin('Sin DV', '12.345.678-4')
  await lin('', '11.111.111-1')
  ok((await valor(`select public._precargar_proveedores()`)) === 1, 'precarga: un proveedor por RUT válido con nombre')
  const p = await uno(`select nombre, rut, creado_por from public.proveedores where rut = '12345678-5'`)
  ok(p.nombre === 'Ferretería Uno' && p.rut === '12345678-5' && p.creado_por === null, 'precarga: el nombre más usado y el RUT normalizado')
  ok((await valor(`select count(*)::int from public.rendicion_lineas where rendicion_id = $1 and proveedor_id is not null`, [r2])) === 3, 'precarga: vincula las líneas de ese RUT')
  ok((await valor(`select public._precargar_proveedores()`)) === 0, 'precarga: se puede repetir sin duplicar')
  await db.query(`delete from public.rendicion_lineas where rendicion_id = $1 and exento = 1`, [r2])
}
await como(raul, async () => {
  const p = await uno(`select * from public.crear_proveedor('  Taller   Dos ', '11.111.111-1')`)
  ok(p.nombre === 'Taller Dos' && p.rut === '11111111-1' && p.creado_por === raul, 'crear_proveedor: cualquiera agrega, nombre limpio y RUT normalizado')
  await debeFallar(`select public.crear_proveedor('Otro', '111111111')`, 'crear_proveedor: RUT repetido')
  await debeFallar(`select public.crear_proveedor('Otro', '12.345.678-4')`, 'crear_proveedor: RUT inválido')
  await debeFallar(`select public.crear_proveedor('  ', '10000013-K')`, 'crear_proveedor: falta el nombre')
  await debeFallar(`insert into public.proveedores (nombre, rut) values ('Directo', '10000013-K')`, 'proveedores: no se inserta directo (solo RPC)')
  await debeFallar(`select public.editar_proveedor('${p.id}', 'X', '11111111-1')`, 'editar_proveedor: un solicitante no puede')
  await debeFallar(`select public.eliminar_proveedor('${p.id}')`, 'eliminar_proveedor: un solicitante no puede')
  await debeFallar(`select public.importar_proveedores('[]'::jsonb)`, 'importar_proveedores: un solicitante no puede')
  ok((await valor(`select count(*)::int from public.proveedores`)) === 3, 'proveedores: todos leen los activos')
})
await como(extra, async () => {
  await debeFallar(`select public.crear_proveedor('Otro', '10000013-K')`, 'crear_proveedor: cuenta sin persona no puede')
})
await como(admin, async () => {
  const id = await valor(`select id from public.proveedores where rut = '11111111-1'`)
  const e = await uno(`select * from public.editar_proveedor($1, 'Taller Dos Ltda.', '11.111.111-1')`, [id])
  ok(e.nombre === 'Taller Dos Ltda.' && e.rut === '11111111-1', 'editar_proveedor: tesorería corrige el nombre')
  await debeFallar(`select public.editar_proveedor('${id}', 'X', '12345678-5')`, 'editar_proveedor: no al RUT de otro proveedor')
  await db.query(`select public.eliminar_proveedor($1)`, [id])
  ok((await valor(`select eliminado_en is not null from public.proveedores where id = $1`, [id])) === true, 'eliminar_proveedor: lo marca')
  ok((await valor(`select count(*)::int from public.proveedores`)) === 3, 'proveedores: tesorería ve también los eliminados')
  const filas = [
    { nombre: 'Nuevo Uno', rut: '10.000.013-k' },
    { nombre: 'Repetido', rut: '12345678-5' },
    { nombre: 'Malo', rut: '1-1' },
    { nombre: '', rut: '76000000-0' },
    { nombre: 'Nuevo Uno bis', rut: '10000013K' },
  ]
  ok((await valor(`select public.importar_proveedores($1::jsonb)`, [JSON.stringify(filas)])) === 1, 'importar_proveedores: solo agrega los nuevos válidos')
  ok((await valor(`select nombre from public.proveedores where rut = '12345678-5'`)) === 'Ferretería Uno', 'importar_proveedores: no pisa los existentes')
})
await como(raul, async () => {
  await debeFallar(`select public.crear_proveedor('Otro', '11111111-1')`, 'crear_proveedor: RUT de un eliminado avisa que tesorería lo restaura')
  ok((await valor(`select count(*)::int from public.proveedores`)) === 3, 'proveedores: el solicitante no ve los eliminados')
})
await como(admin, async () => {
  const id = await valor(`select id from public.proveedores where rut = '11111111-1'`)
  await db.query(`select public.eliminar_proveedor($1, false)`, [id])
  ok((await valor(`select eliminado_en from public.proveedores where id = $1`, [id])) === null, 'eliminar_proveedor(false): restaura')
})

// ---------- Nº de documento único por proveedor (spec 11.5) ----------
{
  const doc = (numero, tipo = 'Boleta') => ({ tipo, proveedor_id: prov, numero, exento: 1000, subcuenta_id: 8 })
  const enviarDoc = (id, lineas, persona = raulPersona) =>
    JSON.stringify({ id, persona_id: persona, fecha: '2026-10-22', empresa_id: 2, lineas, respaldos: [`${persona}/${id}/a.jpg`] })
  const [x, y, z, w] = ['d1', 'd2', 'd3', 'd4'].map((n) => `00000000-0000-4000-8000-0000000000${n}`)
  await como(raul, async () => {
    await db.query(`select public.enviar_rendicion($1::jsonb)`, [enviarDoc(x, [doc('A-1')])])
    ok(true, 'Nº doc.: el primer documento se guarda')
    await debeFallar(`select public.enviar_rendicion($1::jsonb)`, 'Nº doc.: mismo proveedor, tipo y Nº (sin importar mayúsculas ni espacios)', [enviarDoc(y, [doc(' a-1 ')])])
    await db.query(`select public.enviar_rendicion($1::jsonb)`, [enviarDoc(y, [doc('A-1', 'Factura')])])
    ok(true, 'Nº doc.: mismo Nº con otro tipo de documento sí se acepta')
    await debeFallar(`select public.enviar_rendicion($1::jsonb)`, 'Nº doc.: repetido dentro del mismo formulario', [enviarDoc(z, [doc('B-7'), doc('B-7')])])
    await db.query(`select public.enviar_rendicion($1::jsonb)`, [enviarDoc(z, [doc(''), doc('')])])
    ok(true, 'Nº doc.: las líneas sin Nº no se comparan')
    ok((await valor(`select public.documento_repetido('9.999.999-3', 'Boleta', 'a-1')`)) === true, 'documento_repetido: lo encuentra con el RUT escrito con puntos')
    ok((await valor(`select public.documento_repetido('9999999-3', 'Boleta', 'A-1', $1)`, [x])) === false, 'documento_repetido: excluye la rendición que se edita')
    ok((await valor(`select public.documento_repetido('9999999-3', 'Boleta', '')`)) === false, 'documento_repetido: sin Nº no hay repetido')
    // Reenvío de la misma rendición con el mismo documento: no choca consigo misma
    await db.query(`select public.enviar_rendicion($1::jsonb)`, [enviarDoc(x, [doc('A-1')])])
    ok(true, 'Nº doc.: un reenvío con el mismo documento no choca consigo mismo')
  })
  await como(admin, async () => {
    await debeFallar(`select public.enviar_rendicion($1::jsonb)`, 'Nº doc.: también contra rendiciones de otra persona', [enviarDoc(w, [doc('A-1')], dhePersona)])
    await db.query(`select public.rechazar_rendicion($1, 'Duplicada', null)`, [x])
  })
  await como(raul, async () => {
    ok((await valor(`select public.documento_repetido('9999999-3', 'Boleta', 'A-1')`)) === false, 'documento_repetido: una rechazada no cuenta')
  })
  // Historial con un documento repetido: editar sin cambiarlo no bloquea; cambiarlo a uno existente sí
  const h = []
  for (const nro of [900, 901]) {
    const id = await valor(`insert into public.rendiciones (persona_id, nro, fecha, folio, estado, origen) values ($1, $2, '2026-03-01', $3, 'aprobada', 'Histórico') returning id`, [raulPersona, nro, `RDI-${nro}`])
    await db.query(`insert into public.rendicion_lineas (rendicion_id, orden, tipo, rut, numero, exento, subcuenta_id, cuenta_id) values ($1, 1, 'Boleta', '9999999-3', 'H-1', 500, 8, 2)`, [id])
    h.push(id)
  }
  const lineaHist = (numero) => JSON.stringify({ lineas: [{ orden: 1, tipo: 'Boleta', rut: '9999999-3', numero, exento: 500, subcuenta_id: 8, cuenta_id: 2 }] })
  await como(admin, async () => {
    ok((await valor(`select public.editar_rendicion($1, $2::jsonb, null)`, [h[0], lineaHist('H-1')])) === 'RDI-900', 'Nº doc.: editar sin cambiar un repetido del historial no bloquea')
    await db.query(`select public.editar_rendicion($1, $2::jsonb, null)`, [h[0], lineaHist('Z-9')])
    ok(true, 'Nº doc.: cambiarlo a un Nº libre se acepta')
    await debeFallar(`select public.editar_rendicion($1, $2::jsonb, null)`, 'Nº doc.: cambiarlo a uno ya cargado en otra rendición bloquea', [h[0], lineaHist('H-1')])
  })
}

// ---------- Nueva subcuenta (spec 11.8) ----------
await como(raul, async () => {
  await debeFallar(`select public.crear_subcuenta('Peajes nuevos')`, 'crear_subcuenta: un solicitante no puede')
})
await como(admin, async () => {
  const antes = await valor(`select max(orden) from public.subcuentas`)
  const sc = await uno(`select * from public.crear_subcuenta('  Peajes   urbanos ', 2::smallint)`)
  ok(sc.nombre === 'Peajes urbanos' && sc.cuenta_sugerida_id === 2 && sc.activa && sc.orden === antes + 1, 'crear_subcuenta: nombre limpio, cuenta sugerida y al final de la lista')
  const sin = await uno(`select * from public.crear_subcuenta('Otra sin cuenta')`)
  ok(sin.cuenta_sugerida_id === null, 'crear_subcuenta: la cuenta sugerida es opcional')
  await debeFallar(`select public.crear_subcuenta('peajes URBANOS')`, 'crear_subcuenta: no repite un nombre (sin importar mayúsculas)')
  await debeFallar(`select public.crear_subcuenta('Bencina')`, 'crear_subcuenta: no repite una del Excel original')
  await debeFallar(`select public.crear_subcuenta('   ')`, 'crear_subcuenta: exige nombre')
  await debeFallar(`select public.crear_subcuenta('Con cuenta mala', 999::smallint)`, 'crear_subcuenta: la cuenta debe existir')
})
await como(raul, async () => {
  ok((await valor(`select count(*)::int from public.subcuentas where nombre = 'Peajes urbanos'`)) === 1, 'crear_subcuenta: todos la ven en el catálogo')
})

console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK')
process.exit(fallos ? 1 : 0)
