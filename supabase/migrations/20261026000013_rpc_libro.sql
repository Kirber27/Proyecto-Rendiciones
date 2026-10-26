-- Libro de rendiciones (spec 04): edición en el libro, anular aprobación, eliminar / restaurar y marcar exportadas.
-- Todas exigen tesorería, bloquean la fila y escriben su evento en la misma transacción.

-- Estado que tenía antes de eliminarla, para restaurarla tal cual.
alter table public.rendiciones add column if not exists estado_previo public.estado_rendicion;

-- ---------- Tomar una rendición del libro (bloqueo + estado esperado + concurrencia optimista) ----------
create or replace function public._tomar_del_libro(
  p_id uuid,
  p_estados public.estado_rendicion[],
  p_version timestamptz default null
)
returns public.rendiciones
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.rendiciones;
begin
  if not public.es_tesoreria() then
    raise exception 'Solo tesorería puede modificar el libro.' using errcode = '42501';
  end if;
  select * into v from public.rendiciones where id = p_id for update;
  if not found then
    raise exception 'La rendición no existe.';
  end if;
  if not v.estado = any (p_estados) then
    raise exception 'La rendición cambió de estado. Actualiza la lista.';
  end if;
  if p_version is not null and v.editado_en is distinct from p_version then
    raise exception 'La rendición cambió mientras la editabas. Ábrela de nuevo para ver la última versión.';
  end if;
  return v;
end;
$$;

/** Edición de una rendición aprobada desde el libro. Exige subcuenta y cuenta en cada línea. */
create or replace function public.editar_rendicion(p_id uuid, p jsonb, p_version timestamptz)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.rendiciones := public._tomar_del_libro(p_id, array['aprobada']::public.estado_rendicion[], p_version);
  v_persona uuid := coalesce(nullif(p ->> 'persona_id', '')::uuid, v.persona_id);
  v_nro integer := coalesce(nullif(p ->> 'nro', '')::integer, v.nro);
  v_fecha date := coalesce(nullif(p ->> 'fecha', '')::date, v.fecha);
  v_folio text;
  v_sin text;
begin
  if v_nro <= 0 then
    raise exception 'El Nº de rendición debe ser un número.';
  end if;
  if not exists (select 1 from public.personas where id = v_persona and eliminada_en is null) then
    raise exception 'Elige un solicitante de la lista.';
  end if;
  perform public._reemplazar_lineas(p_id, p -> 'lineas', v_fecha);

  select string_agg('Línea ' || orden || ': elige la ' ||
           case when subcuenta_id is null then 'subcuenta' else 'cuenta' end || '.', ' ')
    into v_sin
    from public.rendicion_lineas
   where rendicion_id = p_id and (subcuenta_id is null or cuenta_id is null);
  if v_sin is not null then
    raise exception '%', v_sin;
  end if;

  -- El folio solo cambia si cambian la persona o el Nº.
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

/** Quita una aprobación hecha en la app: vuelve a Por aprobar con sus fotos y conserva el folio. */
create or replace function public.anular_aprobacion(p_id uuid, p_nota text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.rendiciones := public._tomar_del_libro(p_id, array['aprobada']::public.estado_rendicion[]);
begin
  if v.origen <> 'App' then
    raise exception 'Las rendiciones del historial no tienen aprobación que anular. Puedes eliminarla.';
  end if;
  update public.rendiciones
     set estado = 'en_revision',
         aprobacion_anulada = true,
         editado_en = now(),
         decidido_en = now(),
         decidido_por = auth.uid()
   where id = p_id;
  insert into public.rendicion_eventos (rendicion_id, evento, nota, actor)
  values (p_id, 'Aprobación anulada',
          coalesce(nullif(btrim(coalesce(p_nota, '')), ''), 'Vuelve a Por aprobar para revisarla de nuevo.'),
          auth.uid());
end;
$$;

/** Eliminación lógica: la persona la ve como Eliminada y se puede restaurar. */
create or replace function public.eliminar_rendicion(p_id uuid, p_nota text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.rendiciones := public._tomar_del_libro(
    p_id, array['en_revision', 'observada', 'rechazada', 'aprobada']::public.estado_rendicion[]);
  v_nota text := coalesce(nullif(btrim(coalesce(p_nota, '')), ''), 'Eliminada por tesorería.');
begin
  update public.rendiciones
     set estado_previo = v.estado,
         estado = 'eliminada',
         nota_tesoreria = v_nota,
         editado_en = now(),
         decidido_en = now(),
         decidido_por = auth.uid()
   where id = p_id;
  insert into public.rendicion_eventos (rendicion_id, evento, nota, actor)
  values (p_id, 'Eliminada', v_nota, auth.uid());
end;
$$;

/** Devuelve una rendición eliminada al estado que tenía. */
create or replace function public.restaurar_rendicion(p_id uuid)
returns public.estado_rendicion
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.rendiciones := public._tomar_del_libro(p_id, array['eliminada']::public.estado_rendicion[]);
  v_estado public.estado_rendicion := coalesce(v.estado_previo, 'en_revision');
begin
  update public.rendiciones
     set estado = v_estado,
         estado_previo = null,
         nota_tesoreria = case when v_estado in ('observada', 'rechazada') then nota_tesoreria end,
         editado_en = now()
   where id = p_id;
  insert into public.rendicion_eventos (rendicion_id, evento, nota, actor)
  values (p_id, 'Restaurada', null, auth.uid());
  return v_estado;
end;
$$;

/** Marca como exportadas a Excel (solo las aprobadas). Devuelve cuántas marcó. */
create or replace function public.marcar_exportadas(p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  if not public.es_tesoreria() then
    raise exception 'Solo tesorería puede exportar el libro.' using errcode = '42501';
  end if;
  update public.rendiciones
     set exportada = true
   where id = any (p_ids) and estado = 'aprobada' and not exportada;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function public._tomar_del_libro(uuid, public.estado_rendicion[], timestamptz) from public, anon, authenticated;
revoke execute on function public.editar_rendicion(uuid, jsonb, timestamptz) from public, anon;
revoke execute on function public.anular_aprobacion(uuid, text) from public, anon;
revoke execute on function public.eliminar_rendicion(uuid, text) from public, anon;
revoke execute on function public.restaurar_rendicion(uuid) from public, anon;
revoke execute on function public.marcar_exportadas(uuid[]) from public, anon;
grant execute on function public.editar_rendicion(uuid, jsonb, timestamptz) to authenticated;
grant execute on function public.anular_aprobacion(uuid, text) to authenticated;
grant execute on function public.eliminar_rendicion(uuid, text) to authenticated;
grant execute on function public.restaurar_rendicion(uuid) to authenticated;
grant execute on function public.marcar_exportadas(uuid[]) to authenticated;
