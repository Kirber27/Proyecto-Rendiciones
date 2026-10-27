-- Por aprobar (spec 03): vista para listas, folio y decisiones de tesorería (aprobar / observar / rechazar).

-- ---------- Vista de rendiciones (respeta RLS de las tablas: security_invoker) ----------
create or replace view public.v_rendiciones
with (security_invoker = true) as
select
  r.*,
  p.nombre as persona_nombre,
  p.codigo as persona_codigo,
  e.nombre as empresa_nombre,
  (select count(*) from public.rendicion_lineas l where l.rendicion_id = r.id)::int as n_lineas,
  (select count(*) from public.respaldos x where x.rendicion_id = r.id)::int as n_respaldos,
  ev.evento as ultimo_evento,
  ev.creado_en as ultimo_evento_en
from public.rendiciones r
join public.personas p on p.id = r.persona_id
left join public.empresas e on e.id = r.empresa_id
left join lateral (
  select evento, creado_en
    from public.rendicion_eventos
   where rendicion_id = r.id
   order by creado_en desc, id desc
   limit 1
) ev on true;

grant select on public.v_rendiciones to authenticated;

-- ---------- Folio: CODIGO-NNN; si ya existe, sufijo corto aleatorio ----------
create or replace function public.generar_folio(p_persona_id uuid, p_nro integer)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_base text;
  v_folio text;
begin
  select codigo || '-' || lpad(p_nro::text, 3, '0') into v_base from public.personas where id = p_persona_id;
  if v_base is null then
    raise exception 'La persona no existe.';
  end if;
  v_folio := v_base;
  while exists (select 1 from public.rendiciones where folio = v_folio) loop
    v_folio := v_base || '-' || substr(md5(random()::text), 1, 2);
  end loop;
  return v_folio;
end;
$$;

-- ---------- Reemplazo de líneas (compartido por aprobar y editar) ----------
create or replace function public._reemplazar_lineas(p_rendicion_id uuid, p_lineas jsonb, p_fecha date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if jsonb_typeof(p_lineas) <> 'array' or jsonb_array_length(p_lineas) = 0 then
    raise exception 'Agrega al menos un gasto.';
  end if;
  delete from public.rendicion_lineas where rendicion_id = p_rendicion_id;
  insert into public.rendicion_lineas (
    rendicion_id, orden, fecha, tipo, proveedor, rut, numero,
    neto, iva, exento, otros, detalle, subcuenta_id, cuenta_id, centro_costo_id
  )
  select p_rendicion_id,
         coalesce(l.orden, row_number() over ())::smallint,
         coalesce(l.fecha, p_fecha),
         coalesce(l.tipo, 'Boleta')::public.tipo_documento,
         coalesce(l.proveedor, ''), coalesce(l.rut, ''), coalesce(l.numero, ''),
         coalesce(l.neto, 0), coalesce(l.iva, 0), coalesce(l.exento, 0), coalesce(l.otros, 0),
         coalesce(l.detalle, ''),
         l.subcuenta_id, l.cuenta_id, l.centro_costo_id
    from jsonb_to_recordset(p_lineas) as l(
      orden integer, fecha date, tipo text, proveedor text, rut text, numero text,
      neto numeric, iva numeric, exento numeric, otros numeric, detalle text,
      subcuenta_id smallint, cuenta_id smallint, centro_costo_id smallint
    );
end;
$$;

-- ---------- Tomar una rendición para decidir (bloqueo + concurrencia optimista) ----------
create or replace function public._tomar_para_decidir(p_id uuid, p_version timestamptz)
returns public.rendiciones
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.rendiciones;
begin
  if not public.es_tesoreria() then
    raise exception 'Solo tesorería puede revisar rendiciones.' using errcode = '42501';
  end if;
  select * into v from public.rendiciones where id = p_id for update;
  if not found then
    raise exception 'La rendición no existe.';
  end if;
  if v.estado <> 'en_revision' then
    raise exception 'Esta rendición ya fue revisada. Actualiza la lista.';
  end if;
  -- p_version = editado_en que vio quien revisa; si la persona la reenvió entretanto, no se pisa.
  if p_version is not null and v.editado_en is distinct from p_version then
    raise exception 'La rendición cambió mientras la revisabas. Ábrela de nuevo para ver la última versión.';
  end if;
  return v;
end;
$$;

/** Aprueba con las correcciones de tesorería, asigna folio y la ingresa al libro. Devuelve el folio. */
create or replace function public.aprobar_rendicion(p_id uuid, p jsonb, p_version timestamptz)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.rendiciones := public._tomar_para_decidir(p_id, p_version);
  v_persona uuid := coalesce(nullif(p ->> 'persona_id', '')::uuid, v.persona_id);
  v_nro integer := coalesce(nullif(p ->> 'nro', '')::integer, v.nro);
  v_fecha date := coalesce(nullif(p ->> 'fecha', '')::date, v.fecha);
  v_folio text;
  v_sin text;
begin
  if v_nro <= 0 then
    raise exception 'El Nº de rendición debe ser un número.';
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

  -- Si cambian persona o Nº de una rendición que ya tenía folio (aprobación anulada), se recalcula.
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

/** Devuelve la rendición a la persona para que la corrija (motivo obligatorio). */
create or replace function public.observar_rendicion(p_id uuid, p_nota text, p_version timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.rendiciones := public._tomar_para_decidir(p_id, p_version);
  v_nota text := nullif(btrim(coalesce(p_nota, '')), '');
begin
  if v_nota is null then
    raise exception 'Escribe el motivo: la persona lo verá para corregir.';
  end if;
  update public.rendiciones
     set estado = 'observada', nota_tesoreria = v_nota, decidido_en = now(), decidido_por = auth.uid()
   where id = v.id;
  insert into public.rendicion_eventos (rendicion_id, evento, nota, actor)
  values (v.id, 'Observada', v_nota, auth.uid());
end;
$$;

/** Rechaza la rendición (no se puede reenviar). */
create or replace function public.rechazar_rendicion(p_id uuid, p_nota text, p_version timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.rendiciones := public._tomar_para_decidir(p_id, p_version);
  v_nota text := coalesce(nullif(btrim(coalesce(p_nota, '')), ''), 'Rechazada por tesorería.');
begin
  update public.rendiciones
     set estado = 'rechazada', nota_tesoreria = v_nota, decidido_en = now(), decidido_por = auth.uid()
   where id = v.id;
  insert into public.rendicion_eventos (rendicion_id, evento, nota, actor)
  values (v.id, 'Rechazada', v_nota, auth.uid());
end;
$$;

revoke execute on function public.generar_folio(uuid, integer) from public, anon, authenticated;
revoke execute on function public._reemplazar_lineas(uuid, jsonb, date) from public, anon, authenticated;
revoke execute on function public._tomar_para_decidir(uuid, timestamptz) from public, anon, authenticated;
revoke execute on function public.aprobar_rendicion(uuid, jsonb, timestamptz) from public, anon;
revoke execute on function public.observar_rendicion(uuid, text, timestamptz) from public, anon;
revoke execute on function public.rechazar_rendicion(uuid, text, timestamptz) from public, anon;
grant execute on function public.aprobar_rendicion(uuid, jsonb, timestamptz) to authenticated;
grant execute on function public.observar_rendicion(uuid, text, timestamptz) to authenticated;
grant execute on function public.rechazar_rendicion(uuid, text, timestamptz) to authenticated;

-- ---------- Realtime: el contador de "Por aprobar" se actualiza solo (RLS aplica a los eventos) ----------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.rendiciones;
  end if;
end;
$$;
