-- Rendiciones: una sola fila desde que se envía hasta que se paga. Su estado y folio cambian;
-- la línea de tiempo vive en rendicion_eventos. Las escrituras se hacen por RPC (specs 02–04).

create table public.rendiciones (
  id uuid primary key default gen_random_uuid(),
  folio text unique,                                  -- DHE-042; se asigna al aprobar
  persona_id uuid not null references public.personas (id),
  nro integer not null check (nro > 0),
  fecha date not null,
  empresa_id smallint references public.empresas (id),
  fondo text not null default '',
  total_formulario numeric(14, 2),
  total numeric(14, 2) not null default 0,            -- suma de líneas (trigger)
  estado public.estado_rendicion not null default 'en_revision',
  aprobacion_anulada boolean not null default false,
  origen public.origen_registro not null default 'App',
  creado_por uuid references auth.users (id) on delete set null,
  enviado_en timestamptz,
  editado_en timestamptz,
  decidido_en timestamptz,
  decidido_por uuid references auth.users (id) on delete set null,
  nota_tesoreria text,
  exportada boolean not null default false,
  obs text not null default '',
  creado_en timestamptz not null default now()
);

create index rendiciones_persona_idx on public.rendiciones (persona_id);
create index rendiciones_estado_idx on public.rendiciones (estado);

create table public.rendicion_lineas (
  id uuid primary key default gen_random_uuid(),
  rendicion_id uuid not null references public.rendiciones (id) on delete cascade,
  orden smallint not null default 1,
  fecha date,
  tipo public.tipo_documento not null default 'Boleta',
  proveedor text not null default '',
  rut text not null default '',
  numero text not null default '',
  neto numeric(14, 2) not null default 0,
  iva numeric(14, 2) not null default 0,
  exento numeric(14, 2) not null default 0,
  otros numeric(14, 2) not null default 0,
  detalle text not null default '',
  subcuenta_id smallint references public.subcuentas (id),
  cuenta_id smallint references public.cuentas (id),
  centro_costo_id smallint references public.centros_costo (id)
);

create index rendicion_lineas_rendicion_idx on public.rendicion_lineas (rendicion_id, orden);

-- Línea de tiempo / auditoría: solo se insertan filas, nunca se borran ni editan.
create table public.rendicion_eventos (
  id bigint generated always as identity primary key,
  rendicion_id uuid not null references public.rendiciones (id) on delete cascade,
  evento text not null,
  nota text,
  actor uuid references auth.users (id) on delete set null,
  creado_en timestamptz not null default now()
);

create index rendicion_eventos_rendicion_idx on public.rendicion_eventos (rendicion_id, creado_en);

create table public.respaldos (
  id uuid primary key default gen_random_uuid(),
  rendicion_id uuid not null references public.rendiciones (id) on delete cascade,
  storage_path text not null unique,                 -- <persona_id>/<rendicion_id>/<uuid>.jpg
  mime text,
  orden smallint not null default 1,
  creado_en timestamptz not null default now()
);

create index respaldos_rendicion_idx on public.respaldos (rendicion_id);

-- ---------- Total de la rendición = suma de sus líneas ----------

create or replace function public.recalcular_total_rendicion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := coalesce(new.rendicion_id, old.rendicion_id);
begin
  update public.rendiciones r
     set total = coalesce((
       select sum(l.neto + l.iva + l.exento + l.otros)
         from public.rendicion_lineas l
        where l.rendicion_id = v_id
     ), 0)
   where r.id = v_id;
  -- Si la línea cambió de rendición, recalcular también la anterior.
  if tg_op = 'UPDATE' and old.rendicion_id is distinct from new.rendicion_id then
    update public.rendiciones r
       set total = coalesce((
         select sum(l.neto + l.iva + l.exento + l.otros)
           from public.rendicion_lineas l
          where l.rendicion_id = old.rendicion_id
       ), 0)
     where r.id = old.rendicion_id;
  end if;
  return null;
end;
$$;

create trigger rendicion_lineas_total
  after insert or update or delete on public.rendicion_lineas
  for each row execute function public.recalcular_total_rendicion();
