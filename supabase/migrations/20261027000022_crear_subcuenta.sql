-- Ajustes del cliente (spec 11, tarea 11.8): tesorería agrega una subcuenta desde el selector de las
-- líneas de gasto, con su cuenta sugerida opcional. No se permiten dos con el mismo nombre normalizado
-- (sin tildes, mayúsculas ni espacios de más), para no ensuciar las tablas dinámicas del Excel.

create or replace function public.crear_subcuenta(p_nombre text, p_cuenta smallint default null)
returns public.subcuentas
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nombre text := btrim(regexp_replace(coalesce(p_nombre, ''), '\s+', ' ', 'g'));
  v_existente text;
  v public.subcuentas;
begin
  if not public.es_tesoreria() then
    raise exception 'Solo tesorería puede agregar subcuentas.' using errcode = '42501';
  end if;
  if v_nombre = '' then
    raise exception 'Escribe el nombre de la subcuenta.';
  end if;
  select nombre into v_existente from public.subcuentas
   where public.normalizar(nombre) = public.normalizar(v_nombre)
   limit 1;
  if found then
    raise exception 'Ya existe la subcuenta «%». Elígela de la lista.', btrim(v_existente);
  end if;
  if p_cuenta is not null and not exists (select 1 from public.cuentas where id = p_cuenta) then
    raise exception 'La cuenta sugerida no existe.';
  end if;

  insert into public.subcuentas (nombre, cuenta_sugerida_id, orden, activa)
  values (v_nombre, p_cuenta, (select coalesce(max(orden), 0) + 1 from public.subcuentas), true)
  returning * into v;
  return v;
end;
$$;

revoke execute on function public.crear_subcuenta(text, smallint) from public, anon;
grant execute on function public.crear_subcuenta(text, smallint) to authenticated;
