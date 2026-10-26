-- Banco y conciliación (spec 07): guardar cartolas, confirmar propuestas, asignación manual, deshacer y
-- eliminar cartolas. Un movimiento está "asignado" cuando un pago lo tiene en movimiento_id.
-- Los pagos creados desde Banco llevan obs = 'Banco': al deshacer se borran; un pago que ya existía
-- solo se desvincula.

create or replace function public._exigir_tesoreria()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.es_tesoreria() then
    raise exception 'Solo tesorería puede conciliar el banco.' using errcode = '42501';
  end if;
end;
$$;

/**
 * Guarda una cartola con sus movimientos en una sola transacción. Devuelve su id.
 * p = { nombre_archivo, medio_pago_id, movimientos: [{ idx, fecha, descripcion, referencia, cargo, abono }] }
 */
create or replace function public.guardar_cartola(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform public._exigir_tesoreria();
  if jsonb_typeof(p -> 'movimientos') <> 'array' or jsonb_array_length(p -> 'movimientos') = 0 then
    raise exception 'La cartola no tiene movimientos.';
  end if;
  insert into public.cartolas (nombre_archivo, medio_pago_id, subido_por)
  values (coalesce(nullif(btrim(p ->> 'nombre_archivo'), ''), 'cartola'),
          nullif(p ->> 'medio_pago_id', '')::smallint, auth.uid())
  returning id into v_id;
  insert into public.cartola_movimientos (cartola_id, idx, fecha, descripcion, referencia, cargo, abono)
  select v_id, m.idx, m.fecha, left(coalesce(m.descripcion, ''), 140), left(coalesce(m.referencia, ''), 40),
         abs(coalesce(m.cargo, 0)), abs(coalesce(m.abono, 0))
    from jsonb_to_recordset(p -> 'movimientos') as m(
      idx integer, fecha date, descripcion text, referencia text, cargo numeric, abono numeric);
  return v_id;
end;
$$;

/** Bloquea un cargo libre (ni asignado ni ignorado) para asignarlo. */
create or replace function public._tomar_cargo(p_id uuid)
returns public.cartola_movimientos
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.cartola_movimientos;
begin
  select * into v from public.cartola_movimientos where id = p_id for update;
  if not found then
    raise exception 'El movimiento ya no existe. Actualiza la página.';
  end if;
  if v.cargo <= 0 then
    raise exception 'Solo los cargos se asignan a rendiciones.';
  end if;
  if v.ignorado or exists (select 1 from public.pagos where movimiento_id = p_id) then
    raise exception 'El cargo del % por $ % ya fue asignado. Actualiza la página.',
      to_char(v.fecha, 'DD-MM-YYYY'), to_char(v.cargo, 'FM999G999G999');
  end if;
  return v;
end;
$$;

/**
 * Confirma un lote de asignaciones (propuestas marcadas o una asignación manual) en una transacción.
 * p = [{ movimiento_id, tipo: 'pago' | 'rendiciones' | 'anticipo', pago_id?, rendicion_ids?, persona_id? }]
 *   pago        → vincula un pago ya registrado (sin cartola) al cargo.
 *   rendiciones → crea un Pago por el monto del cargo vinculado a esas rendiciones (de una misma persona).
 *   anticipo    → crea un Anticipo a la persona por el monto del cargo.
 * Devuelve cuántos movimientos quedaron conciliados.
 */
create or replace function public.confirmar_conciliacion(p jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  it jsonb;
  m public.cartola_movimientos;
  v_medio smallint;
  v_tipo text;
  v_ids uuid[];
  v_persona uuid;
  v_pago uuid;
  n integer := 0;
begin
  perform public._exigir_tesoreria();
  if jsonb_typeof(p) <> 'array' then
    raise exception 'Nada que confirmar.';
  end if;

  for it in select * from jsonb_array_elements(p) loop
    m := public._tomar_cargo(nullif(it ->> 'movimiento_id', '')::uuid);
    select medio_pago_id into v_medio from public.cartolas where id = m.cartola_id;
    v_tipo := it ->> 'tipo';

    if v_tipo = 'pago' then
      update public.pagos
         set movimiento_id = m.id
       where id = nullif(it ->> 'pago_id', '')::uuid and movimiento_id is null
      returning id into v_pago;
      if v_pago is null then
        raise exception 'El pago propuesto ya no está libre. Actualiza la página.';
      end if;

    elsif v_tipo = 'rendiciones' then
      select coalesce(array_agg(distinct x::uuid), '{}')
        into v_ids
        from jsonb_array_elements_text(coalesce(it -> 'rendicion_ids', '[]'::jsonb)) x;
      if cardinality(v_ids) = 0 then
        raise exception 'Elige la rendición.';
      end if;
      select min(persona_id::text)::uuid into v_persona
        from public.rendiciones where id = any (v_ids) and estado = 'aprobada';
      if v_persona is null
         or (select count(*) from public.rendiciones
              where id = any (v_ids) and estado = 'aprobada' and persona_id = v_persona) <> cardinality(v_ids) then
        raise exception 'Las rendiciones deben estar aprobadas y ser de una misma persona.';
      end if;
      insert into public.pagos (persona_id, fecha, medio_pago_id, monto, tipo, movimiento_id, descripcion, origen, obs, creado_por)
      values (v_persona, m.fecha, v_medio, m.cargo, 'Pago', m.id, m.descripcion, 'App', 'Banco', auth.uid())
      returning id into v_pago;
      insert into public.pago_rendiciones (pago_id, rendicion_id) select v_pago, unnest(v_ids);

    elsif v_tipo = 'anticipo' then
      v_persona := nullif(it ->> 'persona_id', '')::uuid;
      if v_persona is null or not exists (select 1 from public.personas where id = v_persona) then
        raise exception 'Elige la persona del anticipo.';
      end if;
      insert into public.pagos (persona_id, fecha, medio_pago_id, monto, tipo, movimiento_id, descripcion, origen, obs, creado_por)
      values (v_persona, m.fecha, v_medio, m.cargo, 'Anticipo', m.id, m.descripcion, 'App', 'Banco', auth.uid());

    else
      raise exception 'Tipo de asignación desconocido: %', coalesce(v_tipo, '(vacío)');
    end if;
    n := n + 1;
  end loop;
  return n;
end;
$$;

/** Marca o desmarca un cargo como "No es de rendiciones". */
create or replace function public.ignorar_movimiento(p_id uuid, p_valor boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public._exigir_tesoreria();
  if p_valor then
    perform public._tomar_cargo(p_id);
  end if;
  update public.cartola_movimientos set ignorado = p_valor where id = p_id;
  if not found then
    raise exception 'El movimiento ya no existe. Actualiza la página.';
  end if;
end;
$$;

/** Deshace la asignación de un cargo: borra el pago creado desde Banco o desvincula el que ya existía. */
create or replace function public.deshacer_asignacion(p_movimiento_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.cartola_movimientos;
begin
  perform public._exigir_tesoreria();
  select * into v from public.cartola_movimientos where id = p_movimiento_id for update;
  if not found then
    raise exception 'El movimiento ya no existe. Actualiza la página.';
  end if;
  if v.ignorado then
    update public.cartola_movimientos set ignorado = false where id = v.id;
    return;
  end if;
  delete from public.pagos where movimiento_id = v.id and obs = 'Banco';
  if not found then
    update public.pagos set movimiento_id = null where movimiento_id = v.id;
    if not found then
      raise exception 'Este cargo no está asignado.';
    end if;
  end if;
end;
$$;

/** Elimina una cartola, borra los pagos que se crearon desde ella y desvincula los demás. Devuelve cuántos borró. */
create or replace function public.eliminar_cartola(p_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  perform public._exigir_tesoreria();
  delete from public.pagos
   where obs = 'Banco'
     and movimiento_id in (select id from public.cartola_movimientos where cartola_id = p_id);
  get diagnostics n = row_count;
  -- Los pagos que ya existían quedan sin cartola (movimiento_id → null por la FK).
  delete from public.cartolas where id = p_id;
  if not found then
    raise exception 'La cartola ya no existe. Actualiza la página.';
  end if;
  return n;
end;
$$;

revoke execute on function public._exigir_tesoreria() from public, anon, authenticated;
revoke execute on function public._tomar_cargo(uuid) from public, anon, authenticated;
revoke execute on function public.guardar_cartola(jsonb) from public, anon;
revoke execute on function public.confirmar_conciliacion(jsonb) from public, anon;
revoke execute on function public.ignorar_movimiento(uuid, boolean) from public, anon;
revoke execute on function public.deshacer_asignacion(uuid) from public, anon;
revoke execute on function public.eliminar_cartola(uuid) from public, anon;
grant execute on function public.guardar_cartola(jsonb) to authenticated;
grant execute on function public.confirmar_conciliacion(jsonb) to authenticated;
grant execute on function public.ignorar_movimiento(uuid, boolean) to authenticated;
grant execute on function public.deshacer_asignacion(uuid) to authenticated;
grant execute on function public.eliminar_cartola(uuid) to authenticated;
