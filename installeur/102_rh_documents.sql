-- Documents RH des volontaires (carte d’identité, permis, visas).
-- Le fichier reste privé : le volontaire et la gestion des fiches seulement.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'rh-documents',
  'rh-documents',
  false,
  15728640,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists rh_documents_select on storage.objects;
drop policy if exists rh_documents_insert on storage.objects;
drop policy if exists rh_documents_update on storage.objects;
drop policy if exists rh_documents_delete on storage.objects;

create policy rh_documents_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'rh-documents'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.peut_gerer_fiches()
    )
  );

create policy rh_documents_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'rh-documents'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.peut_gerer_fiches()
    )
  );

create policy rh_documents_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'rh-documents'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.peut_gerer_fiches()
    )
  )
  with check (
    bucket_id = 'rh-documents'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.peut_gerer_fiches()
    )
  );

create policy rh_documents_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'rh-documents'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.peut_gerer_fiches()
    )
  );

-- Chauffeur dès que la sélection médicale est cochée, même sans permis B/C/E.
create or replace function public.quals_d_un_profil(p_role text, p_fiche jsonb)
returns text[] language plpgsql immutable set search_path = public as $$
declare
  qs text[] := '{}';
  permis jsonb;
  a_select boolean;
begin
  select coalesce(array_agg(value), '{}'::text[]) into qs
    from jsonb_array_elements_text(coalesce(p_fiche->'qualifications', '[]'::jsonb));

  qs := qs || case p_role
    when 'ambulancier_bleu' then array['ambulancier']
    when 'ambulancier_gris' then array['ambulancier']
    when 'infirmier' then array['infirmier']
    when 'medecin' then array['medecin']
    when 'volontaire_non_medical' then array['volontaire_non_medical']
    else '{}'::text[]
  end;
  if p_fiche->>'type_benevole' = 'non_medical' or 'secouriste' = any (qs) then
    qs := qs || array['volontaire_non_medical'];
  end if;

  permis := coalesce(p_fiche->'permis', '{}'::jsonb);
  a_select := coalesce((permis->>'selection_medicale') in ('true','t','1'), false);
  if a_select then
    qs := qs || array['chauffeur'];
  end if;

  select coalesce(array_agg(distinct x), '{}'::text[]) into qs
    from unnest(qs) as x
    where x is not null and x <> '';
  return qs;
end $$;

-- Les fiches déjà encodées avec la sélection médicale reçoivent Chauffeur.
update public.profiles
set fiche = jsonb_set(
  fiche,
  '{qualifications}',
  (
    select coalesce(jsonb_agg(x), '[]'::jsonb)
    from (
      select distinct e as x
      from (
        select jsonb_array_elements_text(coalesce(fiche->'qualifications', '[]'::jsonb)) as e
        union all
        select 'chauffeur'
      ) s
    ) t
  )
)
where coalesce((fiche->'permis'->>'selection_medicale') in ('true', 't', '1'), false)
  and not coalesce(fiche->'qualifications', '[]'::jsonb) ? 'chauffeur';

notify pgrst, 'reload schema';
