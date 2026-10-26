-- RPC de Perfiles (spec 08). Solo administradores. Mensajes de error en español (se muestran tal cual).
-- Las mismas reglas están en src/domain/personas.ts para avisar en pantalla antes de llamar.

create or replace function public._exigir_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.es_admin() then
    raise exception 'Solo un Administrador puede gestionar perfiles.' using errcode = '42501';
  end if;
end;
$$;

-- Vincula la persona con la cuenta que ya exista con su correo (si ninguna de las dos está vinculada).
create or replace function public._vincular_por_correo(p_persona_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.personas p
     set user_id = u.id
    from auth.users u
   where p.id = p_persona_id
     and p.user_id is null
     and p.correo is not null
     and lower(u.email) = lower(p.correo::text)
     and not exists (select 1 from public.personas o where o.user_id = u.id);
end;
$$;

/**
 * Alta o edición de una persona: {id?, nombre, codigo, correo}. Devuelve el id.
 * El rol se cambia con asignar_rol (aplica las reglas de Tesorero/Administrador).
 */
create or replace function public.guardar_persona(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_nombre text := regexp_replace(btrim(coalesce(p ->> 'nombre', '')), '\s+', ' ', 'g');
  v_codigo text := upper(btrim(coalesce(p ->> 'codigo', '')));
  v_correo text := nullif(lower(btrim(coalesce(p ->> 'correo', ''))), '');
begin
  perform public._exigir_admin();

  if v_id is null and array_length(string_to_array(v_nombre, ' '), 1) < 2 then
    raise exception 'Escribe nombre y apellido.';
  end if;
  if v_codigo !~ '^[A-Z]{2,4}$' then
    raise exception 'El código debe tener entre 2 y 4 letras.';
  end if;
  if v_correo is not null and v_correo !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    raise exception 'Ese correo no tiene un formato válido.';
  end if;
  if v_id is null and exists (select 1 from public.personas where nombre_norm = public.normalizar(v_nombre)) then
    raise exception 'Esa persona ya está en la lista (o está eliminada: restáurala).';
  end if;
  if exists (select 1 from public.personas where codigo = v_codigo and id is distinct from v_id) then
    raise exception 'El código % ya lo usa otra persona.', v_codigo;
  end if;
  if v_correo is not null and exists (
    select 1 from public.personas where lower(correo::text) = v_correo and id is distinct from v_id
  ) then
    raise exception 'Ese correo ya lo usa otra persona.';
  end if;

  if v_id is null then
    insert into public.personas (nombre, codigo, correo, es_nueva)
    values (v_nombre, v_codigo, v_correo, true)
    returning id into v_id;
  else
    update public.personas
       set codigo = v_codigo,
           correo = v_correo,
           -- La grafía exacta del historial no se toca si solo cambian espacios.
           nombre = case when public.normalizar(nombre) = public.normalizar(v_nombre) then nombre else v_nombre end
     where id = v_id;
    if not found then
      raise exception 'La persona no existe.';
    end if;
  end if;

  perform public._vincular_por_correo(v_id);
  return v_id;
end;
$$;

/**
 * Cambia la función. Un solo Tesorero (el anterior pasa a Solicitante) y al menos un Administrador.
 * Devuelve el id del tesorero degradado, o null.
 */
create or replace function public.asignar_rol(p_persona_id uuid, p_rol public.rol_app)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actual public.rol_app;
  v_degradado uuid;
begin
  perform public._exigir_admin();
  -- Serializa cambios de función para que dos administradores no se pisen.
  perform 1 from public.personas where rol in ('tesorero', 'administrador') for update;

  select rol into v_actual from public.personas where id = p_persona_id and eliminada_en is null;
  if not found then
    raise exception 'La persona no existe o está eliminada.';
  end if;
  if v_actual = p_rol then
    return null;
  end if;
  if v_actual = 'administrador' and not exists (
    select 1 from public.personas
     where rol = 'administrador' and eliminada_en is null and id <> p_persona_id
  ) then
    raise exception 'Debe quedar al menos un Administrador.';
  end if;
  if p_rol = 'tesorero' then
    update public.personas
       set rol = 'solicitante'
     where rol = 'tesorero' and eliminada_en is null and id <> p_persona_id
    returning id into v_degradado;
  end if;
  update public.personas set rol = p_rol where id = p_persona_id;
  return v_degradado;
end;
$$;

/** Elimina (soft delete): sale de las listas, se desvincula su cuenta y su historial se mantiene. */
create or replace function public.eliminar_persona(p_persona_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public._exigir_admin();
  if exists (
    select 1 from public.personas where id = p_persona_id and rol = 'administrador' and eliminada_en is null
  ) and not exists (
    select 1 from public.personas
     where rol = 'administrador' and eliminada_en is null and id <> p_persona_id
  ) then
    raise exception 'Debe quedar al menos un Administrador.';
  end if;
  update public.personas
     set eliminada_en = now(),
         user_id = null,
         -- Un tesorero eliminado deja libre el cupo de Tesorero.
         rol = case when rol = 'tesorero' then 'solicitante'::public.rol_app else rol end
   where id = p_persona_id and eliminada_en is null;
  if not found then
    raise exception 'La persona no existe o ya estaba eliminada.';
  end if;
end;
$$;

create or replace function public.restaurar_persona(p_persona_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public._exigir_admin();
  update public.personas set eliminada_en = null where id = p_persona_id and eliminada_en is not null;
  if not found then
    raise exception 'La persona no existe o no estaba eliminada.';
  end if;
  perform public._vincular_por_correo(p_persona_id);
end;
$$;

/** Cuentas de usuario (auth.users no es visible al cliente) con su persona vinculada. */
create or replace function public.listar_cuentas()
returns table (user_id uuid, email text, ultimo_ingreso timestamptz, persona_id uuid, persona_nombre text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public._exigir_admin();
  return query
    select u.id, u.email::text, u.last_sign_in_at, p.id, p.nombre
      from auth.users u
      left join public.personas p on p.user_id = u.id
     order by u.created_at;
end;
$$;

/** Vincula una cuenta con una persona (o la desvincula con p_persona_id = null). */
create or replace function public.vincular_cuenta(p_user_id uuid, p_persona_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public._exigir_admin();
  update public.personas set user_id = null where user_id = p_user_id;
  if p_persona_id is not null then
    update public.personas set user_id = p_user_id where id = p_persona_id and eliminada_en is null;
    if not found then
      raise exception 'La persona no existe o está eliminada.';
    end if;
  end if;
end;
$$;

-- Solo usuarios con sesión pueden llamarlas (y adentro se exige Administrador).
revoke execute on function public._exigir_admin() from public, anon, authenticated;
revoke execute on function public._vincular_por_correo(uuid) from public, anon, authenticated;
revoke execute on function public.guardar_persona(jsonb) from public, anon;
revoke execute on function public.asignar_rol(uuid, public.rol_app) from public, anon;
revoke execute on function public.eliminar_persona(uuid) from public, anon;
revoke execute on function public.restaurar_persona(uuid) from public, anon;
revoke execute on function public.listar_cuentas() from public, anon;
revoke execute on function public.vincular_cuenta(uuid, uuid) from public, anon;
grant execute on function public.guardar_persona(jsonb) to authenticated;
grant execute on function public.asignar_rol(uuid, public.rol_app) to authenticated;
grant execute on function public.eliminar_persona(uuid) to authenticated;
grant execute on function public.restaurar_persona(uuid) to authenticated;
grant execute on function public.listar_cuentas() to authenticated;
grant execute on function public.vincular_cuenta(uuid, uuid) to authenticated;
