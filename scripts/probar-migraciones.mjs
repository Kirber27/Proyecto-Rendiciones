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

console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK')
process.exit(fallos ? 1 : 0)
