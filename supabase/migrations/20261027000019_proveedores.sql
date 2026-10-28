-- Ajustes del cliente (spec 11, tarea 11.2): registro de proveedores con RUT.
-- Cualquier usuario agrega; editar, eliminar/restaurar e importar solo tesorería. Todo por RPC.
-- Las líneas conservan proveedor y RUT de texto (lo que se rindió) y suman el vínculo proveedor_id.
-- Precarga: un proveedor por cada RUT válido ya usado en las líneas, con el nombre más usado.

-- ---------- RUT (equivale a src/domain/rut.ts) ----------
/** "12.345.678-k" → "12345678-K"; "" si no tiene forma de RUT. */
create or replace function public.normalizar_rut(t text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select coalesce(
    regexp_replace(
      substring(regexp_replace(upper(coalesce(t, '')), '[^0-9K]', '', 'g') from '^0*([0-9]{1,8}[0-9K])$'),
      '^([0-9]+)([0-9K])$', '\1-\2'
    ),
    ''
  )
$$;

/** Forma de RUT y dígito verificador (módulo 11) correctos. */
create or replace function public.rut_valido(t text)
returns boolean
language plpgsql
immutable
parallel safe
set search_path = ''
as $$
declare
  n text := public.normalizar_rut(t);
  cuerpo text;
  suma integer := 0;
  factor integer := 2;
  dv integer;
begin
  if n = '' then
    return false;
  end if;
  cuerpo := split_part(n, '-', 1);
  for i in reverse length(cuerpo)..1 loop
    suma := suma + substr(cuerpo, i, 1)::integer * factor;
    factor := case when factor = 7 then 2 else factor + 1 end;
  end loop;
  dv := 11 - suma % 11;
  return split_part(n, '-', 2) = case dv when 11 then '0' when 10 then 'K' else dv::text end;
end;
$$;

-- ---------- Tabla ----------
create table public.proveedores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (btrim(nombre) <> ''),
  rut text not null unique check (public.rut_valido(rut) and rut = public.normalizar_rut(rut)),
  creado_por uuid references auth.users on delete set null default auth.uid(),
  creado_en timestamptz not null default now(),
  eliminado_en timestamptz
);
comment on table public.proveedores is
  'Proveedores de boletas/facturas (spec 11). rut normalizado: 12345678-5. Se eliminan con eliminado_en.';

alter table public.rendicion_lineas add column proveedor_id uuid references public.proveedores;
create index on public.rendicion_lineas (proveedor_id);

-- Todos leen los activos (para elegirlos al rendir); tesorería también los eliminados.
-- Sin políticas de escritura: todo pasa por las RPC.
alter table public.proveedores enable row level security;
create policy "proveedores: leer" on public.proveedores for select to authenticated
  using (eliminado_en is null or (select public.es_tesoreria()));

-- ---------- RPC ----------
/** Nombre como se guarda: espacios colapsados y recortados. */
create or replace function public._nombre_proveedor(t text)
returns text
language sql
immutable
set search_path = ''
as $$
  select btrim(regexp_replace(coalesce(t, ''), '\s+', ' ', 'g'))
$$;

/** Valida nombre y RUT, y que el RUT no esté en otro proveedor. Devuelve el RUT normalizado. */
create or replace function public._validar_proveedor(p_nombre text, p_rut text, p_excluir uuid default null)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_rut text := public.normalizar_rut(p_rut);
  v_otro public.proveedores;
begin
  if public._nombre_proveedor(p_nombre) = '' then
    raise exception 'Escribe el nombre del proveedor.';
  end if;
  if not public.rut_valido(p_rut) then
    raise exception 'El RUT no es válido. Revisa el número y el dígito verificador.';
  end if;
  select * into v_otro from public.proveedores
   where rut = v_rut and id is distinct from p_excluir;
  if found then
    raise exception 'Ese RUT ya está registrado como «%».%', v_otro.nombre,
      case when v_otro.eliminado_en is not null then ' Está eliminado: tesorería puede restaurarlo.' else '' end;
  end if;
  return v_rut;
end;
$$;

/** Cualquier usuario con persona vinculada agrega un proveedor. */
create or replace function public.crear_proveedor(p_nombre text, p_rut text)
returns public.proveedores
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.proveedores;
begin
  if public.mi_persona_id() is null then
    raise exception 'Tu cuenta no está vinculada a una persona. Pide a tesorería que la vincule.'
      using errcode = '42501';
  end if;
  insert into public.proveedores (nombre, rut)
  values (public._nombre_proveedor(p_nombre), public._validar_proveedor(p_nombre, p_rut))
  returning * into v;
  return v;
end;
$$;

/** Tesorería corrige nombre o RUT. Las líneas ya guardadas conservan lo que se rindió. */
create or replace function public.editar_proveedor(p_id uuid, p_nombre text, p_rut text)
returns public.proveedores
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.proveedores;
begin
  if not public.es_tesoreria() then
    raise exception 'Solo tesorería puede editar proveedores.' using errcode = '42501';
  end if;
  update public.proveedores
     set nombre = public._nombre_proveedor(p_nombre),
         rut = public._validar_proveedor(p_nombre, p_rut, p_id)
   where id = p_id
  returning * into v;
  if not found then
    raise exception 'El proveedor no existe.';
  end if;
  return v;
end;
$$;

/** Tesorería elimina (deja de aparecer para elegir) o restaura un proveedor. */
create or replace function public.eliminar_proveedor(p_id uuid, p_eliminar boolean default true)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.es_tesoreria() then
    raise exception 'Solo tesorería puede eliminar proveedores.' using errcode = '42501';
  end if;
  update public.proveedores
     set eliminado_en = case when p_eliminar then coalesce(eliminado_en, now()) end
   where id = p_id;
  if not found then
    raise exception 'El proveedor no existe.';
  end if;
end;
$$;

/**
 * Tesorería importa una lista [{nombre, rut}]: agrega solo los nuevos (no pisa los existentes) y
 * salta filas sin nombre o con RUT inválido. Devuelve cuántos agregó.
 */
create or replace function public.importar_proveedores(p_filas jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  if not public.es_tesoreria() then
    raise exception 'Solo tesorería puede importar proveedores.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_filas) is distinct from 'array' then
    raise exception 'La lista de proveedores no es válida.';
  end if;
  insert into public.proveedores (nombre, rut)
  select distinct on (public.normalizar_rut(f.rut)) public._nombre_proveedor(f.nombre), public.normalizar_rut(f.rut)
    from jsonb_to_recordset(p_filas) as f(nombre text, rut text)
   where public._nombre_proveedor(f.nombre) <> '' and public.rut_valido(f.rut)
  on conflict (rut) do nothing;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- ---------- Precarga desde las líneas existentes ----------
/** Un proveedor por RUT válido usado en las líneas (nombre más usado) y vínculo de esas líneas. */
create or replace function public._precargar_proveedores()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  insert into public.proveedores (nombre, rut, creado_por)
  select distinct on (rut) nombre, rut, null
    from (
      select public.normalizar_rut(l.rut) as rut, public._nombre_proveedor(l.proveedor) as nombre,
             count(*) as usos
        from public.rendicion_lineas l
       where public.rut_valido(l.rut) and public._nombre_proveedor(l.proveedor) <> ''
       group by 1, 2
    ) t
   order by rut, usos desc, nombre
  on conflict (rut) do nothing;
  get diagnostics n = row_count;

  update public.rendicion_lineas l
     set proveedor_id = p.id
    from public.proveedores p
   where l.proveedor_id is null and public.rut_valido(l.rut) and p.rut = public.normalizar_rut(l.rut);
  return n;
end;
$$;

select public._precargar_proveedores();

-- ---------- Permisos ----------
revoke execute on function public._nombre_proveedor(text) from public, anon, authenticated;
revoke execute on function public._precargar_proveedores() from public, anon, authenticated;
revoke execute on function public._validar_proveedor(text, text, uuid) from public, anon, authenticated;
revoke execute on function public.crear_proveedor(text, text) from public, anon;
revoke execute on function public.editar_proveedor(uuid, text, text) from public, anon;
revoke execute on function public.eliminar_proveedor(uuid, boolean) from public, anon;
revoke execute on function public.importar_proveedores(jsonb) from public, anon;
grant execute on function public.crear_proveedor(text, text) to authenticated;
grant execute on function public.editar_proveedor(uuid, text, text) to authenticated;
grant execute on function public.eliminar_proveedor(uuid, boolean) to authenticated;
grant execute on function public.importar_proveedores(jsonb) to authenticated;
