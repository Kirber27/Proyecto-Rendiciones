-- Cartolas bancarias, pagos y su vínculo con rendiciones.

create table public.cartolas (
  id uuid primary key default gen_random_uuid(),
  nombre_archivo text not null,
  medio_pago_id smallint references public.medios_pago (id),
  subido_por uuid references auth.users (id) on delete set null,
  creado_en timestamptz not null default now()
);

create table public.cartola_movimientos (
  id uuid primary key default gen_random_uuid(),
  cartola_id uuid not null references public.cartolas (id) on delete cascade,
  idx integer not null,                               -- posición en el archivo
  fecha date not null,
  descripcion text not null default '',
  referencia text not null default '',
  cargo numeric(14, 2) not null default 0 check (cargo >= 0),
  abono numeric(14, 2) not null default 0 check (abono >= 0),
  ignorado boolean not null default false,            -- "No es de rendiciones"
  unique (cartola_id, idx)
);

create index cartola_movimientos_fecha_idx on public.cartola_movimientos (fecha);

create table public.pagos (
  id uuid primary key default gen_random_uuid(),
  codigo_hist text unique,                            -- H0001..H0174 del historial
  persona_id uuid not null references public.personas (id),
  fecha date,                                         -- puede faltar en el historial
  medio_pago_id smallint references public.medios_pago (id),
  monto numeric(14, 2) not null,                      -- negativo en devoluciones
  tipo public.tipo_pago not null default 'Pago',
  movimiento_id uuid unique references public.cartola_movimientos (id) on delete set null,
  descripcion text not null default '',
  origen public.origen_registro not null default 'App',
  obs text not null default '',
  creado_por uuid references auth.users (id) on delete set null,
  creado_en timestamptz not null default now(),
  check (tipo <> 'Devolución de la persona' or monto <= 0)
);

create index pagos_persona_idx on public.pagos (persona_id);

create table public.pago_rendiciones (
  pago_id uuid not null references public.pagos (id) on delete cascade,
  rendicion_id uuid not null references public.rendiciones (id) on delete cascade,
  primary key (pago_id, rendicion_id)
);

create index pago_rendiciones_rendicion_idx on public.pago_rendiciones (rendicion_id);

-- ---------- Uso de la lectura con IA (lo escribe solo la Edge Function con service role) ----------

create table public.lecturas_ia (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  creado_en timestamptz not null default now(),
  imagenes integer not null default 0,
  tokens_entrada integer,
  tokens_salida integer,
  ok boolean not null,
  error text
);

create index lecturas_ia_usuario_idx on public.lecturas_ia (user_id, creado_en);
