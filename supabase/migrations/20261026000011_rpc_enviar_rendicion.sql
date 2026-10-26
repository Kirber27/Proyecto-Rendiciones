-- RPC enviar_rendicion (spec 02, 2.7). Crea o reenvía una rendición en una sola transacción.
-- p = { id, persona_id, nro, fecha, empresa_id, fondo, total_formulario, lineas: [...], respaldos: [path] }
-- El cliente genera el id (uuid) para subir antes las fotos a respaldos/<persona_id>/<id>/…

create or replace function public._clp(n numeric)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when n < 0 then '-' else '' end || '$ ' || replace(to_char(abs(round(n)), 'FM999,999,999,990'), ',', '.')
$$;

create or replace function public.enviar_rendicion(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_yo uuid := public.mi_persona_id();
  v_tesoreria boolean := public.es_tesoreria();
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_persona uuid := nullif(p ->> 'persona_id', '')::uuid;
  v_nro integer := nullif(p ->> 'nro', '')::integer;
  v_fecha date := nullif(p ->> 'fecha', '')::date;
  v_existente public.rendiciones%rowtype;
  v_es_nueva boolean;
  v_total numeric;
  v_n integer;
  v_path text;
  v_orden smallint;
begin
  -- ---------- Quién envía ----------
  if v_yo is null then
    raise exception 'Tu cuenta no está vinculada a una persona. Pide a tesorería que la vincule.';
  end if;
  if v_persona is null then
    raise exception 'Elige el solicitante de la lista.';
  end if;
  if v_persona <> v_yo and not v_tesoreria then
    raise exception 'Solo puedes enviar rendiciones a tu nombre.';
  end if;
  if not exists (select 1 from public.personas where id = v_persona and eliminada_en is null) then
    raise exception 'El solicitante no existe o está eliminado.';
  end if;

  -- ---------- Datos mínimos (la app ya valida lo demás) ----------
  if v_id is null then
    raise exception 'Falta el identificador de la rendición.';
  end if;
  if v_nro is null or v_nro <= 0 then
    raise exception 'El Nº de rendición debe ser un número.';
  end if;
  if v_fecha is null then
    raise exception 'Falta la fecha.';
  end if;
  if jsonb_typeof(p -> 'lineas') <> 'array' or jsonb_array_length(p -> 'lineas') = 0 then
    raise exception 'Agrega al menos un gasto.';
  end if;

  -- ---------- ¿Nueva o reenvío? ----------
  select * into v_existente from public.rendiciones where id = v_id for update;
  v_es_nueva := not found;
  if not v_es_nueva then
    if v_existente.persona_id <> v_yo and not v_tesoreria then
      raise exception 'Esta rendición no es tuya.';
    end if;
    if v_existente.estado not in ('en_revision', 'observada') then
      raise exception 'Esta rendición ya fue revisada y no se puede reenviar.';
    end if;
  end if;

  if v_es_nueva then
    insert into public.rendiciones (
      id, persona_id, nro, fecha, empresa_id, fondo, total_formulario,
      estado, origen, creado_por, enviado_en, editado_en
    ) values (
      v_id, v_persona, v_nro, v_fecha,
      nullif(p ->> 'empresa_id', '')::smallint,
      coalesce(p ->> 'fondo', ''),
      nullif(p ->> 'total_formulario', '')::numeric,
      'en_revision', 'App', auth.uid(), now(), now()
    );
  else
    update public.rendiciones
       set persona_id = v_persona,
           nro = v_nro,
           fecha = v_fecha,
           empresa_id = nullif(p ->> 'empresa_id', '')::smallint,
           fondo = coalesce(p ->> 'fondo', ''),
           total_formulario = nullif(p ->> 'total_formulario', '')::numeric,
           estado = 'en_revision',
           editado_en = now()
     where id = v_id;
    delete from public.rendicion_lineas where rendicion_id = v_id;
  end if;

  -- ---------- Líneas ----------
  insert into public.rendicion_lineas (
    rendicion_id, orden, fecha, tipo, proveedor, rut, numero,
    neto, iva, exento, otros, detalle, subcuenta_id, cuenta_id, centro_costo_id
  )
  select v_id,
         coalesce(l.orden, row_number() over ())::smallint,
         coalesce(l.fecha, v_fecha),
         coalesce(l.tipo, 'Boleta')::public.tipo_documento,
         coalesce(l.proveedor, ''), coalesce(l.rut, ''), coalesce(l.numero, ''),
         coalesce(l.neto, 0), coalesce(l.iva, 0), coalesce(l.exento, 0), coalesce(l.otros, 0),
         coalesce(l.detalle, ''),
         l.subcuenta_id, l.cuenta_id, l.centro_costo_id
    from jsonb_to_recordset(p -> 'lineas') as l(
      orden integer, fecha date, tipo text, proveedor text, rut text, numero text,
      neto numeric, iva numeric, exento numeric, otros numeric, detalle text,
      subcuenta_id smallint, cuenta_id smallint, centro_costo_id smallint
    );

  -- ---------- Respaldos (fotos ya subidas a Storage) ----------
  select coalesce(max(orden), 0) into v_orden from public.respaldos where rendicion_id = v_id;
  for v_path in select jsonb_array_elements_text(coalesce(p -> 'respaldos', '[]'::jsonb)) loop
    if v_path not like v_persona::text || '/' || v_id::text || '/%' then
      raise exception 'Una foto no corresponde a esta rendición.';
    end if;
    if not exists (select 1 from public.respaldos where storage_path = v_path) then
      v_orden := v_orden + 1;
      insert into public.respaldos (rendicion_id, storage_path, mime, orden)
      values (v_id, v_path, 'image/jpeg', v_orden);
    end if;
  end loop;

  -- ---------- Línea de tiempo ----------
  select total into v_total from public.rendiciones where id = v_id;
  select count(*) into v_n from public.rendicion_lineas where rendicion_id = v_id;
  insert into public.rendicion_eventos (rendicion_id, evento, nota, actor)
  values (
    v_id,
    case when v_es_nueva then 'Enviada' else 'Reenviada' end,
    v_n || ' gasto(s) por ' || public._clp(v_total)
      || case when not v_es_nueva and v_existente.estado = 'observada' then ' · corregida tras observación' else '' end,
    auth.uid()
  );

  return v_id;
end;
$$;

revoke execute on function public._clp(numeric) from public, anon;
revoke execute on function public.enviar_rendicion(jsonb) from public, anon;
grant execute on function public._clp(numeric) to authenticated;
grant execute on function public.enviar_rendicion(jsonb) to authenticated;
