-- Personas, funciones (roles), vínculo cuenta → persona y control de ingreso.

create table public.personas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (btrim(nombre) <> ''),          -- grafía exacta ("David Herce ")
  nombre_norm text generated always as (public.normalizar(nombre)) stored unique,
  codigo text not null unique check (codigo ~ '^[A-Z]{2,4}$'),
  correo extensions.citext unique,
  rol public.rol_app not null default 'solicitante',
  user_id uuid unique references auth.users (id) on delete set null,
  es_nueva boolean not null default false,                   -- creada en la app (no viene del historial)
  eliminada_en timestamptz,
  creado_en timestamptz not null default now()
);

-- Un solo Tesorero activo.
create unique index personas_un_solo_tesorero
  on public.personas (rol)
  where rol = 'tesorero' and eliminada_en is null;

-- ---------- Helpers de acceso (usados por las políticas RLS y las RPC) ----------

create or replace function public.mi_persona_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.personas where user_id = auth.uid() and eliminada_en is null
$$;

create or replace function public.mi_rol()
returns public.rol_app
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select rol from public.personas where user_id = auth.uid() and eliminada_en is null),
    'solicitante'::public.rol_app
  )
$$;

create or replace function public.es_tesoreria()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.mi_rol() in ('tesorero', 'administrador')
$$;

create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.mi_rol() = 'administrador'
$$;

-- ---------- Vínculo automático: al crearse la cuenta, se une a la persona con ese correo ----------

create or replace function public.vincular_persona_nuevo_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.personas
     set user_id = new.id
   where lower(correo::text) = lower(new.email)
     and user_id is null
     and eliminada_en is null;
  return new;
end;
$$;

create trigger al_crear_usuario_vincular_persona
  after insert on auth.users
  for each row execute function public.vincular_persona_nuevo_usuario();

-- ---------- Auth Hook "Before User Created": solo correos registrados en personas ----------
-- Se activa en el panel: Authentication → Hooks → Before User Created → public.hook_validar_correo

create or replace function public.hook_validar_correo(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_correo text := lower(event -> 'user' ->> 'email');
begin
  if v_correo is not null and exists (
    select 1 from public.personas p
     where lower(p.correo::text) = v_correo and p.eliminada_en is null
  ) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object(
    'error', jsonb_build_object(
      'http_code', 403,
      'message', 'Tu correo no está habilitado. Pide a tesorería que te agregue.'
    )
  );
end;
$$;

grant execute on function public.hook_validar_correo(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_validar_correo(jsonb) from authenticated, anon, public;
