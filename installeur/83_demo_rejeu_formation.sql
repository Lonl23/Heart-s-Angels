-- ════════════════════════════════════════════════════════════════════════════
--  Mission de formation (demo_cle) : chaque volontaire peut rejouer autant
--  de fois qu’il veut. On ignore « vecteur déjà rentré » / mission clôturée.
--  Pas d’archivage, pas d’équipage à reposer. Idempotent. Après 82.
-- ════════════════════════════════════════════════════════════════════════════

-- Visible et jouable même une fois « réalisé » (rejeu immédiat, sans attendre
-- le recyclage du lendemain). Non réalisé / annulé restent hors Mes missions.
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
      and s.statut::text not in ('non_realise', 'annule', 'demande_info_externe')
  )
$$;

comment on function public.est_souhait_demo_ouvert(uuid) is
  'Souhait de formation accessible au terrain, y compris après Réalisé (rejeu).';

-- En quittant En cours / Réalisé (glisser la colonne), on efface le terrain
-- pour ne plus bloquer sur un vecteur marqué rentré.
create or replace function public.trg_demo_sortie_realise()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not public.est_souhait_demo(new.id) then
    return new;
  end if;
  if old.statut::text in ('en_cours', 'realise')
     and new.statut::text is distinct from 'en_cours'
     and new.statut::text is distinct from 'realise'
  then
    new.date_realisee := null;
    new.mission := public.nettoyer_execution_mission_demo(coalesce(new.mission, '{}'::jsonb));
  end if;
  return new;
end
$$;

drop trigger if exists trg_demo_sortie_realise on public.souhaits;
create trigger trg_demo_sortie_realise
  before update on public.souhaits
  for each row execute function public.trg_demo_sortie_realise();

-- Rejouer : remet le terrain à zéro, sans toucher à l’encodage ni à l’équipage.
create or replace function public.recommencer_mission_demo(p_souhait uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.souhaits;
  m jsonb;
  cible text;
begin
  if not public.est_souhait_demo(p_souhait) then
    return json_build_object('ok', false, 'error', 'pas une mission de formation');
  end if;
  if not (public.suis_affecte(p_souhait) or public.is_staff()) then
    return json_build_object('ok', false, 'error', 'non autorisé');
  end if;
  select * into s from public.souhaits where id = p_souhait for update;
  if not found then return json_build_object('ok', false, 'error', 'introuvable'); end if;

  m := public.nettoyer_execution_mission_demo(coalesce(s.mission, '{}'::jsonb));
  cible := case
    when s.statut::text in ('realise', 'en_cours', 'non_realise') then 'pret'
    else s.statut::text
  end;

  update public.souhaits
     set statut        = cible::public.statut_souhait,
         mission       = m,
         date_realisee = null,
         updated_at    = now()
   where id = p_souhait;

  return json_build_object('ok', true, 'statut', cible);
end
$$;

grant execute on function public.recommencer_mission_demo(uuid) to authenticated;

comment on function public.recommencer_mission_demo(uuid) is
  'Remet le terrain du souhait de formation à zéro. L’encodage et l’équipage restent.';

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
  est_demo boolean := false;
  vec_ferme boolean := false;
begin
  if p_statut not in ('en_cours', 'realise') then
    return json_build_object('ok', false, 'error', 'statut interdit');
  end if;
  if not (public.suis_affecte(p_souhait) or public.peut_voir_souhaits()) then
    return json_build_object('ok', false, 'error', 'non autorisé');
  end if;
  select * into s from public.souhaits where id = p_souhait for update;
  if not found then return json_build_object('ok', false, 'error', 'introuvable'); end if;
  est_demo := public.est_souhait_demo(p_souhait);

  -- Formation : on ne bloque pas sur non réalisé / déjà clôturé / vecteur rentré.
  if s.statut::text = 'non_realise' and not est_demo then
    return json_build_object('ok', false, 'error', 'souhait non réalisé');
  end if;
  if p_statut = 'en_cours' and s.statut::text = 'realise' and not est_demo then
    return json_build_object('ok', false, 'error', 'mission déjà clôturée');
  end if;

  m := coalesce(s.mission, '{}'::jsonb);
  vid := public.vid_session_terrain(p_souhait, m);

  if p_statut = 'en_cours' then
    if est_demo then
      vec_ferme := (vid is not null and coalesce(m->'vecteur_statuts'->>vid, '') = 'realise')
        or coalesce(m->>'cloture_le', '') <> '';
      if s.statut::text in ('realise', 'non_realise') or vec_ferme then
        m := public.nettoyer_execution_mission_demo(m);
      end if;
    end if;
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

-- Mes missions : le dossier de formation reste listé après Réalisé, pour rejouer.
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
    where s.statut::text not in ('non_realise', 'annule', 'demande_info_externe')
      and (
        s.statut::text is distinct from 'realise'
        or (coalesce(s.fictif, false) and coalesce(s.mission->>'demo_cle', '') <> '')
      )
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
      and s.statut::text not in ('non_realise', 'annule', 'demande_info_externe')
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
  'Missions du volontaire : à réaliser, plus la formation fictive (rejouable même après Réalisé, sans équipage).';

grant execute on function public.mes_affectations() to authenticated;
grant execute on function public.est_souhait_demo_ouvert(uuid) to authenticated;

notify pgrst, 'reload schema';
