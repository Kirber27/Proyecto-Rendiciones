-- Personas y pagos (spec 06): registrar y eliminar pagos manuales (los de cartola van por Banco, spec 07).

/**
 * Registra un pago, anticipo, "No genera pago" o devolución de la persona, con sus vínculos opcionales.
 * p = { persona_id, tipo, fecha, medio_pago_id, monto, descripcion, rendicion_ids[] }
 * El signo lo pone el tipo: devolución en negativo, el resto en positivo. Devuelve el id del pago.
 */
create or replace function public.registrar_pago(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_persona uuid := nullif(p ->> 'persona_id', '')::uuid;
  v_tipo public.tipo_pago := coalesce(nullif(p ->> 'tipo', ''), 'Pago')::public.tipo_pago;
  v_monto numeric := coalesce(nullif(p ->> 'monto', '')::numeric, 0);
  v_ids uuid[] := coalesce(
    (select array_agg(x::uuid) from jsonb_array_elements_text(coalesce(p -> 'rendicion_ids', '[]'::jsonb)) x),
    '{}');
  v_ajenas integer;
  v_id uuid;
begin
  if not public.es_tesoreria() then
    raise exception 'Solo tesorería puede registrar pagos.' using errcode = '42501';
  end if;
  if v_persona is null or not exists (select 1 from public.personas where id = v_persona) then
    raise exception 'Elige la persona.';
  end if;
  if v_monto = 0 then
    raise exception 'Escribe el monto.';
  end if;
  v_monto := case when v_tipo = 'Devolución de la persona' then -abs(v_monto) else abs(v_monto) end;

  select count(*) into v_ajenas
    from unnest(v_ids) i
   where not exists (
     select 1 from public.rendiciones r
      where r.id = i and r.persona_id = v_persona and r.estado = 'aprobada');
  if v_ajenas > 0 then
    raise exception 'Solo se puede vincular a rendiciones aprobadas de la misma persona.';
  end if;

  insert into public.pagos (persona_id, fecha, medio_pago_id, monto, tipo, descripcion, origen, creado_por)
  values (
    v_persona,
    coalesce(nullif(p ->> 'fecha', '')::date, current_date),
    nullif(p ->> 'medio_pago_id', '')::smallint,
    v_monto,
    v_tipo,
    coalesce(btrim(p ->> 'descripcion'), ''),
    'App',
    auth.uid()
  )
  returning id into v_id;

  insert into public.pago_rendiciones (pago_id, rendicion_id)
  select v_id, i from (select distinct unnest(v_ids) as i) d;
  return v_id;
end;
$$;

/** Elimina un pago manual. Los respaldados por un cargo de cartola se desvinculan desde Banco. */
create or replace function public.eliminar_pago(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.pagos;
begin
  if not public.es_tesoreria() then
    raise exception 'Solo tesorería puede eliminar pagos.' using errcode = '42501';
  end if;
  select * into v from public.pagos where id = p_id for update;
  if not found then
    raise exception 'El pago ya no existe. Actualiza la lista.';
  end if;
  if v.movimiento_id is not null then
    raise exception 'Este pago viene de una cartola: desvincúlalo en Banco.';
  end if;
  delete from public.pagos where id = p_id;
end;
$$;

revoke execute on function public.registrar_pago(jsonb) from public, anon;
revoke execute on function public.eliminar_pago(uuid) from public, anon;
grant execute on function public.registrar_pago(jsonb) to authenticated;
grant execute on function public.eliminar_pago(uuid) to authenticated;

-- Realtime: el libro, Personas y la carpeta se refrescan al registrar pagos (RLS aplica a los eventos).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.pagos;
  end if;
end;
$$;
