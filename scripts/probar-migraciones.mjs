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
const nuevaId = '00000000-0000-4000-8000-000000000001'
const linea = (exento) => ({ tipo: 'Boleta', proveedor: 'COPEC', exento, subcuenta_id: 8 })
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
  ok((await valor(`select public.enviar_rendicion($1::jsonb)`, [envio()])) === nuevaId, 'enviar_rendicion: crea la rendición')
  const r = await uno(`select estado::text, total, origen::text, folio from public.rendiciones where id = $1`, [nuevaId])
  ok(r.estado === 'en_revision' && Number(r.total) === 25000 && r.origen === 'App' && r.folio === null, 'enviar_rendicion: en revisión, total por trigger, sin folio')
  ok((await valor(`select nota from public.rendicion_eventos where rendicion_id = $1 and evento = 'Enviada'`, [nuevaId])) === '2 gasto(s) por $ 25.000', 'enviar_rendicion: evento Enviada con resumen')
  ok((await valor(`select count(*)::int from public.respaldos where rendicion_id = $1`, [nuevaId])) === 1, 'enviar_rendicion: guarda el respaldo')
  await debeFallar(`select public.enviar_rendicion($1::jsonb)`, 'enviar_rendicion: no a nombre de otra persona', [envio({ id: '00000000-0000-4000-8000-000000000002', persona_id: dhePersona, respaldos: [] })])
  await debeFallar(`select public.enviar_rendicion($1::jsonb)`, 'enviar_rendicion: foto de otra carpeta', [envio({ id: '00000000-0000-4000-8000-000000000003', respaldos: [`${dhePersona}/x/a.jpg`] })])
  await debeFallar(`select public.enviar_rendicion($1::jsonb)`, 'enviar_rendicion: sin líneas', [envio({ id: '00000000-0000-4000-8000-000000000004', lineas: [] })])
})
// Tesorería la observa (por ahora directo; la RPC de decisiones es 3.2) y Raúl la reenvía corregida
await db.query(`update public.rendiciones set estado = 'observada' where id = $1`, [nuevaId])
await como(raul, async () => {
  await db.query(`select public.enviar_rendicion($1::jsonb)`, [envio({ lineas: [linea(25000)], respaldos: [`${raulPersona}/${nuevaId}/a.jpg`, `${raulPersona}/${nuevaId}/b.jpg`] })])
  const r = await uno(`select estado::text, total from public.rendiciones where id = $1`, [nuevaId])
  ok(r.estado === 'en_revision' && Number(r.total) === 25000, 'reenvío: vuelve a revisión con las líneas nuevas')
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
})
await como(extra, async () => {
  await debeFallar(`select public.enviar_rendicion($1::jsonb)`, 'enviar_rendicion: cuenta sin persona no puede enviar', [envio({ id: '00000000-0000-4000-8000-000000000006' })])
})

// ---------- Por aprobar (spec 03) ----------
const ids = { a: '00000000-0000-4000-8000-0000000000a1', b: '00000000-0000-4000-8000-0000000000b1', c: '00000000-0000-4000-8000-0000000000c1' }
const envioRaul = (id, nro, lineas) =>
  JSON.stringify({ id, persona_id: raulPersona, nro, fecha: '2026-10-21', empresa_id: 2, lineas, respaldos: [] })
const conCuenta = [{ tipo: 'Boleta', exento: 1000, subcuenta_id: 8, cuenta_id: 2, centro_costo_id: 3 }]
const sinCuenta = [{ tipo: 'Boleta', exento: 1000, subcuenta_id: 8 }]
const version = async (id) => valor(`select editado_en::text from public.rendiciones where id = $1`, [id])
await como(raul, async () => {
  for (const [id, nro] of [[ids.a, 34], [ids.b, 34], [ids.c, 35]]) await db.query(`select public.enviar_rendicion($1::jsonb)`, [envioRaul(id, nro, sinCuenta)])
  await debeFallar(`select public.aprobar_rendicion('${ids.a}', '{"lineas": []}'::jsonb, null)`, 'aprobar: un solicitante no puede')
  ok((await valor(`select count(*)::int from public.v_rendiciones`)) >= 3 && (await valor(`select count(*)::int from public.v_rendiciones where persona_id <> $1`, [raulPersona])) === 0, 'v_rendiciones: el solicitante solo ve lo suyo')
  ok((await valor(`select n_lineas from public.v_rendiciones where id = $1`, [ids.a])) === 1, 'v_rendiciones: cuenta líneas')
})
await como(admin, async () => {
  ok((await valor(`select ultimo_evento from public.v_rendiciones where id = $1`, [ids.a])) === 'Enviada', 'v_rendiciones: último evento')
  await debeFallar(`select public.aprobar_rendicion('${ids.a}', $1::jsonb, null)`, 'aprobar: exige cuenta en cada línea', [JSON.stringify({ lineas: sinCuenta })])
  const f1 = await valor(`select public.aprobar_rendicion($1, $2::jsonb, $3::timestamptz)`, [ids.a, JSON.stringify({ lineas: conCuenta, empresa_id: 2 }), await version(ids.a)])
  ok(f1 === 'RDI-034', `aprobar: folio ${f1}`)
  const r = await uno(`select estado::text, decidido_por from public.rendiciones where id = $1`, [ids.a])
  ok(r.estado === 'aprobada' && r.decidido_por === admin, 'aprobar: queda aprobada y registra quién')
  ok((await valor(`select nota from public.rendicion_eventos where rendicion_id = $1 and evento = 'Aprobada'`, [ids.a])) === 'Ingresada al libro como RDI-034', 'aprobar: evento con el folio')
  await debeFallar(`select public.aprobar_rendicion('${ids.a}', $1::jsonb, null)`, 'aprobar: no dos veces', [JSON.stringify({ lineas: conCuenta })])
  const f2 = await valor(`select public.aprobar_rendicion($1, $2::jsonb, null)`, [ids.b, JSON.stringify({ lineas: conCuenta })])
  ok(/^RDI-034-[0-9a-f]{2}$/.test(f2), `aprobar: Nº repetido lleva sufijo (${f2})`)
  await debeFallar(`select public.observar_rendicion('${ids.c}', '  ', null)`, 'observar: exige motivo')
  const vieja = await version(ids.c)
  await db.query(`select public.observar_rendicion($1, 'Falta la boleta del taxi', $2::timestamptz)`, [ids.c, vieja])
  ok((await valor(`select nota_tesoreria from public.rendiciones where id = $1`, [ids.c])) === 'Falta la boleta del taxi', 'observar: guarda el motivo')
})
await como(raul, async () => {
  await db.query(`select public.enviar_rendicion($1::jsonb)`, [envioRaul(ids.c, 35, conCuenta)])
  ok((await valor(`select estado::text from public.rendiciones where id = $1`, [ids.c])) === 'en_revision', 'observada → reenviada vuelve a revisión')
})
await como(admin, async () => {
  ok((await valor(`select ultimo_evento from public.v_rendiciones where id = $1`, [ids.c])) === 'Reenviada', 'v_rendiciones: marca Reenviada')
  await debeFallar(`select public.aprobar_rendicion('${ids.c}', $1::jsonb, '2000-01-01'::timestamptz)`, 'aprobar: versión vieja no pisa un reenvío', [JSON.stringify({ lineas: conCuenta })])
  await db.query(`select public.rechazar_rendicion($1, '', null)`, [ids.c])
  ok((await valor(`select nota_tesoreria from public.rendiciones where id = $1`, [ids.c])) === 'Rechazada por tesorería.', 'rechazar: motivo por defecto')
})
await como(raul, async () => {
  await debeFallar(`select public.enviar_rendicion($1::jsonb)`, 'rechazada no se puede reenviar', [envioRaul(ids.c, 35, conCuenta)])
})

// ---------- Libro (spec 04) ----------
const conCuenta2 = [{ tipo: 'Boleta', exento: 2500, subcuenta_id: 8, cuenta_id: 2, centro_costo_id: 3 }, ...conCuenta]
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
  ok(f === 'RDI-034', 'editar: conserva el folio si no cambian persona ni Nº')
  ok(Number(await valor(`select total from public.rendiciones where id = $1`, [ids.a])) === 3500, 'editar: total con las líneas nuevas')
  ok((await valor(`select count(*)::int from public.rendicion_eventos where rendicion_id = $1 and evento = 'Editada por tesorería'`, [ids.a])) === 1, 'editar: evento Editada por tesorería')
  await debeFallar(`select public.editar_rendicion('${ids.a}', $1::jsonb, $2::timestamptz)`, 'editar: versión vieja no pisa otra edición', [JSON.stringify({ lineas: conCuenta }), v])
  const f2 = await valor(`select public.editar_rendicion($1, $2::jsonb, null)`, [ids.a, JSON.stringify({ lineas: conCuenta, nro: 36 })])
  ok(f2 === 'RDI-036', `editar: nuevo Nº → nuevo folio (${f2})`)
  await debeFallar(`select public.editar_rendicion('${ids.c}', $1::jsonb, null)`, 'editar: solo aprobadas', [JSON.stringify({ lineas: conCuenta })])

  // Anular: solo origen App; vuelve a revisión con el folio
  await debeFallar(`select public.anular_aprobacion('${r2}', null)`, 'anular: historial no tiene aprobación que anular')
  await db.query(`select public.anular_aprobacion($1, null)`, [ids.a])
  const an = await uno(`select estado::text, aprobacion_anulada, folio from public.rendiciones where id = $1`, [ids.a])
  ok(an.estado === 'en_revision' && an.aprobacion_anulada && an.folio === 'RDI-036', 'anular: en revisión, marcada y con su folio')
  ok((await valor(`select ultimo_evento from public.v_rendiciones where id = $1`, [ids.a])) === 'Aprobación anulada', 'anular: evento')
  await debeFallar(`select public.anular_aprobacion('${ids.a}', null)`, 'anular: no dos veces')
  ok((await valor(`select public.aprobar_rendicion($1, $2::jsonb, null)`, [ids.a, JSON.stringify({ lineas: conCuenta })])) === 'RDI-036', 'reaprobar: conserva el folio')

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

console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK')
process.exit(fallos ? 1 : 0)
