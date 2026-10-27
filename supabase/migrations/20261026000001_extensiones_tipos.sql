-- Extensiones, tipos enumerados y normalización de nombres.
-- Ver .kiro/steering/data-model.md

create extension if not exists citext with schema extensions;
create extension if not exists unaccent with schema extensions;

create type public.rol_app as enum ('administrador', 'tesorero', 'solicitante');
create type public.tipo_documento as enum ('Factura', 'Boleta', 'Boleta de honorarios', 'Transferencia');
create type public.estado_rendicion as enum ('en_revision', 'observada', 'rechazada', 'aprobada', 'eliminada');
create type public.tipo_pago as enum ('Pago', 'Anticipo', 'No genera pago', 'Devolución de la persona');
create type public.origen_registro as enum ('App', 'Histórico');

-- Igual que norm() del frontend: sin tildes, minúsculas, espacios colapsados y recortados.
-- unaccent con diccionario explícito para poder declararla immutable (se usa en columnas generadas).
create or replace function public.normalizar(t text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select lower(btrim(regexp_replace(
    extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(t, '')),
    '\s+', ' ', 'g'
  )))
$$;

comment on function public.normalizar(text) is
  'Normaliza nombres para comparar (equivale a norm() de src/domain/formato.ts).';
