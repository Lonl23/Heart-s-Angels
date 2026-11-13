-- ════════════════════════════════════════════════════════════════════════════
--  Écritures terrain atomiques : verrou de ligne (FOR UPDATE) pour que deux
--  vecteurs n’écrasent plus photos / statuts / étapes l’un de l’autre.
--  Idempotent. Après 40_vnm_sans_medical.sql.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.patch_mission_cle(
  p_souhait uuid, p_cle text, p_valeur jsonb, p_mode text default 'set'
)
returns json language plpgsql security definer set search_path = public as $$
declare
  m jsonb;
  sp public.souhait_personnel;
  allowed text[] := array['rapport_medical', 'rapport_observations', 'injections_detresse'];
  voir_med boolean;
begin
  if not public.suis_affecte(p_souhait) then
    return json_build_object('ok', false, 'error', 'non affecté');
  end if;
  if not (p_cle = any(allowed)) then
    return json_build_object('ok', false, 'error', 'clé interdite');
  end if;
  select * into sp from public.souhait_personnel
    where souhait_id = p_souhait and user_id = auth.uid() limit 1;
  voir_med := public.session_profil_est_medical(sp.role_mission);
  if p_cle in ('rapport_medical', 'injections_detresse') and not voir_med then
    return json_build_object('ok', false, 'error', 'réservé au médical');
  end if;
  select coalesce(mission, '{}'::jsonb) into m from public.souhaits where id = p_souhait for update;
  if p_cle = 'injections_detresse' and coalesce(p_mode, 'set') = 'append' then
    m := public._jsonb_set_path(
      m,
      array[p_cle],
      coalesce(m->p_cle, '[]'::jsonb) || jsonb_build_array(coalesce(p_valeur, '{}'::jsonb))
    );
  else
    m := public._jsonb_set_path(m, array[p_cle], coalesce(p_valeur, 'null'::jsonb));
  end if;
  update public.souhaits set mission = m where id = p_souhait;
  return json_build_object('ok', true);
end $$;

create or replace function public.sauver_photo_terrain(
  p_souhait uuid, p_vecteur text, p_slot text, p_meta jsonb, p_action text default 'set'
)
returns json language plpgsql security definer set search_path = public as $$
declare
  m jsonb;
  coins text[] := array['avant','arriere','gauche','droit','avant_gauche','avant_droit','arriere_gauche','arriere_droit'];
  extras text[] := array['pec','retour_pec','retour_base','ticket_carburant','ticket_carburant_matin'];
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
  select coalesce(mission, '{}'::jsonb) into m from public.souhaits where id = p_souhait for update;

  if p_slot = any(coins) then
    m := public._jsonb_set_path(m, array['terrain_photos', p_vecteur, 'coins', p_slot], coalesce(p_meta, 'null'::jsonb));
  elsif p_slot in ('ticket_carburant', 'ticket_carburant_matin') then
    m := public._jsonb_set_path(m, array['terrain_photos', p_vecteur, p_slot], coalesce(p_meta, 'null'::jsonb));
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

create or replace function public.set_etape_terrain(p_souhait uuid, p_etape text)
returns json language plpgsql security definer set search_path = public as $$
declare
  m jsonb;
  sp public.souhait_personnel;
  vid text;
  e text;
  iso text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
begin
  if not public.suis_affecte(p_souhait) then
    return json_build_object('ok', false, 'error', 'non affecté');
  end if;
  e := public.normaliser_etape_terrain(p_etape);
  if not public.etape_terrain_ok(e) then
    return json_build_object('ok', false, 'error', 'étape interdite');
  end if;
  select * into sp from public.souhait_personnel
    where souhait_id = p_souhait and user_id = auth.uid() limit 1;
  select coalesce(mission, '{}'::jsonb) into m from public.souhaits where id = p_souhait for update;
  vid := public._vid_affectation(sp.vecteur_id, m);
  m := public._jsonb_set_path(m, array['etape_terrain'], to_jsonb(e));
  if vid is not null then
    m := public._jsonb_set_path(m, array['vecteur_etapes', vid], to_jsonb(e));
    m := public._marquer_heure_etape(m, vid, e, iso);
  end if;
  update public.souhaits set mission = m where id = p_souhait;
  return json_build_object('ok', true, 'vecteur_id', vid, 'etape', e);
end $$;

create or replace function public.set_statut_base(p_souhait uuid, p_statut text)
returns json language plpgsql security definer set search_path = public as $$
declare
  m jsonb;
  uid uuid := auth.uid();
  iso text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
begin
  if not public.suis_affecte(p_souhait) then
    return json_build_object('ok', false, 'error', 'non affecté');
  end if;
  if p_statut is not null and p_statut not in ('en_route', 'arrive', 'pret') then
    return json_build_object('ok', false, 'error', 'statut interdit');
  end if;
  select coalesce(mission, '{}'::jsonb) into m from public.souhaits where id = p_souhait for update;
  update public.souhait_personnel
    set statut_base = nullif(p_statut, '')
    where souhait_id = p_souhait and user_id = uid;
  m := public._jsonb_set_path(m, array['personnel_statuts', uid::text], to_jsonb(coalesce(p_statut, '')));
  if p_statut = 'arrive' and coalesce(m #>> array['personnel_heures', uid::text], '') = '' then
    m := public._jsonb_set_path(m, array['personnel_heures', uid::text], to_jsonb(iso));
  end if;
  update public.souhaits set mission = m where id = p_souhait;
  return json_build_object('ok', true, 'statut_base', p_statut);
end $$;

create or replace function public.avancer_mission(p_souhait uuid, p_statut text)
returns json language plpgsql security definer set search_path = public as $$
declare
  s public.souhaits;
  m jsonb;
  sp public.souhait_personnel;
  vid text;
  maintenant text := to_char(now() at time zone 'Europe/Brussels', 'YYYY-MM-DD"T"HH24:MI');
  iso text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  vids text[];
  x text;
  tous_rentes boolean := true;
  wish_statut text;
begin
  if p_statut not in ('en_cours', 'realise') then
    return json_build_object('ok', false, 'error', 'statut interdit');
  end if;
  if not (public.suis_affecte(p_souhait) or public.peut_voir_souhaits()) then
    return json_build_object('ok', false, 'error', 'non autorisé');
  end if;
  select * into s from public.souhaits where id = p_souhait for update;
  if not found then return json_build_object('ok', false, 'error', 'introuvable'); end if;
  if s.statut::text = 'non_realise' then
    return json_build_object('ok', false, 'error', 'souhait non réalisé');
  end if;
  if p_statut = 'en_cours' and s.statut::text = 'realise' then
    return json_build_object('ok', false, 'error', 'mission déjà clôturée');
  end if;
  m := coalesce(s.mission, '{}'::jsonb);
  select * into sp from public.souhait_personnel
    where souhait_id = p_souhait and user_id = auth.uid() limit 1;
  vid := case when found then public._vid_affectation(sp.vecteur_id, m) else null end;

  if p_statut = 'en_cours' then
    if vid is not null then
      m := public._jsonb_set_path(m, array['vecteur_statuts', vid], to_jsonb('en_cours'::text));
    end if;
    if m->>'demarre_le' is null then
      m := public._jsonb_set_path(m, array['demarre_le'], to_jsonb(maintenant));
    end if;
    update public.souhaits set statut = 'en_cours', mission = m where id = p_souhait;
    return json_build_object('ok', true, 'statut', 'en_cours', 'vecteur_statut', 'en_cours', 'vecteur_id', vid);
  end if;

  if vid is not null then
    m := public._jsonb_set_path(m, array['vecteur_statuts', vid], to_jsonb('realise'::text));
    m := public._jsonb_set_path(m, array['vecteur_etapes', vid], to_jsonb('base_rentre'::text));
    m := public._jsonb_set_path(m, array['etape_terrain'], to_jsonb('base_rentre'::text));
    m := public._jsonb_set_path(m, array['vecteur_clotures', vid], to_jsonb(maintenant));
    m := public._marquer_heure_etape(m, vid, 'base_rentre', iso);
  end if;

  select coalesce(array_agg(distinct nullif(vecteur_id, '')), '{}'::text[])
    into vids
    from public.souhait_personnel
    where souhait_id = p_souhait and nullif(vecteur_id, '') is not null;

  if vids is null or vids = '{}'::text[] then
    tous_rentes := true;
  else
    foreach x in array vids loop
      if coalesce(m->'vecteur_statuts'->>x, '') is distinct from 'realise' then
        tous_rentes := false;
      end if;
    end loop;
  end if;

  if tous_rentes then
    m := public._jsonb_set_path(m, array['cloture_le'], to_jsonb(maintenant));
    update public.souhaits
      set statut = 'realise',
          mission = m,
          date_realisee = coalesce(date_realisee, (now() at time zone 'Europe/Brussels')::date)
      where id = p_souhait;
    wish_statut := 'realise';
  else
    if s.statut::text is distinct from 'en_cours' and s.statut::text is distinct from 'realise' then
      update public.souhaits set statut = 'en_cours', mission = m where id = p_souhait;
      wish_statut := 'en_cours';
    else
      update public.souhaits set mission = m where id = p_souhait;
      wish_statut := s.statut::text;
    end if;
  end if;

  return json_build_object(
    'ok', true,
    'statut', wish_statut,
    'vecteur_statut', case when vid is null and tous_rentes then 'realise' else coalesce(m->'vecteur_statuts'->>vid, 'realise') end,
    'vecteur_id', vid
  );
end $$;

create or replace function public.cocher_terrain(
  p_souhait uuid, p_section text, p_item text, p_val boolean
)
returns json language plpgsql security definer set search_path = public as $$
declare
  m jsonb;
  sp public.souhait_personnel;
  vid text;
  moi_med boolean;
  vec_med boolean;
begin
  if not public.suis_affecte(p_souhait) then
    return json_build_object('ok', false, 'error', 'non affecté');
  end if;
  if p_section not in ('base', 'retour_base', 'pec', 'retour_pec') then
    return json_build_object('ok', false, 'error', 'section interdite');
  end if;
  select * into sp from public.souhait_personnel
    where souhait_id = p_souhait and user_id = auth.uid() limit 1;
  select coalesce(mission, '{}'::jsonb) into m from public.souhaits where id = p_souhait for update;
  vid := public._vid_affectation(sp.vecteur_id, m);

  if public.item_checklist_est_medical(p_section, p_item) then
    select public.profil_est_medical(p.role::text, coalesce(p.fiche, '{}'::jsonb), sp.role_mission)
      into moi_med
      from public.profiles p where p.id = auth.uid();
    vec_med := public.vecteur_a_medical(p_souhait, vid);
    if not coalesce(moi_med, false) or not vec_med then
      return json_build_object('ok', false, 'error', 'checklist médicale : réservée au médical de ce véhicule');
    end if;
  end if;

  m := public._jsonb_set_path(m, array['checklists', p_section, p_item], to_jsonb(p_val));
  if vid is not null then
    m := public._jsonb_set_path(m, array['vecteur_checklists', vid, p_section, p_item], to_jsonb(p_val));
  end if;
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
  select coalesce(mission, '{}'::jsonb) into m from public.souhaits where id = p_souhait for update;
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

create or replace function public.noter_mission(p_souhait uuid, p_observations text)
returns json language plpgsql security definer set search_path = public as $$
declare m jsonb;
begin
  if not public.suis_affecte(p_souhait) then
    return json_build_object('ok', false, 'error', 'non affecté');
  end if;
  select coalesce(mission, '{}'::jsonb) into m from public.souhaits where id = p_souhait for update;
  m := public._jsonb_set_path(m, array['rapport_observations'], to_jsonb(coalesce(p_observations, '')));
  update public.souhaits set mission = m where id = p_souhait;
  return json_build_object('ok', true);
end $$;

grant execute on function public.patch_mission_cle(uuid, text, jsonb, text) to authenticated;
grant execute on function public.sauver_photo_terrain(uuid, text, text, jsonb, text) to authenticated;
grant execute on function public.set_etape_terrain(uuid, text) to authenticated;
grant execute on function public.set_statut_base(uuid, text) to authenticated;
grant execute on function public.avancer_mission(uuid, text) to authenticated;
grant execute on function public.cocher_terrain(uuid, text, text, boolean) to authenticated;
grant execute on function public.maj_releves_vehicule(uuid, jsonb) to authenticated;
grant execute on function public.noter_mission(uuid, text) to authenticated;

notify pgrst, 'reload schema';
