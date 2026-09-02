-- ════════════════════════════════════════════════════════════════════════════
--  Statuts terrain : présence personnelle à la base, étape par vecteur,
--  checklists médicales réservées à l’équipage médical du véhicule.
--  Idempotent. Après 20_roles_par_vecteur.sql.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.souhait_personnel add column if not exists statut_base text;

-- Infirmier / médecin / ambulancier (dual infi+ambu inclus). Pas chauffeur ni VNM.
create or replace function public.profil_est_medical(p_role text, p_fiche jsonb, p_role_mission text)
returns boolean language sql immutable as $$
  select
    coalesce(p_fiche->>'type_benevole', '') is distinct from 'non_medical'
    and (
      coalesce(p_role_mission, '') in ('ambulancier', 'infirmier', 'medecin')
      or coalesce(p_role, '') in ('medecin', 'infirmier', 'ambulancier_bleu', 'ambulancier_gris')
      or coalesce(p_fiche->>'type_benevole', '') = 'medical'
      or (
        jsonb_typeof(coalesce(p_fiche, '{}'::jsonb)->'qualifications') = 'array'
        and coalesce(p_fiche, '{}'::jsonb)->'qualifications' ?| array['ambulancier', 'infirmier', 'medecin']
      )
    );
$$;

create or replace function public.vecteur_a_medical(p_souhait uuid, p_vecteur text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.souhait_personnel sp
    join public.profiles p on p.id = sp.user_id
    where sp.souhait_id = p_souhait
      and p_vecteur is not null and p_vecteur <> ''
      and sp.vecteur_id is not distinct from p_vecteur
      and public.profil_est_medical(p.role::text, coalesce(p.fiche, '{}'::jsonb), sp.role_mission)
  );
$$;

create or replace function public.item_checklist_est_medical(p_section text, p_item text)
returns boolean language sql immutable as $$
  select case
    when p_section in ('pec') then true
    when p_section = 'retour_pec' and p_item in (
      'Traitements en surplus rendu',
      'Divers patients rendu',
      'Si institution, échange draps/matériel'
    ) then true
    else false
  end;
$$;

create or replace function public._vid_affectation(p_vecteur_id text, m jsonb)
returns text language plpgsql stable as $$
declare vid text; n int;
begin
  vid := nullif(p_vecteur_id, '');
  if vid is not null then return vid; end if;
  n := jsonb_array_length(coalesce(m->'vecteurs', '[]'::jsonb));
  if n = 1 then
    return coalesce(m->'vecteurs'->0->>'id', null);
  end if;
  return null;
end $$;

-- Présence personnelle à la base (un statut par volontaire, pas un checkbox partagé).
create or replace function public.set_statut_base(p_souhait uuid, p_statut text)
returns json language plpgsql security definer set search_path = public as $$
declare
  m jsonb;
  uid uuid := auth.uid();
begin
  if not public.suis_affecte(p_souhait) then
    return json_build_object('ok', false, 'error', 'non affecté');
  end if;
  if p_statut is not null and p_statut not in ('en_route', 'arrive', 'pret') then
    return json_build_object('ok', false, 'error', 'statut interdit');
  end if;
  update public.souhait_personnel
    set statut_base = nullif(p_statut, '')
    where souhait_id = p_souhait and user_id = uid;
  select coalesce(mission, '{}'::jsonb) into m from public.souhaits where id = p_souhait;
  m := public._jsonb_set_path(m, array['personnel_statuts', uid::text], to_jsonb(coalesce(p_statut, '')));
  update public.souhaits set mission = m where id = p_souhait;
  return json_build_object('ok', true, 'statut_base', p_statut);
end $$;

create or replace function public.set_etape_terrain(p_souhait uuid, p_etape text)
returns json language plpgsql security definer set search_path = public as $$
declare
  m jsonb;
  sp public.souhait_personnel;
  vid text;
begin
  if not public.suis_affecte(p_souhait) then
    return json_build_object('ok', false, 'error', 'non affecté');
  end if;
  if p_etape not in ('vehicule', 'pec', 'retour_pec', 'retour_base') then
    return json_build_object('ok', false, 'error', 'étape interdite');
  end if;
  select * into sp from public.souhait_personnel
    where souhait_id = p_souhait and user_id = auth.uid() limit 1;
  select coalesce(mission, '{}'::jsonb) into m from public.souhaits where id = p_souhait;
  vid := public._vid_affectation(sp.vecteur_id, m);
  m := public._jsonb_set_path(m, array['etape_terrain'], to_jsonb(p_etape));
  if vid is not null then
    m := public._jsonb_set_path(m, array['vecteur_etapes', vid], to_jsonb(p_etape));
  end if;
  update public.souhaits set mission = m where id = p_souhait;
  return json_build_object('ok', true, 'vecteur_id', vid, 'etape', p_etape);
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
      m := public._jsonb_set_path(m, array['vecteur_etapes', vid], to_jsonb('pec'::text));
    end if;
    if m->>'demarre_le' is null then
      m := public._jsonb_set_path(m, array['demarre_le'], to_jsonb(maintenant));
    end if;
    update public.souhaits set statut = 'en_cours', mission = m where id = p_souhait;
    return json_build_object('ok', true, 'statut', 'en_cours', 'vecteur_statut', 'en_cours', 'vecteur_id', vid);
  end if;

  -- realise : ce vecteur rentre ; le souhait ne passe à réalisé que si tous les vecteurs équipés sont rentrés.
  if vid is not null then
    m := public._jsonb_set_path(m, array['vecteur_statuts', vid], to_jsonb('realise'::text));
    m := public._jsonb_set_path(m, array['vecteur_etapes', vid], to_jsonb('retour_base'::text));
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
  select coalesce(mission, '{}'::jsonb) into m from public.souhaits where id = p_souhait;
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
  lieu text,
  statut_base text,
  etape_vehicule text
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
    ),
    coalesce(sp.statut_base, s.mission->'personnel_statuts'->>sp.user_id::text),
    coalesce(
      case when nullif(sp.vecteur_id, '') is not null
           then s.mission->'vecteur_etapes'->>sp.vecteur_id end,
      s.mission->>'etape_terrain'
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
  crew jsonb;
  etape text;
  vstat text;
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

  etape := coalesce(
    case when vid is not null then m->'vecteur_etapes'->>vid end,
    m->>'etape_terrain'
  );
  vstat := case when vid is not null then m->'vecteur_statuts'->>vid end;

  select coalesce(jsonb_agg(jsonb_build_object(
      'user_id', x.user_id,
      'prenom', x.prenom,
      'role_mission', x.role_mission,
      'statut_base', x.statut_base,
      'medical', x.medical
    ) order by x.prenom), '[]'::jsonb)
    into crew
    from (
      select
        sp2.user_id,
        p.prenom,
        sp2.role_mission,
        coalesce(sp2.statut_base, m->'personnel_statuts'->>sp2.user_id::text) as statut_base,
        public.profil_est_medical(p.role::text, coalesce(p.fiche, '{}'::jsonb), sp2.role_mission) as medical
      from public.souhait_personnel sp2
      join public.profiles p on p.id = sp2.user_id
      where sp2.souhait_id = p_souhait
        and vid is not null
        and sp2.vecteur_id is not distinct from vid
    ) x;

  return json_build_object(
    'ok', true,
    'statut', s.statut::text,
    'beneficiaire_prenom', s.beneficiaire_prenom,
    'description', s.description,
    'date_souhaitee', s.date_souhaitee,
    'role_mission', sp.role_mission,
    'statut_base', coalesce(sp.statut_base, m->'personnel_statuts'->>sp.user_id::text),
    'vecteur_id', vid,
    'vecteur', v,
    'vecteurs_dispo', case when v is null then dispos else '[]'::jsonb end,
    'etape_terrain', etape,
    'vecteur_statut', vstat,
    'nb_vecteurs', n,
    'nb_vecteurs_equipes', (
      select count(distinct spx.vecteur_id)
      from public.souhait_personnel spx
      where spx.souhait_id = p_souhait and nullif(spx.vecteur_id, '') is not null
    ),
    'equipage_medical', public.vecteur_a_medical(p_souhait, vid),
    'equipage', crew,
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
    'check_pec', coalesce(
      case when vid is not null then m->'vecteur_checklists'->vid->'pec' end,
      m->'checklists'->'pec',
      '{}'::jsonb
    ),
    'check_retour_pec', coalesce(
      case when vid is not null then m->'vecteur_checklists'->vid->'retour_pec' end,
      m->'checklists'->'retour_pec',
      '{}'::jsonb
    )
  );
end $$;

grant execute on function public.profil_est_medical(text, jsonb, text) to authenticated;
grant execute on function public.vecteur_a_medical(uuid, text) to authenticated;
grant execute on function public.item_checklist_est_medical(text, text) to authenticated;
grant execute on function public._vid_affectation(text, jsonb) to authenticated;
grant execute on function public.set_statut_base(uuid, text) to authenticated;
grant execute on function public.set_etape_terrain(uuid, text) to authenticated;
grant execute on function public.avancer_mission(uuid, text) to authenticated;
grant execute on function public.cocher_terrain(uuid, text, text, boolean) to authenticated;
grant execute on function public.mes_affectations() to authenticated;
grant execute on function public.ma_mission(uuid) to authenticated;

notify pgrst, 'reload schema';
