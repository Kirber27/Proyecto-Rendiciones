-- Ajustes del cliente (spec 11, tarea 11.12): Nº faltantes del correlativo.
-- El historial tiene huecos (p. ej. 1, 2, 3, 5, 6 sin el 4). Se pueden cargar esas rendiciones eligiendo
-- un Nº faltante; por defecto el Nº sigue siendo el correlativo (mayor + 1, o se conserva).
-- 1) nros_faltantes(persona): huecos del correlativo (para avisarlos en el formulario).
-- 2) _nro_rendicion(persona, rendicion, pedido): decide el Nº en un solo lugar, con el lock por persona.
-- 3) enviar / aprobar / editar: aceptan `nro_faltante` en el payload si sigue libre.
--    Mismos cuerpos que 20261027000020 (enviar) y 20261027000018 (aprobar, editar) salvo el cálculo de v_nro.

-- ---------- Faltantes ----------
/** Nº de 1 al mayor de la persona que no existen en ninguna de sus rendiciones (cualquier estado). */
create or replace function public._nros_faltantes(p_persona uuid)
returns integer[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(n order by n), '{}')
    from generate_series(
           1, (select coalesce(max(nro), 0) from public.rendiciones where persona_id = p_persona)
         ) as n
   where not exists (select 1 from public.rendiciones where persona_id = p_persona and nro = n);
$$;

/** Huecos del correlativo de la persona. La persona ve los suyos; tesorería, los de cualquiera. */
create or replace function public.nros_faltantes(p_persona uuid)
returns integer[]
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_persona is distinct from public.mi_persona_id() and not public.es_tesoreria() then
    raise exception 'Solo puedes ver tu propio correlativo.' using errcode = '42501';
  end if;
  return public._nros_faltantes(p_persona);
end;
$$;

-- ---------- Nº de una rendición al guardarla ----------
/**
 * Nº que queda la rendición `p_rendicion` (puede no existir aún) a nombre de `p_persona`:
 * - `p_pedido` (faltante elegido): debe ser un hueco de la persona en este momento, salvo que sea el Nº
 *   que la rendición ya tiene con esa persona.
 * - sin `p_pedido`: conserva el Nº si la persona no cambia; si no, mayor Nº + 1.
 * Bloquea a la persona hasta el fin de la transacción (envíos simultáneos).
 */
create or replace function public._nro_rendicion(p_persona uuid, p_rendicion uuid, p_pedido integer)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actual public.rendiciones%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended('nro:' || p_persona::text, 0));
  select * into v_actual from public.rendiciones where id = p_rendicion;
  if found and v_actual.persona_id = p_persona and (p_pedido is null or p_pedido = v_actual.nro) then
    return v_actual.nro;
  end if;
  if p_pedido is not null then
    if not p_pedido = any(public._nros_faltantes(p_persona)) then
      raise exception 'El Nº % ya no está libre para esta persona. Elige otro o deja el siguiente.', p_pedido;
    end if;
    return p_pedido;
  end if;
  return (select coalesce(max(nro), 0) + 1 from public.rendiciones where persona_id = p_persona);
end;
$$;

-- ---------- Enviar / reenviar ----------
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

  -- ---------- Nº correlativo (lo pone el servidor; o un faltante elegido) ----------
  v_nro := public._nro_rendicion(v_persona, v_id, nullif(p ->> 'nro_faltante', '')::integer);

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

-- ---------- Aprobar ----------
create or replace function public.aprobar_rendicion(p_id uuid, p jsonb, p_version timestamptz)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.rendiciones := public._tomar_para_decidir(p_id, p_version);
  v_persona uuid := coalesce(nullif(p ->> 'persona_id', '')::uuid, v.persona_id);
  v_nro integer;
  v_fecha date := coalesce(nullif(p ->> 'fecha', '')::date, v.fecha);
  v_folio text;
  v_sin text;
begin
  if v_persona <> v.persona_id
     and not exists (select 1 from public.personas where id = v_persona and eliminada_en is null) then
    raise exception 'Elige un solicitante de la lista.';
  end if;
  -- El Nº se conserva (o el faltante elegido); si cambia la persona, toma el siguiente de la nueva.
  v_nro := public._nro_rendicion(v_persona, p_id, nullif(p ->> 'nro_faltante', '')::integer);
  perform public._reemplazar_lineas(p_id, p -> 'lineas', v_fecha);

  select string_agg('Línea ' || orden || ': elige la ' ||
           case when subcuenta_id is null then 'subcuenta' else 'cuenta' end || '.', ' ')
    into v_sin
    from public.rendicion_lineas
   where rendicion_id = p_id and (subcuenta_id is null or cuenta_id is null);
  if v_sin is not null then
    raise exception '%', v_sin;
  end if;

  -- Si cambia la persona de una rendición que ya tenía folio (aprobación anulada), se recalcula.
  v_folio := case
    when v.folio is not null and v.persona_id = v_persona and v.nro = v_nro then v.folio
    else public.generar_folio(v_persona, v_nro)
  end;

  update public.rendiciones
     set persona_id = v_persona,
         nro = v_nro,
         fecha = v_fecha,
         empresa_id = nullif(p ->> 'empresa_id', '')::smallint,
         fondo = coalesce(p ->> 'fondo', fondo),
         total_formulario = nullif(p ->> 'total_formulario', '')::numeric,
         folio = v_folio,
         estado = 'aprobada',
         aprobacion_anulada = false,
         nota_tesoreria = null,
         decidido_en = now(),
         decidido_por = auth.uid()
   where id = p_id;

  insert into public.rendicion_eventos (rendicion_id, evento, nota, actor)
  values (p_id, 'Aprobada', 'Ingresada al libro como ' || v_folio, auth.uid());
  return v_folio;
end;
$$;

-- ---------- Editar en el libro ----------
create or replace function public.editar_rendicion(p_id uuid, p jsonb, p_version timestamptz)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.rendiciones := public._tomar_del_libro(p_id, array['aprobada']::public.estado_rendicion[], p_version);
  v_persona uuid := coalesce(nullif(p ->> 'persona_id', '')::uuid, v.persona_id);
  v_nro integer;
  v_fecha date := coalesce(nullif(p ->> 'fecha', '')::date, v.fecha);
  v_folio text;
  v_sin text;
begin
  if not exists (select 1 from public.personas where id = v_persona and eliminada_en is null) then
    raise exception 'Elige un solicitante de la lista.';
  end if;
  -- El Nº se conserva (o el faltante elegido); si cambia la persona, toma el siguiente de la nueva.
  v_nro := public._nro_rendicion(v_persona, p_id, nullif(p ->> 'nro_faltante', '')::integer);
  perform public._reemplazar_lineas(p_id, p -> 'lineas', v_fecha);

  select string_agg('Línea ' || orden || ': elige la ' ||
           case when subcuenta_id is null then 'subcuenta' else 'cuenta' end || '.', ' ')
    into v_sin
    from public.rendicion_lineas
   where rendicion_id = p_id and (subcuenta_id is null or cuenta_id is null);
  if v_sin is not null then
    raise exception '%', v_sin;
  end if;

  -- El folio solo cambia si cambia la persona (y con ella el Nº).
  v_folio := case
    when v.folio is not null and v.persona_id = v_persona and v.nro = v_nro then v.folio
    else public.generar_folio(v_persona, v_nro)
  end;

  update public.rendiciones
     set persona_id = v_persona,
         nro = v_nro,
         fecha = v_fecha,
         empresa_id = nullif(p ->> 'empresa_id', '')::smallint,
         fondo = coalesce(p ->> 'fondo', fondo),
         total_formulario = nullif(p ->> 'total_formulario', '')::numeric,
         folio = v_folio,
         editado_en = now()
   where id = p_id;

  insert into public.rendicion_eventos (rendicion_id, evento, nota, actor)
  values (p_id, 'Editada por tesorería',
          case when v_folio is distinct from v.folio then 'Nuevo folio ' || v_folio end,
          auth.uid());
  return v_folio;
end;
$$;

revoke execute on function public._nros_faltantes(uuid) from public, anon, authenticated;
revoke execute on function public._nro_rendicion(uuid, uuid, integer) from public, anon, authenticated;
revoke execute on function public.nros_faltantes(uuid) from public, anon;
grant execute on function public.nros_faltantes(uuid) to authenticated;
