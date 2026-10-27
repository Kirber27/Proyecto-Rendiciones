-- Row Level Security en TODAS las tablas. El acceso real lo dan estas políticas, no la UI.
-- Las funciones de acceso se envuelven en (select …) para que Postgres las evalúe una vez por consulta.
-- Las escrituras de rendiciones y pagos van por RPC security definer (specs 02–07).

alter table public.centros_costo enable row level security;
alter table public.cuentas enable row level security;
alter table public.subcuentas enable row level security;
alter table public.empresas enable row level security;
alter table public.medios_pago enable row level security;
alter table public.personas enable row level security;
alter table public.rendiciones enable row level security;
alter table public.rendicion_lineas enable row level security;
alter table public.rendicion_eventos enable row level security;
alter table public.respaldos enable row level security;
alter table public.cartolas enable row level security;
alter table public.cartola_movimientos enable row level security;
alter table public.pagos enable row level security;
alter table public.pago_rendiciones enable row level security;
alter table public.lecturas_ia enable row level security;

-- ---------- Catálogos: los lee cualquier usuario con sesión; los edita el administrador ----------

create policy "catálogo: leer" on public.centros_costo for select to authenticated using (true);
create policy "catálogo: admin edita" on public.centros_costo for all to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));

create policy "catálogo: leer" on public.cuentas for select to authenticated using (true);
create policy "catálogo: admin edita" on public.cuentas for all to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));

create policy "catálogo: leer" on public.subcuentas for select to authenticated using (true);
create policy "catálogo: admin edita" on public.subcuentas for all to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));

create policy "catálogo: leer" on public.empresas for select to authenticated using (true);
create policy "catálogo: admin edita" on public.empresas for all to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));

create policy "catálogo: leer" on public.medios_pago for select to authenticated using (true);
create policy "catálogo: admin edita" on public.medios_pago for all to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));

-- ---------- Personas ----------
-- Todos ven las activas (listas de solicitantes); tesorería ve también las eliminadas.
-- Alta y edición: administrador (cambios de función con reglas → RPC en 8.2). No se borran filas.

create policy "personas: leer" on public.personas for select to authenticated
  using (eliminada_en is null or (select public.es_tesoreria()));
create policy "personas: admin agrega" on public.personas for insert to authenticated
  with check ((select public.es_admin()));
create policy "personas: admin edita" on public.personas for update to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));

-- ---------- Rendiciones y sus hijos: dueño o tesorería (solo lectura; escritura por RPC) ----------

create policy "rendiciones: dueño o tesorería" on public.rendiciones for select to authenticated
  using (persona_id = (select public.mi_persona_id()) or (select public.es_tesoreria()));

-- Los hijos son visibles si su rendición lo es (la subconsulta ya aplica la política de arriba).
create policy "líneas: según su rendición" on public.rendicion_lineas for select to authenticated
  using (exists (select 1 from public.rendiciones r where r.id = rendicion_id));
create policy "eventos: según su rendición" on public.rendicion_eventos for select to authenticated
  using (exists (select 1 from public.rendiciones r where r.id = rendicion_id));
create policy "respaldos: según su rendición" on public.respaldos for select to authenticated
  using (exists (select 1 from public.rendiciones r where r.id = rendicion_id));

-- ---------- Pagos: dueño o tesorería (lectura); escritura por RPC de tesorería ----------

create policy "pagos: dueño o tesorería" on public.pagos for select to authenticated
  using (persona_id = (select public.mi_persona_id()) or (select public.es_tesoreria()));
create policy "pago_rendiciones: según su pago" on public.pago_rendiciones for select to authenticated
  using (exists (select 1 from public.pagos p where p.id = pago_id));

-- ---------- Banco: solo tesorería ----------

create policy "cartolas: tesorería" on public.cartolas for all to authenticated
  using ((select public.es_tesoreria())) with check ((select public.es_tesoreria()));
create policy "movimientos: tesorería" on public.cartola_movimientos for all to authenticated
  using ((select public.es_tesoreria())) with check ((select public.es_tesoreria()));

-- ---------- Uso de IA: cada uno ve lo suyo; el administrador todo. Escribe solo el service role ----------

create policy "lecturas_ia: propias o admin" on public.lecturas_ia for select to authenticated
  using (user_id = (select auth.uid()) or (select public.es_admin()));
