-- L’affectation reste en préparation tant que l’équipage et le vecteur
-- ne sont pas validés. Mes missions et la notification partent à ce moment-là.
-- Les lignes déjà en place restent publiées.

alter table public.souhait_personnel
  add column if not exists publie boolean not null default true;

comment on column public.souhait_personnel.publie is
  'Faux pendant la préparation : le volontaire ne voit pas encore la mission et ne reçoit pas la notification.';

create or replace function public.trg_assignation_notif()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.souhaits;
  lieu text;
begin
  if coalesce(new.publie, true) is not true then
    return new;
  end if;
  if tg_op = 'UPDATE' and coalesce(old.publie, true) is true then
    return new;
  end if;
  select * into s from public.souhaits where id = new.souhait_id;
  if not found then return new; end if;
  if coalesce(s.fictif, false) then return new; end if;
  if coalesce(s.mission->>'demo_cle', '') <> '' then return new; end if;
  lieu := coalesce(nullif(s.localisation, ''), s.mission->>'lieu', s.mission->>'activite', 'Mission');
  perform public.notifier_evenement(
    'assignation_souhait',
    'Affectation à un souhait',
    public.fmt_dates_souhait(s) || ' · ' || lieu,
    '/app/missions/' || new.souhait_id::text || '?volet=recap',
    'haute',
    array[new.user_id],
    new.id,
    jsonb_build_object('souhait_id', new.souhait_id)
  );
  return new;
end
$$;

drop trigger if exists trg_assignation_notif on public.souhait_personnel;
create trigger trg_assignation_notif
  after insert or update of publie on public.souhait_personnel
  for each row execute function public.trg_assignation_notif();

-- Mes missions : ignorer les affectations encore en préparation.
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
    where coalesce(sp.publie, true)
      and s.statut::text not in ('non_realise', 'annule', 'demande_info_externe')
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
  'Missions du volontaire déjà validées, plus la formation fictive.';

notify pgrst, 'reload schema';
