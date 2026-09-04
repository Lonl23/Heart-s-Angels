-- ════════════════════════════════════════════════════════════════════════════
--  Parcours terrain fluide : sur place / départ / lieu suivant, jusqu’à
--  rentrée base. Idempotent. Après 22_checklist_extras.sql.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.normaliser_etape_terrain(p_etape text)
returns text language sql immutable as $$
  select case coalesce(p_etape, '')
    when 'vehicule'    then 'base_sur_place'
    when 'pec'         then 'pec_sur_place'
    when 'retour_pec'  then 'dest_sur_place'
    when ''            then 'base_sur_place'
    else p_etape
  end
$$;

create or replace function public.etape_terrain_ok(p_etape text)
returns boolean language sql immutable as $$
  select public.normaliser_etape_terrain(p_etape) in (
    'base_sur_place', 'base_depart',
    'pec_route', 'pec_sur_place', 'pec_depart',
    'dest_route', 'dest_sur_place', 'dest_depart',
    'retour_route', 'retour_sur_place',
    'retour_base', 'base_rentre'
  )
$$;

create or replace function public.set_etape_terrain(p_souhait uuid, p_etape text)
returns json language plpgsql security definer set search_path = public as $$
declare
  m jsonb;
  sp public.souhait_personnel;
  vid text;
  e text;
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
  select coalesce(mission, '{}'::jsonb) into m from public.souhaits where id = p_souhait;
  vid := public._vid_affectation(sp.vecteur_id, m);
  m := public._jsonb_set_path(m, array['etape_terrain'], to_jsonb(e));
  if vid is not null then
    m := public._jsonb_set_path(m, array['vecteur_etapes', vid], to_jsonb(e));
  end if;
  update public.souhaits set mission = m where id = p_souhait;
  return json_build_object('ok', true, 'vecteur_id', vid, 'etape', e);
end $$;

create or replace function public.avancer_mission(p_souhait uuid, p_statut text)
returns json language plpgsql security definer set search_path = public as $$
declare
  s public.souhaits;
  m jsonb;
  sp public.souhait_personnel;
  vid text;
  maintenant text := to_char(now() at time zone 'Europe/Brussels', 'YYYY-MM-DD"T"HH24:MI');
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
  select * into s from public.souhaits where id = p_souhait;
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

grant execute on function public.normaliser_etape_terrain(text) to authenticated;
grant execute on function public.etape_terrain_ok(text) to authenticated;
grant execute on function public.set_etape_terrain(uuid, text) to authenticated;
grant execute on function public.avancer_mission(uuid, text) to authenticated;

notify pgrst, 'reload schema';
