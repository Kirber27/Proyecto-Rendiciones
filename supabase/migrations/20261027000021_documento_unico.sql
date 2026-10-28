-- Ajustes del cliente (spec 11, tarea 11.5): el Nº de documento es único por proveedor
-- (RUT + tipo de documento + Nº), contra todas las rendiciones no eliminadas ni rechazadas.
-- 1) _clave_documento / documento_repetido: la app consulta mientras se escribe (solo responde sí o no,
--    sin datos de rendiciones ajenas).
-- 2) _reemplazar_lineas (enviar, aprobar y editar) rechaza las líneas nuevas o cambiadas que repitan un
--    documento, dentro de la misma rendición o en otra. Lo que ya estaba guardado no se revisa: el
--    historial puede traer repetidos. Sin índice único por lo mismo.
--    Mismo cuerpo que 20261027000020 salvo esa comprobación.

/** "12345678-5|Boleta|A123": clave del documento, o null si no tiene RUT válido o Nº. */
create or replace function public._clave_documento(p_rut text, p_tipo public.tipo_documento, p_numero text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
    when public.normalizar_rut(p_rut) = '' or btrim(coalesce(p_numero, '')) = '' then null
    else public.normalizar_rut(p_rut) || '|' || p_tipo::text || '|' || upper(btrim(p_numero))
  end
$$;

create index rendicion_lineas_documento on public.rendicion_lineas
  (public._clave_documento(rut, tipo, numero))
  where btrim(numero) <> '';

/**
 * Si el documento ya está en otra rendición (no eliminada ni rechazada). p_excluir = la rendición que
 * se está editando. Cualquier usuario puede preguntar; solo se responde sí o no.
 */
create or replace function public.documento_repetido(
  p_rut text,
  p_tipo public.tipo_documento,
  p_numero text,
  p_excluir uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public._clave_documento(p_rut, p_tipo, p_numero) is not null and exists (
    select 1
      from public.rendicion_lineas l
      join public.rendiciones r on r.id = l.rendicion_id
     where btrim(l.numero) <> ''
       and public._clave_documento(l.rut, l.tipo, l.numero) = public._clave_documento(p_rut, p_tipo, p_numero)
       and r.estado not in ('eliminada', 'rechazada')
       and l.rendicion_id is distinct from p_excluir
  )
$$;

-- ---------- Reemplazo de líneas ----------
create or replace function public._reemplazar_lineas(p_rendicion_id uuid, p_lineas jsonb, p_fecha date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_malo integer;
  v_antes text[];
  v_repetidas text;
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

  -- Documentos que la rendición ya tenía: no se vuelven a revisar (el historial puede traer repetidos).
  select coalesce(array_agg(public._clave_documento(rut, tipo, numero)), '{}') into v_antes
    from public.rendicion_lineas where rendicion_id = p_rendicion_id;

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

  -- ---------- Nº de documento único por proveedor (RUT + tipo + Nº) ----------
  select string_agg(m, ' ' order by o) into v_repetidas
    from (
      select l.orden as o,
             'Línea ' || l.orden || ': ' || case
               when exists (
                 select 1 from public.rendicion_lineas a
                  where a.rendicion_id = p_rendicion_id and a.orden < l.orden
                    and public._clave_documento(a.rut, a.tipo, a.numero) = public._clave_documento(l.rut, l.tipo, l.numero)
               ) then 'repite el Nº de documento de otra línea.'
               else 'este Nº de documento ya está cargado para este proveedor.'
             end as m
        from public.rendicion_lineas l
       where l.rendicion_id = p_rendicion_id
         and public._clave_documento(l.rut, l.tipo, l.numero) is not null
         and not public._clave_documento(l.rut, l.tipo, l.numero) = any (v_antes)
         and (
           exists (
             select 1 from public.rendicion_lineas a
              where a.rendicion_id = p_rendicion_id and a.orden < l.orden
                and public._clave_documento(a.rut, a.tipo, a.numero) = public._clave_documento(l.rut, l.tipo, l.numero)
           )
           or public.documento_repetido(l.rut, l.tipo, l.numero, p_rendicion_id)
         )
    ) t;
  if v_repetidas is not null then
    raise exception '%', v_repetidas;
  end if;
end;
$$;

revoke execute on function public.documento_repetido(text, public.tipo_documento, text, uuid) from public, anon;
grant execute on function public.documento_repetido(text, public.tipo_documento, text, uuid) to authenticated;
