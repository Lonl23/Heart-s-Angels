-- ════════════════════════════════════════════════════════════════════════════
--  Terrain : données d'itinéraire structurées, checklists véhicule/PEC,
--  démarrer / terminer la mission sans accès médical.
--  Idempotent. À exécuter après 09_missions_volontaires.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.souhait_personnel add column if not exists vecteur_id text;

-- Helper : poser une valeur dans un chemin JSONB en créant les objets parents.
create or replace function public._jsonb_set_path(m jsonb, p text[], val jsonb)
returns jsonb language plpgsql immutable as $$
declare i int; acc jsonb := coalesce(m, '{}'::jsonb); pref text[];
begin
  if p is null or array_length(p, 1) is null then return acc; end if;
  for i in 1 .. array_length(p, 1) - 1 loop
    pref := p[1:i];
    if acc #> pref is null or jsonb_typeof(acc #> pref) <> 'object' then
      acc := jsonb_set(acc, pref, '{}'::jsonb, true);
    end if;
  end loop;
  return jsonb_set(acc, p, val, true);
end $$;

-- Liste d'affectations (aucune donnée médicale, pas de nom de famille)
drop function if exists public.mes_affectations();
create or replace function public.mes_affectations()
returns table(
  souhait_id uuid,
  beneficiaire_prenom text,
  date_souhaitee date,
  statut text,
  vehicule text,
  role_mission text,
  description text,
  lieu text
)
language sql stable security definer set search_path = public as $$
  select
    s.id,
    s.beneficiaire_prenom,
    s.date_souhaitee,
    s.statut::text,
    coalesce(
      nullif(sp.vehicule, ''),
      (
        select e->>'nom'
        from jsonb_array_elements(coalesce(s.mission->'vecteurs', '[]'::jsonb)) e
        where e->>'id' = sp.vecteur_id
        limit 1
      )
    ),
    sp.role_mission,
    s.description,
    coalesce(
      s.mission->'dest_adresse'->>'localite',
      s.mission->'pec_adresse'->>'localite',
      s.localisation
    )
  from public.souhait_personnel sp
  join public.souhaits s on s.id = sp.souhait_id
  where sp.user_id = auth.uid()
  order by
    case s.statut::text
      when 'en_cours' then 0
      when 'pret' then 1
      when 'en_attente' then 2
      when 'nouveau' then 3
      else 4
    end,
    s.date_souhaitee nulls last
$$;

-- Détail restreint pour le terrain (structure lue par Mes missions)
create or replace function public.ma_mission(p_souhait uuid)
returns json language plpgsql stable security definer set search_path = public as $$
declare
  s public.souhaits;
  sp public.souhait_personnel;
  m jsonb;
  v jsonb;
  vid text;
  pec_adr jsonb;
begin
  select * into sp from public.souhait_personnel
    where souhait_id = p_souhait and user_id = auth.uid() limit 1;
  if not found then return json_build_object('ok', false); end if;
  select * into s from public.souhaits where id = p_souhait;
  m := coalesce(s.mission, '{}'::jsonb);
  vid := nullif(sp.vecteur_id, '');
  if vid is not null then
    select e into v
    from jsonb_array_elements(coalesce(m->'vecteurs', '[]'::jsonb)) e
    where e->>'id' = vid
    limit 1;
  end if;
  if v is null then
    select e into v from jsonb_array_elements(coalesce(m->'vecteurs', '[]'::jsonb)) e limit 1;
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
    'vecteur', v,
    'base', json_build_object(
      'nom', m->>'base_nom',
      'adresse', m->'base_adresse',
      'rdv', m->>'rdv_base',
      'depart', m->>'depart_base'
    ),
    'pec', json_build_object(
      'type', m->>'pec_type',
      'institution', m->>'pec_institution',
      'adresse', pec_adr,
      'service', m->>'pec_service',
      'etage', m->>'pec_etage',
      'aile', m->>'pec_aile',
      'chambre', m->>'pec_chambre',
      'heure', m->>'arrivee_pec',
      'depart', m->>'depart_pec',
      'precisions', m->>'pec_precisions'
    ),
    'destination', json_build_object(
      'adresse', m->'dest_adresse',
      'precisions', m->>'dest_precisions',
      'heure', m->>'arrivee_destination'
    ),
    'retour', json_build_object(
      'type', m->>'retour_type',
      'heure', m->>'retour_heure',
      'precisions', m->>'retour_precisions'
    ),
    'consignes_equipage', m->>'consignes_equipage',
    'rapport_observations', m->>'rapport_observations',
    'check_base', coalesce(
      case when vid is not null then m->'vecteur_checklists'->vid->'base' end,
      m->'checklists'->'base',
      '{}'::jsonb
    ),
    'check_retour_base', coalesce(
      case when vid is not null then m->'vecteur_checklists'->vid->'retour_base' end,
      m->'checklists'->'retour_base',
      '{}'::jsonb
    ),
    'check_pec', coalesce(m->'checklists'->'pec', '{}'::jsonb),
    'check_retour_pec', coalesce(m->'checklists'->'retour_pec', '{}'::jsonb)
  );
end $$;

-- Cocher un item de checklist terrain (véhicule ou PEC). Pas d'accès médical.
create or replace function public.cocher_terrain(
  p_souhait uuid, p_section text, p_item text, p_val boolean
)
returns json language plpgsql security definer set search_path = public as $$
declare
  m jsonb;
  sp public.souhait_personnel;
  vid text;
begin
  if not public.suis_affecte(p_souhait) then
    return json_build_object('ok', false, 'error', 'non affecté');
  end if;
  if p_section not in ('base', 'retour_base', 'pec', 'retour_pec') then
    return json_build_object('ok', false, 'error', 'section interdite');
  end if;
  select * into sp from public.souhait_personnel
    where souhait_id = p_souhait and user_id = auth.uid() limit 1;
  select coalesce(mission, '{}'::jsonb) into m from public.souhaits where id = p_souhait;
  m := public._jsonb_set_path(m, array['checklists', p_section, p_item], to_jsonb(p_val));
  if p_section in ('base', 'retour_base') then
    vid := nullif(sp.vecteur_id, '');
    if vid is null then
      select e->>'id' into vid
      from jsonb_array_elements(coalesce(m->'vecteurs', '[]'::jsonb)) e
      limit 1;
    end if;
    if vid is not null then
      m := public._jsonb_set_path(m, array['vecteur_checklists', vid, p_section, p_item], to_jsonb(p_val));
    end if;
  end if;
  update public.souhaits set mission = m where id = p_souhait;
  return json_build_object('ok', true);
end $$;

-- Alias historique (signature 4 arguments). L'ancienne signature à 5 args (p_vecteur) est retirée.
drop function if exists public.check_vehicule(uuid, text, text, text, boolean);
create or replace function public.check_vehicule(
  p_souhait uuid, p_section text, p_item text, p_val boolean
)
returns json language plpgsql security definer set search_path = public as $$
begin
  return public.cocher_terrain(p_souhait, p_section, p_item, p_val);
end $$;

-- Démarrer (en_cours) ou clôturer (realise) depuis le terrain
create or replace function public.avancer_mission(p_souhait uuid, p_statut text)
returns json language plpgsql security definer set search_path = public as $$
declare
  s public.souhaits;
  m jsonb;
  maintenant text := to_char(now() at time zone 'Europe/Brussels', 'YYYY-MM-DD"T"HH24:MI');
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
  if p_statut = 'en_cours' then
    m := public._jsonb_set_path(m, array['demarre_le'], to_jsonb(maintenant));
    update public.souhaits set statut = 'en_cours', mission = m where id = p_souhait;
  else
    m := public._jsonb_set_path(m, array['cloture_le'], to_jsonb(maintenant));
    update public.souhaits
      set statut = 'realise',
          mission = m,
          date_realisee = coalesce(date_realisee, (now() at time zone 'Europe/Brussels')::date)
      where id = p_souhait;
  end if;
  return json_build_object('ok', true, 'statut', p_statut);
end $$;

-- Notes logistiques (pas de rapport médical)
create or replace function public.noter_mission(p_souhait uuid, p_observations text)
returns json language plpgsql security definer set search_path = public as $$
declare m jsonb;
begin
  if not public.suis_affecte(p_souhait) then
    return json_build_object('ok', false, 'error', 'non affecté');
  end if;
  select coalesce(mission, '{}'::jsonb) into m from public.souhaits where id = p_souhait;
  m := public._jsonb_set_path(m, array['rapport_observations'], to_jsonb(coalesce(p_observations, '')));
  update public.souhaits set mission = m where id = p_souhait;
  return json_build_object('ok', true);
end $$;

grant execute on function public._jsonb_set_path(jsonb, text[], jsonb) to authenticated;
grant execute on function public.mes_affectations() to authenticated;
grant execute on function public.ma_mission(uuid) to authenticated;
grant execute on function public.cocher_terrain(uuid, text, text, boolean) to authenticated;
grant execute on function public.check_vehicule(uuid, text, text, boolean) to authenticated;
grant execute on function public.avancer_mission(uuid, text) to authenticated;
grant execute on function public.noter_mission(uuid, text) to authenticated;

notify pgrst, 'reload schema';
