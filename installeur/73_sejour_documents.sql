-- ════════════════════════════════════════════════════════════════════════════
--  Séjour multi-jours : documents (hôtel, parking…) + transports annexes
--  (départ / sur place hôtel, restaurant…). Les 9 étapes de base restent.
--  Idempotent. Après 72_demo_visible_tous.sql.
-- ════════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'mission-docs',
  'mission-docs',
  false,
  15728640,
  array[
    'application/pdf',
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'
  ]
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create or replace function public._mission_doc_souhait(p_name text)
returns uuid language plpgsql immutable as $$
declare id uuid;
begin
  begin
    id := split_part(p_name, '/', 1)::uuid;
  exception when others then
    return null;
  end;
  return id;
end $$;

drop policy if exists mission_docs_select on storage.objects;
drop policy if exists mission_docs_insert on storage.objects;
drop policy if exists mission_docs_update on storage.objects;
drop policy if exists mission_docs_delete on storage.objects;

create policy mission_docs_select on storage.objects for select to authenticated
  using (
    bucket_id = 'mission-docs'
    and (
      public.peut_voir_souhaits()
      or public.suis_affecte(public._mission_doc_souhait(name))
    )
  );
create policy mission_docs_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'mission-docs'
    and (
      public.peut_voir_souhaits()
      or public.suis_affecte(public._mission_doc_souhait(name))
    )
  );
create policy mission_docs_update on storage.objects for update to authenticated
  using (
    bucket_id = 'mission-docs'
    and (
      public.peut_voir_souhaits()
      or public.suis_affecte(public._mission_doc_souhait(name))
    )
  );
create policy mission_docs_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'mission-docs'
    and (
      public.peut_voir_souhaits()
      or public.suis_affecte(public._mission_doc_souhait(name))
    )
  );

create or replace function public.etape_terrain_ok(p_etape text)
returns boolean language sql immutable as $$
  select public.normaliser_etape_terrain(p_etape) in (
    'a_la_base',
    'depart_pec', 'pec_sur_place',
    'depart_dest', 'dest_sur_place',
    'depart_retour', 'retour_sur_place',
    'depart_base', 'base_rentre'
  )
  or public.normaliser_etape_terrain(p_etape) ~* '^(depart_lieu|lieu_sur_place):(hotel|parking|restaurant|autre):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
$$;

create or replace function public.set_etape_terrain(p_souhait uuid, p_etape text)
returns json language plpgsql security definer set search_path = public as $$
declare
  m jsonb;
  vid text;
  e text;
  lieu_id text;
  etape_prec text;
  iso text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
begin
  if not public.suis_affecte(p_souhait) then
    return json_build_object('ok', false, 'error', 'non affecté');
  end if;
  e := public.normaliser_etape_terrain(p_etape);
  if not public.etape_terrain_ok(e) then
    return json_build_object('ok', false, 'error', 'étape interdite');
  end if;
  select coalesce(mission, '{}'::jsonb) into m from public.souhaits where id = p_souhait for update;
  if e ~* '^(depart_lieu|lieu_sur_place):' then
    lieu_id := split_part(e, ':', 3);
    if not exists (
      select 1
      from jsonb_array_elements(coalesce(m->'lieux_annexes', '[]'::jsonb)) x
      where x->>'id' = lieu_id
    ) then
      return json_build_object('ok', false, 'error', 'lieu inconnu');
    end if;
  end if;
  vid := public.vid_session_terrain(p_souhait, m);
  if vid is not null then
    etape_prec := coalesce(nullif(m->'vecteur_etapes'->>vid, ''), m->>'etape_terrain');
    if etape_prec is not null and etape_prec <> e then
      m := public._jsonb_set_path(m, array['vecteur_etape_prec', vid], to_jsonb(etape_prec));
    end if;
  end if;
  m := public._jsonb_set_path(m, array['etape_terrain'], to_jsonb(e));
  if vid is not null then
    m := public._jsonb_set_path(m, array['vecteur_etapes', vid], to_jsonb(e));
    m := public._marquer_heure_etape(m, vid, e, iso);
  end if;
  update public.souhaits set mission = m where id = p_souhait;
  return json_build_object('ok', true, 'vecteur_id', vid, 'etape', e);
end $$;

grant execute on function public.set_etape_terrain(uuid, text) to authenticated;
grant execute on function public.etape_terrain_ok(text) to authenticated;

create or replace function public.sejour_mission(p_souhait uuid)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  m jsonb;
begin
  if not (public.suis_affecte(p_souhait) or public.peut_voir_souhaits()) then
    return json_build_object('ok', false);
  end if;
  select coalesce(mission, '{}'::jsonb) into m from public.souhaits where id = p_souhait;
  if m is null then return json_build_object('ok', false); end if;
  return json_build_object(
    'ok', true,
    'lieux', coalesce(m->'lieux_annexes', '[]'::jsonb)
  );
end
$$;

grant execute on function public.sejour_mission(uuid) to authenticated;
grant execute on function public._mission_doc_souhait(text) to authenticated;

notify pgrst, 'reload schema';
