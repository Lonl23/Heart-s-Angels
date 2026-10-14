-- ════════════════════════════════════════════════════════════════════════════
--  Souhait de formation : visible dans Mes missions pour tout le personnel,
--  sans affectation d’équipage. Terrain (checklists, détresse) jouable.
--  Idempotent. Après 71_souhait_demo_detresse.sql.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.est_souhait_demo(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.souhaits s
    where s.id = p_id
      and coalesce(s.fictif, false)
      and coalesce(s.mission->>'demo_cle', '') <> ''
  )
$$;

create or replace function public.est_souhait_demo_ouvert(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.souhaits s
    where s.id = p_id
      and coalesce(s.fictif, false)
      and coalesce(s.mission->>'demo_cle', '') <> ''
      and s.statut::text not in ('realise', 'non_realise', 'annule', 'demande_info_externe')
  )
$$;

create or replace function public.suis_affecte(p_souhait uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.souhait_personnel
    where souhait_id = p_souhait and user_id = auth.uid()
  )
  or (
    public.is_staff()
    and public.est_souhait_demo_ouvert(p_souhait)
  )
$$;

create or replace function public._sur_mission_stock(p_souhait uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_souhait is not null and (
    public.peut_gerer_stock()
    or public.suis_affecte(p_souhait)
  )
$$;

-- Jouette : le vecteur ambulance du dossier démo est traité comme médical
-- même sans équipage affecté, pour que le protocole de détresse s’affiche.
create or replace function public.vecteur_a_medical(p_souhait uuid, p_vecteur text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.souhait_personnel sp
    join public.profiles p on p.id = sp.user_id
    where sp.souhait_id = p_souhait
      and p_vecteur is not null and p_vecteur <> ''
      and sp.vecteur_id is not distinct from p_vecteur
      and public.profil_est_medical(p.role::text, coalesce(p.fiche, '{}'::jsonb), sp.role_mission)
  )
  or (
    public.est_souhait_demo(p_souhait)
    and (
      public.session_profil_est_medical(null)
      or exists (
        select 1
        from public.souhaits s,
             jsonb_array_elements(coalesce(s.mission->'vecteurs', '[]'::jsonb)) e
        where s.id = p_souhait
          and (p_vecteur is null or p_vecteur = '' or e->>'id' = p_vecteur)
          and coalesce(e->'roles_requis', '[]'::jsonb) ?| array['ambulancier','infirmier','medecin']
      )
    )
  )
$$;

create or replace function public.vid_session_terrain(p_souhait uuid, m jsonb)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  sp public.souhait_personnel;
begin
  select * into sp from public.souhait_personnel
    where souhait_id = p_souhait and user_id = auth.uid() limit 1;
  return public._vid_affectation(case when found then sp.vecteur_id else null end, m);
end
$$;

drop function if exists public.mes_affectations();
create function public.mes_affectations()
returns table(
  souhait_id uuid,
  beneficiaire_prenom text,
  date_souhaitee date,
  date_fin date,
  dates_possibles jsonb,
  statut text,
  vehicule text,
  role_mission text,
  description text,
  lieu text,
  statut_base text,
  etape_vehicule text,
  tel_a_appeler text,
  tel_a_appeler_libelle text,
  origine text,
  medecin_tel text,
  medecin_nom text,
  fictif boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with moi as (
    select auth.uid() as uid
  ),
  affectees as (
    select
      s.id,
      s.beneficiaire_prenom,
      s.date_souhaitee,
      s.date_fin,
      coalesce(s.dates_possibles, '[]'::jsonb) as dates_possibles,
      s.statut::text as statut,
      coalesce(
        nullif(sp.vehicule, ''),
        (
          select e->>'nom'
          from jsonb_array_elements(coalesce(s.mission->'vecteurs', '[]'::jsonb)) e
          where e->>'id' = sp.vecteur_id
          limit 1
        )
      ) as vehicule,
      sp.role_mission,
      s.description,
      coalesce(
        s.mission->'dest_adresse'->>'localite',
        s.mission->'pec_adresse'->>'localite',
        s.localisation
      ) as lieu,
      coalesce(sp.statut_base, s.mission->'personnel_statuts'->>sp.user_id::text) as statut_base,
      public.etape_du_vecteur(s.mission, sp.vecteur_id) as etape_vehicule,
      public.coordonnees_appel(s.id)->>'tel' as tel_a_appeler,
      public.coordonnees_appel(s.id)->>'libelle' as tel_a_appeler_libelle,
      coalesce(s.origine, 'prive') as origine,
      case when public.session_profil_est_medical(sp.role_mission)
           then public.medecin_equipe_pluri(s.mission)->>'tel' end as medecin_tel,
      case when public.session_profil_est_medical(sp.role_mission)
           then public.medecin_equipe_pluri(s.mission)->>'nom' end as medecin_nom,
      coalesce(s.fictif, false) as fictif
    from public.souhait_personnel sp
    join public.souhaits s on s.id = sp.souhait_id
    join moi on sp.user_id = moi.uid
    where s.statut::text not in ('realise', 'non_realise', 'annule', 'demande_info_externe')
  ),
  demos as (
    select
      s.id,
      s.beneficiaire_prenom,
      s.date_souhaitee,
      s.date_fin,
      coalesce(s.dates_possibles, '[]'::jsonb),
      s.statut::text,
      coalesce(
        nullif((
          select e->>'nom'
          from jsonb_array_elements(coalesce(s.mission->'vecteurs', '[]'::jsonb)) e
          limit 1
        ), ''),
        (
          select e->>'type_transport'
          from jsonb_array_elements(coalesce(s.mission->'vecteurs', '[]'::jsonb)) e
          limit 1
        )
      ),
      'formation'::text,
      s.description,
      coalesce(
        s.mission->'dest_adresse'->>'localite',
        s.mission->'pec_adresse'->>'localite',
        s.localisation
      ),
      s.mission->'personnel_statuts'->>moi.uid::text,
      public.etape_du_vecteur(
        s.mission,
        (
          select e->>'id'
          from jsonb_array_elements(coalesce(s.mission->'vecteurs', '[]'::jsonb)) e
          limit 1
        )
      ),
      public.coordonnees_appel(s.id)->>'tel',
      public.coordonnees_appel(s.id)->>'libelle',
      coalesce(s.origine, 'prive'),
      case when public.session_profil_est_medical(null)
           then public.medecin_equipe_pluri(s.mission)->>'tel' end,
      case when public.session_profil_est_medical(null)
           then public.medecin_equipe_pluri(s.mission)->>'nom' end,
      true
    from public.souhaits s
    cross join moi
    where public.is_staff()
      and coalesce(s.fictif, false)
      and coalesce(s.mission->>'demo_cle', '') <> ''
      and s.statut::text not in ('realise', 'non_realise', 'annule', 'demande_info_externe')
      and not exists (
        select 1 from public.souhait_personnel sp
        where sp.souhait_id = s.id and sp.user_id = moi.uid
      )
  )
  select * from (
    select * from affectees
    union all
    select * from demos
  ) x
  order by
    case x.statut
      when 'en_cours' then 0
      when 'pret' then 1
      when 'en_attente' then 2
      when 'nouveau' then 3
      else 4
    end,
    x.date_souhaitee nulls last
$$;

comment on function public.mes_affectations() is
  'Missions du volontaire : affectations encore à réaliser, plus les souhaits de formation (fictifs) visibles sans équipage.';

grant execute on function public.mes_affectations() to authenticated;
grant execute on function public.est_souhait_demo(uuid) to authenticated;
grant execute on function public.est_souhait_demo_ouvert(uuid) to authenticated;
grant execute on function public.vid_session_terrain(uuid, jsonb) to authenticated;

create or replace function public.ma_mission(p_souhait uuid)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
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
  appel json;
  med json;
  voir_med boolean;
  extras jsonb;
  chk_pec jsonb;
  chk_retour jsonb;
  a_sp boolean;
  uid uuid := auth.uid();
begin
  select * into sp from public.souhait_personnel
    where souhait_id = p_souhait and user_id = uid limit 1;
  a_sp := found;
  if not a_sp and not (public.is_staff() and public.est_souhait_demo_ouvert(p_souhait)) then
    return json_build_object('ok', false);
  end if;
  select * into s from public.souhaits where id = p_souhait;
  if not found then return json_build_object('ok', false); end if;
  m := coalesce(s.mission, '{}'::jsonb);
  vid := public.vid_session_terrain(p_souhait, m);
  voir_med := public.session_profil_est_medical(case when a_sp then sp.role_mission else null end);
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', e->>'id', 'nom', e->>'nom', 'plaque', e->>'plaque', 'type_transport', e->>'type_transport'
    )), '[]'::jsonb)
    into dispos
    from jsonb_array_elements(coalesce(m->'vecteurs','[]'::jsonb)) e;
  n := jsonb_array_length(coalesce(dispos, '[]'::jsonb));

  if vid is not null then
    select e into v from jsonb_array_elements(coalesce(m->'vecteurs','[]'::jsonb)) e
      where e->>'id' = vid limit 1;
  end if;

  if (m->>'pec_type') = 'Domicile du patient' then pec_adr := m->'patient_adresse';
  else pec_adr := m->'pec_adresse';
  end if;

  etape := public.etape_du_vecteur(m, vid);
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

  appel := public.coordonnees_appel(p_souhait);
  med := public.medecin_equipe_pluri(m);
  extras := coalesce(m->'checklist_extras', '{}'::jsonb);
  chk_pec := coalesce(
    case when vid is not null then m->'vecteur_checklists'->vid->'pec' end,
    m->'checklists'->'pec',
    '{}'::jsonb
  );
  chk_retour := coalesce(
    case when vid is not null then m->'vecteur_checklists'->vid->'retour_pec' end,
    m->'checklists'->'retour_pec',
    '{}'::jsonb
  );
  if not voir_med then
    extras := public.checklist_extras_non_medicales(extras);
    chk_pec := '{}'::jsonb;
    chk_retour := public.check_section_non_medicale('retour_pec', chk_retour);
    med := json_build_object('nom', null, 'tel', null);
  end if;

  return json_build_object(
    'ok', true,
    'statut', s.statut::text,
    'beneficiaire_prenom', s.beneficiaire_prenom,
    'description', s.description,
    'date_souhaitee', s.date_souhaitee,
    'date_fin', s.date_fin,
    'dates_possibles', coalesce(s.dates_possibles, '[]'::jsonb),
    'role_mission', case when a_sp then sp.role_mission else 'formation' end,
    'statut_base', coalesce(
      case when a_sp then sp.statut_base end,
      m->'personnel_statuts'->>uid::text
    ),
    'vecteur_id', vid,
    'vecteur', v,
    'vecteurs_dispo', case when v is null then dispos else '[]'::jsonb end,
    'etape_terrain', etape,
    'vecteur_statut', vstat,
    'nb_vecteurs', n,
    'nb_vecteurs_equipes', greatest(
      (
        select count(distinct spx.vecteur_id)
        from public.souhait_personnel spx
        where spx.souhait_id = p_souhait and nullif(spx.vecteur_id, '') is not null
      ),
      case when vid is not null then 1 else 0 end
    ),
    'equipage_medical', public.vecteur_a_medical(p_souhait, vid),
    'equipage', crew,
    'photos', coalesce(m->'terrain_photos'->vid, '{}'::jsonb),
    'checklist_extras', extras,
    'origine', coalesce(s.origine, 'prive'),
    'fictif', coalesce(s.fictif, false),
    'demo_cle', m->>'demo_cle',
    'tel_a_appeler', appel->>'tel',
    'tel_a_appeler_libelle', appel->>'libelle',
    'medecin_tel', med->>'tel',
    'medecin_nom', med->>'nom',
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
    'check_pec', chk_pec,
    'check_retour_pec', chk_retour
  );
end
$$;

grant execute on function public.ma_mission(uuid) to authenticated;

create or replace function public.avancer_mission(p_souhait uuid, p_statut text)
returns json language plpgsql security definer set search_path = public as $$
declare
  s public.souhaits;
  m jsonb;
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
  vid := public.vid_session_terrain(p_souhait, m);

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

  if (vids is null or vids = '{}'::text[]) and vid is not null then
    vids := array[vid];
  end if;

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

grant execute on function public.avancer_mission(uuid, text) to authenticated;

create or replace function public.maj_releves_vehicule(p_souhait uuid, p_patch jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare
  m jsonb; vid text; arr jsonb; i int; e jsonb; k text;
begin
  if not public.suis_affecte(p_souhait) then
    return json_build_object('ok', false, 'error', 'non affecté');
  end if;
  select coalesce(mission, '{}'::jsonb) into m from public.souhaits where id = p_souhait for update;
  vid := public.vid_session_terrain(p_souhait, m);
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

grant execute on function public.maj_releves_vehicule(uuid, jsonb) to authenticated;

create or replace function public.patch_mission_cle(
  p_souhait uuid, p_cle text, p_valeur jsonb, p_mode text default 'set'
)
returns json language plpgsql security definer set search_path = public as $$
declare
  m jsonb;
  sp public.souhait_personnel;
  allowed text[] := array['rapport_medical', 'rapport_observations', 'injections_detresse'];
  voir_med boolean;
  a_sp boolean;
begin
  if not public.suis_affecte(p_souhait) then
    return json_build_object('ok', false, 'error', 'non affecté');
  end if;
  if not (p_cle = any(allowed)) then
    return json_build_object('ok', false, 'error', 'clé interdite');
  end if;
  select * into sp from public.souhait_personnel
    where souhait_id = p_souhait and user_id = auth.uid() limit 1;
  a_sp := found;
  voir_med := public.session_profil_est_medical(case when a_sp then sp.role_mission else null end);
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

grant execute on function public.patch_mission_cle(uuid, text, jsonb, text) to authenticated;

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
  a_sp boolean;
begin
  if not public.suis_affecte(p_souhait) then
    return json_build_object('ok', false, 'error', 'non affecté');
  end if;
  if p_section not in ('base', 'retour_base', 'pec', 'retour_pec') then
    return json_build_object('ok', false, 'error', 'section interdite');
  end if;
  select * into sp from public.souhait_personnel
    where souhait_id = p_souhait and user_id = auth.uid() limit 1;
  a_sp := found;
  select coalesce(mission, '{}'::jsonb) into m from public.souhaits where id = p_souhait for update;
  vid := public.vid_session_terrain(p_souhait, m);

  if public.item_checklist_est_medical(p_section, p_item) then
    select public.profil_est_medical(
      p.role::text,
      coalesce(p.fiche, '{}'::jsonb),
      case when a_sp then sp.role_mission else null end
    )
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

grant execute on function public.cocher_terrain(uuid, text, text, boolean) to authenticated;

create or replace function public.set_etape_terrain(p_souhait uuid, p_etape text)
returns json language plpgsql security definer set search_path = public as $$
declare
  m jsonb;
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
  select coalesce(mission, '{}'::jsonb) into m from public.souhaits where id = p_souhait for update;
  vid := public.vid_session_terrain(p_souhait, m);
  m := public._jsonb_set_path(m, array['etape_terrain'], to_jsonb(e));
  if vid is not null then
    m := public._jsonb_set_path(m, array['vecteur_etapes', vid], to_jsonb(e));
    m := public._marquer_heure_etape(m, vid, e, iso);
  end if;
  update public.souhaits set mission = m where id = p_souhait;
  return json_build_object('ok', true, 'vecteur_id', vid, 'etape', e);
end $$;

grant execute on function public.set_etape_terrain(uuid, text) to authenticated;

notify pgrst, 'reload schema';
