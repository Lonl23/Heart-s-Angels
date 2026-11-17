-- ════════════════════════════════════════════════════════════════════════════
--  Formation Camille : hors préparation collective, progression individuelle.
--  — Le statut partagé du souhait demo reste figé (pret).
--  — L’avancement vit uniquement dans formation_sessions (par compte).
--  — mes_affectations ne masque plus la formation si le dossier a été
--    déplacé par erreur dans une colonne terminale.
--  Idempotent. Après 123_evenements_ouverts.sql.
-- ════════════════════════════════════════════════════════════════════════════

-- Autorise les recyclages / seed à toucher le statut partagé.
create or replace function public._demo_statut_autorise()
returns boolean
language sql
stable
as $$
  select coalesce(nullif(current_setting('app.demo_statut_libre', true), ''), '') = '1'
$$;

create or replace function public.trg_demo_statut_partage_fige()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not public.est_souhait_demo(new.id) then
    return new;
  end if;
  if public._demo_statut_autorise() then
    return new;
  end if;
  -- Le dossier partagé ne porte plus l’avancement d’un volontaire.
  if old.statut is distinct from new.statut then
    new.statut := old.statut;
  end if;
  if old.date_realisee is distinct from new.date_realisee then
    new.date_realisee := old.date_realisee;
  end if;
  return new;
end
$$;

drop trigger if exists trg_demo_statut_partage_fige on public.souhaits;
create trigger trg_demo_statut_partage_fige
  before update on public.souhaits
  for each row execute function public.trg_demo_statut_partage_fige();

-- Remet le dossier partagé en « prêt » (encodage seul) et nettoie l’exécution.
do $$
begin
  perform set_config('app.demo_statut_libre', '1', true);
  update public.souhaits
     set statut = 'pret',
         date_realisee = null,
         mission = public.nettoyer_execution_mission_demo(coalesce(mission, '{}'::jsonb))
                    - 'rapport_observations'
   where coalesce(fictif, false)
     and coalesce(mission->>'demo_cle', '') <> '';
end
$$;

-- Recyclage unitaire : autorise le changement de statut partagé.
create or replace function public.recycler_un_souhait_demo(p_id uuid, p_jour date default public.date_bruxelles())
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.souhaits;
  m jsonb;
begin
  perform set_config('app.demo_statut_libre', '1', true);
  select * into s from public.souhaits where id = p_id for update;
  if not found then return false; end if;
  if coalesce(s.mission->>'demo_cle', '') = '' then return false; end if;
  if not coalesce(s.fictif, false) then return false; end if;

  m := public.appliquer_jour_mission_demo(s.mission, p_jour);
  m := jsonb_set(m, '{date_demande}', to_jsonb(to_char(p_jour, 'YYYY-MM-DD')), true);

  update public.souhaits
     set statut          = 'pret',
         date_souhaitee  = p_jour,
         date_fin        = p_jour,
         dates_possibles = '[]'::jsonb,
         date_realisee   = null,
         heure_depart    = time '09:30',
         heure_retour    = time '16:30',
         courte_duree    = true,
         mission         = m,
         updated_at      = now()
   where id = p_id;

  delete from public.souhait_personnel where souhait_id = p_id;

  update public.souhait_medicaments
     set donne = false,
         prises = '[]'::jsonb
   where souhait_id = p_id;

  update public.souhait_checklist
     set coche = false,
         coche_par = null,
         coche_le = null
   where souhait_id = p_id;

  return true;
end
$$;

revoke all on function public.recycler_un_souhait_demo(uuid, date) from public, anon, authenticated;
grant execute on function public.recycler_un_souhait_demo(uuid, date) to service_role;

-- Recyclage quotidien : doit pouvoir poser / remettre le statut partagé.
create or replace function public.recycler_souhaits_demo()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  auj date := public.date_bruxelles();
  r record;
  n_clotures int := 0;
  n_dates int := 0;
  jour_cloture date;
begin
  perform set_config('app.demo_statut_libre', '1', true);
  for r in
    select s.id, s.statut, s.date_realisee, s.date_souhaitee, s.updated_at, s.mission
      from public.souhaits s
     where coalesce(s.fictif, false)
       and coalesce(s.mission->>'demo_cle', '') <> ''
  loop
    -- Ancien cycle « réalisé » partagé : on recycle le dossier.
    -- Avec les sessions individuelles, le statut partagé reste en pret ;
    -- on avance seulement la date du jour si besoin.
    if r.statut::text = 'realise' then
      jour_cloture := coalesce(
        r.date_realisee,
        ((nullif(r.mission->>'cloture_le', ''))::timestamptz at time zone 'Europe/Brussels')::date,
        (r.updated_at at time zone 'Europe/Brussels')::date
      );
      if jour_cloture is not null and jour_cloture < auj then
        if public.recycler_un_souhait_demo(r.id, auj) then
          n_clotures := n_clotures + 1;
        end if;
      end if;
    elsif r.statut::text in ('nouveau', 'en_attente', 'pret', 'en_cours', 'terminee_terrain')
      and r.date_souhaitee is not null
      and r.date_souhaitee < auj
    then
      update public.souhaits
         set statut          = 'pret',
             date_souhaitee  = auj,
             date_fin        = auj,
             dates_possibles = '[]'::jsonb,
             heure_depart    = time '09:30',
             heure_retour    = time '16:30',
             mission         = public.appliquer_jour_mission_demo(mission, auj)
       where id = r.id;
      n_dates := n_dates + 1;
    end if;
  end loop;
  return json_build_object('ok', true, 'recycles', n_clotures, 'dates_avancees', n_dates, 'jour', auj);
end
$$;

revoke all on function public.recycler_souhaits_demo() from public, anon, authenticated;
grant execute on function public.recycler_souhaits_demo() to service_role;

-- Mes missions : formation toujours visible pour le staff ; statut partagé = pret
-- (l’UI superpose formation_sessions).
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
      case
        when public.est_souhait_demo(s.id) then 'pret'
        else s.statut::text
      end as statut,
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
    where coalesce(sp.publie, true)
      and (
        public.est_souhait_demo(s.id)
        or (
          s.statut::text not in ('non_realise', 'annule', 'demande_info_externe')
          and s.statut::text is distinct from 'realise'
        )
      )
  ),
  demos as (
    select
      s.id,
      s.beneficiaire_prenom,
      s.date_souhaitee,
      s.date_fin,
      coalesce(s.dates_possibles, '[]'::jsonb),
      'pret'::text,
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
      null::text,
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
      and not exists (
        select 1 from public.souhait_personnel sp
        where sp.souhait_id = s.id and sp.user_id = moi.uid
          and coalesce(sp.publie, true)
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
  'Missions validées du volontaire + formation fictive (toujours personnelle via formation_sessions).';

notify pgrst, 'reload schema';
