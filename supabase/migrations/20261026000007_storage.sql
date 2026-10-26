-- Bucket privado para las fotos de respaldo. Ruta: <persona_id>/<rendicion_id>/<uuid>.jpg
-- Se muestran con URLs firmadas de corta duración.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'respaldos',
  'respaldos',
  false,
  10485760, -- 10 MB por foto (se suben reducidas a 2400 px)
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do nothing;

-- Ver: dueño de la carpeta o tesorería
create policy "respaldos: ver" on storage.objects for select to authenticated
  using (
    bucket_id = 'respaldos'
    and (
      (storage.foldername(name))[1] = (select public.mi_persona_id())::text
      or (select public.es_tesoreria())
    )
  );

-- Subir: cada persona solo en su carpeta (tesorería puede subir por otra persona)
create policy "respaldos: subir" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'respaldos'
    and (
      (storage.foldername(name))[1] = (select public.mi_persona_id())::text
      or (select public.es_tesoreria())
    )
  );

-- Borrar: solo tesorería (las fotos son respaldo contable)
create policy "respaldos: borrar" on storage.objects for delete to authenticated
  using (bucket_id = 'respaldos' and (select public.es_tesoreria()));
