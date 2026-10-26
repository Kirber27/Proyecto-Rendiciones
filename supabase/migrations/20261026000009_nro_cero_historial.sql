-- El historial 2026 trae una rendición sin número (DAR-000, Nº 0).
-- Se permite Nº 0 solo para registros Histórico; las de la app siguen exigiendo Nº > 0.
alter table public.rendiciones drop constraint rendiciones_nro_check;
alter table public.rendiciones add constraint rendiciones_nro_check
  check (nro > 0 or (origen = 'Histórico' and nro >= 0));
