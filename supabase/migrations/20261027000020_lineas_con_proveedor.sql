-- Ajustes del cliente (spec 11, tarea 11.4): cada línea de gasto elige su proveedor de la lista.
-- 1) _reemplazar_lineas (compartido por enviar, aprobar y editar) guarda proveedor_id y toma nombre y
--    RUT de la tabla proveedores (la fuente es el registro, no lo que mande el navegador). Sin
--    proveedor_id, conserva el texto recibido (líneas del historial).
-- 2) enviar_rendicion usa _reemplazar_lineas y exige en cada línea un proveedor activo.
--    Aprobar y editar no lo exigen: el historial no trae proveedor.

-- ---------- Reemplazo de líneas ----------
create or replace function public._reemplazar_lineas(p_rendicion_id uuid, p_lineas jsonb, p_fecha date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_malo integer;
begin
  if jsonb_typeof(p_lineas) is distinct from 'array' or jsonb_array_length(p_lineas) = 0 then
    raise exception 'Agrega al menos un gasto.';
  end if;
  select min(coalesce((t.e ->> 'orden')::integer, t.n::integer)) into v_malo
    from jsonb_array_elements(p_lineas) with ordinality as t(e, n)
   where nullif(t.e ->> 'proveedor_id', '') is not null
     and not exists (
       select 1 from public.proveedores pr where pr.id = (t.e ->> 'proveedor_id')::uuid
     );
  if v_malo is not null then
    raise exception 'Línea %: el proveedor no existe. Actualiza la página y elígelo de nuevo.', v_malo;
  end if;

  delete from public.rendicion_lineas where rendicion_id = p_rendicion_id;
  insert into public.rendicion_lineas (
    rendicion_id, orden, fecha, tipo, proveedor_id, proveedor, rut, numero,
    neto, iva, exento, otros, detalle, subcuenta_id, cuenta_id, centro_costo_id
  )
  select p_rendicion_id,
         coalesce(l.orden, row_number() over ())::smallint,
         coalesce(l.fecha, p_fecha),
         coalesce(l.tipo, 'Boleta')::public.tipo_documento,
         l.proveedor_id,
         coalesce(pr.nombre, l.proveedor, ''), coalesce(pr.rut, l.rut, ''), coalesce(l.numero, ''),
         coalesce(l.neto, 0), coalesce(l.iva, 0), coalesce(l.exento, 0), coalesce(l.otros, 0),
         coalesce(l.detalle, ''),
         l.subcuenta_id, l.cuenta_id, l.centro_costo_id
    from jsonb_to_recordset(p_lineas) as l(
      orden integer, fecha date, tipo text, proveedor_id uuid, proveedor text, rut text, numero text,
      neto numeric, iva numeric, exento numeric, otros numeric, detalle text,
      subcuenta_id smallint, cuenta_id smallint, centro_costo_id smallint
    )
    left join public.proveedores pr on pr.id = l.proveedor_id;
end;
$$;

-- ---------- Enviar / reenviar (igual que 0018, salvo las líneas) ----------
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
  v_nro integer;
  v_fecha date := nullif(p ->> 'fecha', '')::date;
  v_existente public.rendiciones%rowtype;
  v_es_nueva boolean;
  v_total numeric;
  v_n integer;
  v_path text;
  v_orden smallint;
  v_sin_proveedor text;
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

  -- ---------- Nº correlativo (lo pone el servidor) ----------
  v_nro := case
    when not v_es_nueva and v_existente.persona_id = v_persona then v_existente.nro
    else public._siguiente_nro(v_persona)
  end;

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
  end if;

  -- ---------- Líneas (cada una con un proveedor activo de la lista) ----------
  perform public._reemplazar_lineas(v_id, p -> 'lineas', v_fecha);
  select string_agg('Línea ' || l.orden || ': ' ||
           case when l.proveedor_id is null then 'elige el proveedor de la lista.'
                else 'ese proveedor fue eliminado de la lista; elige otro.' end, ' ' order by l.orden)
    into v_sin_proveedor
    from public.rendicion_lineas l
    left join public.proveedores pr on pr.id = l.proveedor_id
   where l.rendicion_id = v_id and (l.proveedor_id is null or pr.eliminado_en is not null);
  if v_sin_proveedor is not null then
    raise exception '%', v_sin_proveedor;
  end if;

  -- ---------- Respaldos (fotos ya subidas a Storage) ----------
  select coalesce(max(orden), 0) into v_orden from public.respaldos where rendicion_id = v_id;
  for v_path in select jsonb_array_elements_text(coalesce(p -> 'respaldos', '[]'::jsonb)) loop
    if v_path not like v_persona::text || '/' || v_id::text || '/%' then
      raise exception 'Un respaldo no corresponde a esta rendición.';
    end if;
    if v_path !~ '\.(jpg|pdf)$' then
      raise exception 'Los respaldos deben ser fotos (JPG) o PDF.';
    end if;
    if not exists (select 1 from public.respaldos where storage_path = v_path) then
      v_orden := v_orden + 1;
      insert into public.respaldos (rendicion_id, storage_path, mime, orden)
      values (
        v_id, v_path,
        case when v_path like '%.pdf' then 'application/pdf' else 'image/jpeg' end,
        v_orden
      );
    end if;
  end loop;
  -- Al menos un respaldo (nuevo o ya guardado). Si no, la transacción se revierte completa.
  if not exists (select 1 from public.respaldos where rendicion_id = v_id) then
    raise exception 'Adjunta al menos un respaldo: la foto del formulario o de las boletas.';
  end if;

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
