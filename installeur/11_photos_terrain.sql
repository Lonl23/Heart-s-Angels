-- ════════════════════════════════════════════════════════════════════════════
--  Photos terrain (4 côtés du véhicule à la prise et à la remise + ticket carburant).
--  Un volontaire ne voit / ne coche que LE véhicule auquel il est affecté.
--  Idempotent. Après 10_mission_terrain.sql.
-- ════════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'mission-photos',
  'mission-photos',
  false,
  8388608,
  array['image/jpeg','image/png','image/webp','image/heic','image/heif']
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Chemin : {souhait_id}/{vecteur_id}/{slot}/{uuid}.jpg
create or replace function public._mission_photo_souhait(p_name text)
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

drop policy if exists mission_photos_select on storage.objects;
drop policy if exists mission_photos_insert on storage.objects;
drop policy if exists mission_photos_update on storage.objects;
drop policy if exists mission_photos_delete on storage.objects;

create policy mission_photos_select on storage.objects for select to authenticated
  using (
    bucket_id = 'mission-photos'
    and (
      public.peut_voir_souhaits()
      or public.suis_affecte(public._mission_photo_souhait(name))
    )
  );
create policy mission_photos_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'mission-photos'
    and public.suis_affecte(public._mission_photo_souhait(name))
  );
create policy mission_photos_update on storage.objects for update to authenticated
  using (
    bucket_id = 'mission-photos'
    and public.suis_affecte(public._mission_photo_souhait(name))
  );
create policy mission_photos_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'mission-photos'
    and public.suis_affecte(public._mission_photo_souhait(name))
  );

-- Choisir MON vecteur (pas celui d'un autre équipage)
create or replace function public.choisir_mon_vecteur(p_souhait uuid, p_vecteur text)
returns json language plpgsql security definer set search_path = public as $$
declare
  m jsonb; nom text;
begin
  if not public.suis_affecte(p_souhait) then
    return json_build_object('ok', false, 'error', 'non affecté');
  end if;
  select coalesce(mission, '{}'::jsonb) into m from public.souhaits where id = p_souhait;
  if not exists (
    select 1 from jsonb_array_elements(coalesce(m->'vecteurs','[]'::jsonb)) e where e->>'id' = p_vecteur
  ) then
    return json_build_object('ok', false, 'error', 'vecteur inconnu');
  end if;
  select e->>'nom' into nom
    from jsonb_array_elements(coalesce(m->'vecteurs','[]'::jsonb)) e
    where e->>'id' = p_vecteur limit 1;
  update public.souhait_personnel
    set vecteur_id = p_vecteur,
        vehicule = nullif(nom, '')
    where souhait_id = p_souhait and user_id = auth.uid();
  return json_build_object('ok', true, 'vecteur_id', p_vecteur);
end $$;

create or replace function public.set_etape_terrain(p_souhait uuid, p_etape text)
returns json language plpgsql security definer set search_path = public as $$
declare m jsonb;
begin
  if not public.suis_affecte(p_souhait) then
    return json_build_object('ok', false, 'error', 'non affecté');
  end if;
  if p_etape not in ('vehicule','pec','retour_pec','retour_base') then
    return json_build_object('ok', false, 'error', 'étape interdite');
  end if;
  select coalesce(mission, '{}'::jsonb) into m from public.souhaits where id = p_souhait;
  m := public._jsonb_set_path(m, array['etape_terrain'], to_jsonb(p_etape));
  update public.souhaits set mission = m where id = p_souhait;
  return json_build_object('ok', true);
end $$;

create or replace function public.maj_releves_vehicule(p_souhait uuid, p_patch jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare
  m jsonb; sp public.souhait_personnel; vid text; arr jsonb; i int; e jsonb; k text;
begin
  if not public.suis_affecte(p_souhait) then
    return json_build_object('ok', false, 'error', 'non affecté');
  end if;
  select * into sp from public.souhait_personnel
    where souhait_id = p_souhait and user_id = auth.uid() limit 1;
  vid := nullif(sp.vecteur_id, '');
  select coalesce(mission, '{}'::jsonb) into m from public.souhaits where id = p_souhait;
  if vid is null then
    return json_build_object('ok', false, 'error', 'pas de vecteur');
  end if;
  arr := coalesce(m->'vecteurs', '[]'::jsonb);
  for i in 0 .. jsonb_array_length(arr) - 1 loop
    e := arr -> i;
    if e->>'id' = vid then
      foreach k in array array['kms_depart','kms_retour','essence_pct'] loop
        if p_patch ? k then
          e := e || jsonb_build_object(k, p_patch -> k);
        end if;
      end loop;
      arr := jsonb_set(arr, array[i::text], e, false);
    end if;
  end loop;
  m := jsonb_set(m, array['vecteurs'], arr, true);
  update public.souhaits set mission = m where id = p_souhait;
  return json_build_object('ok', true);
end $$;

-- p_slot : avant_gauche | avant_droit | arriere_gauche | arriere_droit | pec | retour_pec | retour_base
-- p_action : set (coins) | add | update | delete
create or replace function public.sauver_photo_terrain(
  p_souhait uuid, p_vecteur text, p_slot text, p_meta jsonb, p_action text default 'set'
)
returns json language plpgsql security definer set search_path = public as $$
declare
  m jsonb;
  coins text[] := array['avant','arriere','gauche','droit','avant_gauche','avant_droit','arriere_gauche','arriere_droit'];
  extras text[] := array['pec','retour_pec','retour_base','ticket_carburant'];
  arr jsonb;
  i int;
  found boolean := false;
  coin_key text;
begin
  if not public.suis_affecte(p_souhait) then
    return json_build_object('ok', false, 'error', 'non affecté');
  end if;
  if p_vecteur is null or p_vecteur = '' then
    return json_build_object('ok', false, 'error', 'vecteur requis');
  end if;
  if not (p_slot = any(coins) or p_slot = any(extras) or p_slot like 'r\_%' escape '\') then
    return json_build_object('ok', false, 'error', 'slot interdit');
  end if;
  select coalesce(mission, '{}'::jsonb) into m from public.souhaits where id = p_souhait;

  if p_slot = any(coins) then
    m := public._jsonb_set_path(m, array['terrain_photos', p_vecteur, 'coins', p_slot], coalesce(p_meta, 'null'::jsonb));
  elsif p_slot = 'ticket_carburant' then
    m := public._jsonb_set_path(m, array['terrain_photos', p_vecteur, 'ticket_carburant'], coalesce(p_meta, 'null'::jsonb));
  elsif p_slot like 'r\_%' escape '\' then
    coin_key := substr(p_slot, 3);
    if coin_key = any(coins) then
      m := public._jsonb_set_path(m, array['terrain_photos', p_vecteur, 'coins_retour', coin_key], coalesce(p_meta, 'null'::jsonb));
    else
      return json_build_object('ok', false, 'error', 'slot interdit');
    end if;
  else
    arr := coalesce(m->'terrain_photos'->p_vecteur->p_slot, '[]'::jsonb);
    if jsonb_typeof(arr) <> 'array' then arr := '[]'::jsonb; end if;
    if p_action = 'add' then
      arr := arr || jsonb_build_array(p_meta);
    elsif p_action = 'delete' then
      arr := coalesce((
        select jsonb_agg(x) from jsonb_array_elements(arr) x
        where x->>'id' is distinct from p_meta->>'id'
      ), '[]'::jsonb);
    else
      for i in 0 .. jsonb_array_length(arr) - 1 loop
        if (arr -> i) ->> 'id' = p_meta->>'id' then
          arr := jsonb_set(arr, array[i::text], p_meta, false);
          found := true;
        end if;
      end loop;
      if not found then arr := arr || jsonb_build_array(p_meta); end if;
    end if;
    m := public._jsonb_set_path(m, array['terrain_photos', p_vecteur, p_slot], arr);
  end if;

  update public.souhaits set mission = m where id = p_souhait;
  return json_build_object('ok', true);
end $$;

-- ma_mission : uniquement LE vecteur de la personne (plus de repli sur un autre)
create or replace function public.ma_mission(p_souhait uuid)
returns json language plpgsql stable security definer set search_path = public as $$
declare
  s public.souhaits;
  sp public.souhait_personnel;
  m jsonb;
  v jsonb;
  vid text;
  pec_adr jsonb;
  dispos jsonb;
  n int;
begin
  select * into sp from public.souhait_personnel
    where souhait_id = p_souhait and user_id = auth.uid() limit 1;
  if not found then return json_build_object('ok', false); end if;
  select * into s from public.souhaits where id = p_souhait;
  m := coalesce(s.mission, '{}'::jsonb);
  vid := nullif(sp.vecteur_id, '');
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', e->>'id', 'nom', e->>'nom', 'plaque', e->>'plaque', 'type_transport', e->>'type_transport'
    )), '[]'::jsonb)
    into dispos
    from jsonb_array_elements(coalesce(m->'vecteurs','[]'::jsonb)) e;
  n := jsonb_array_length(coalesce(dispos, '[]'::jsonb));

  if vid is not null then
    select e into v from jsonb_array_elements(coalesce(m->'vecteurs','[]'::jsonb)) e
      where e->>'id' = vid limit 1;
  elsif n = 1 then
    select e into v from jsonb_array_elements(coalesce(m->'vecteurs','[]'::jsonb)) e limit 1;
    vid := v->>'id';
  end if;

  if (m->>'pec_type') = 'Domicile du patient' then pec_adr := m->'patient_adresse';
  else pec_adr := m->'pec_adresse';
  end if;

  return json_build_object(
    'ok', true,
    'statut', s.statut::text,
    'beneficiaire_prenom', s.beneficiaire_prenom,
    'description', s.description,
    'date_souhaitee', s.date_souhaitee,
    'role_mission', sp.role_mission,
    'vecteur_id', vid,
    'vecteur', v,
    'vecteurs_dispo', case when v is null then dispos else '[]'::jsonb end,
    'etape_terrain', m->>'etape_terrain',
    'photos', coalesce(m->'terrain_photos'->vid, '{}'::jsonb),
    'base', json_build_object(
      'nom', m->>'base_nom', 'adresse', m->'base_adresse',
      'rdv', m->>'rdv_base', 'depart', m->>'depart_base'
    ),
    'pec', json_build_object(
      'type', m->>'pec_type', 'institution', m->>'pec_institution', 'adresse', pec_adr,
      'service', m->>'pec_service', 'etage', m->>'pec_etage', 'aile', m->>'pec_aile',
      'chambre', m->>'pec_chambre', 'heure', m->>'arrivee_pec', 'depart', m->>'depart_pec',
      'precisions', m->>'pec_precisions'
    ),
    'destination', json_build_object(
      'adresse', m->'dest_adresse', 'precisions', m->>'dest_precisions', 'heure', m->>'arrivee_destination'
    ),
    'retour', json_build_object(
      'type', m->>'retour_type', 'heure', m->>'retour_heure', 'precisions', m->>'retour_precisions'
    ),
    'consignes_equipage', m->>'consignes_equipage',
    'rapport_observations', m->>'rapport_observations',
    'check_base', coalesce(
      case when vid is not null then m->'vecteur_checklists'->vid->'base' end,
      '{}'::jsonb
    ),
    'check_retour_base', coalesce(
      case when vid is not null then m->'vecteur_checklists'->vid->'retour_base' end,
      '{}'::jsonb
    ),
    'check_pec', coalesce(m->'checklists'->'pec', '{}'::jsonb),
    'check_retour_pec', coalesce(m->'checklists'->'retour_pec', '{}'::jsonb)
  );
end $$;

grant execute on function public._mission_photo_souhait(text) to authenticated;
grant execute on function public.choisir_mon_vecteur(uuid, text) to authenticated;
grant execute on function public.set_etape_terrain(uuid, text) to authenticated;
grant execute on function public.maj_releves_vehicule(uuid, jsonb) to authenticated;
grant execute on function public.sauver_photo_terrain(uuid, text, text, jsonb, text) to authenticated;
grant execute on function public.ma_mission(uuid) to authenticated;

notify pgrst, 'reload schema';
