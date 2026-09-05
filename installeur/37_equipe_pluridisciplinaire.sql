-- ════════════════════════════════════════════════════════════════════════════
--  Équipe pluridisciplinaire (mission.equipe_pluri) : n° du médecin exposé
--  aux affectés via mes_affectations / ma_mission.
--  Idempotent. Après 36_etape_heures_detresse.sql.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.medecin_equipe_pluri(m jsonb)
returns json language sql stable as $$
  select coalesce((
    select json_build_object(
      'nom', nullif(trim(both from concat_ws(' ', nullif(e->>'prenom', ''), nullif(e->>'nom', ''))), ''),
      'tel', nullif(btrim(e->>'tel'), '')
    )
    from jsonb_array_elements(coalesce(m->'equipe_pluri', '[]'::jsonb)) e
    where e->>'role' = 'medecin'
      and nullif(btrim(e->>'tel'), '') is not null
    limit 1
  ), json_build_object('nom', null, 'tel', null))
$$;

drop function if exists public.mes_affectations();
create or replace function public.mes_affectations()
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
  medecin_nom text
)
language sql stable security definer set search_path = public as $$
  select
    s.id,
    s.beneficiaire_prenom,
    s.date_souhaitee,
    s.date_fin,
    coalesce(s.dates_possibles, '[]'::jsonb),
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
    ),
    public.coordonnees_appel(s.id)->>'tel',
    public.coordonnees_appel(s.id)->>'libelle',
    coalesce(s.origine, 'prive'),
    public.medecin_equipe_pluri(s.mission)->>'tel',
    public.medecin_equipe_pluri(s.mission)->>'nom'
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
  appel json;
  med json;
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

  appel := public.coordonnees_appel(p_souhait);
  med := public.medecin_equipe_pluri(m);

  return json_build_object(
    'ok', true,
    'statut', s.statut::text,
    'beneficiaire_prenom', s.beneficiaire_prenom,
    'description', s.description,
    'date_souhaitee', s.date_souhaitee,
    'date_fin', s.date_fin,
    'dates_possibles', coalesce(s.dates_possibles, '[]'::jsonb),
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
    'checklist_extras', coalesce(m->'checklist_extras', '{}'::jsonb),
    'origine', coalesce(s.origine, 'prive'),
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

grant execute on function public.medecin_equipe_pluri(jsonb) to authenticated;
grant execute on function public.mes_affectations() to authenticated;
grant execute on function public.ma_mission(uuid) to authenticated;

notify pgrst, 'reload schema';
