-- ════════════════════════════════════════════════════════════════════════════
--  Formation préparation (Léa TEST-Prep) : hors « Mes souhaits » volontaires.
--  Seule la formation terrain (Camille / formation_detresse) y apparaît.
--  Idempotent. Après 133_acces_preparation_motif.sql.
-- ════════════════════════════════════════════════════════════════════════════

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
      and not public.est_souhait_formation_preparation(s.id)
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
      and coalesce(s.mission->>'demo_cle', '') <> 'formation_preparation'
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
  'Missions validées + formation terrain (Camille). Hors formation préparation (Léa).';

notify pgrst, 'reload schema';
