-- ════════════════════════════════════════════════════════════════════════════
--  Calendrier des disponibilités & missions (sans données patient).
--  Disponibilité = journée entière (minuit → minuit).
--  Missions : lieu / activité uniquement. Filtre non-médical.
--  Idempotent. À exécuter après 11_photos_terrain.sql.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.souhaits
  add column if not exists date_fin date,
  add column if not exists courte_duree boolean default false;

alter table public.souhaits drop constraint if exists souhaits_dates_coherentes;
alter table public.souhaits add constraint souhaits_dates_coherentes
  check (date_fin is null or date_souhaitee is null or date_fin >= date_souhaitee);

-- Qui voit les disponibilités de tout le personnel
create or replace function public.peut_voir_toutes_dispos()
returns boolean language sql stable security definer set search_path = public as $$
  with me as (select role::text as role, fiche from public.profiles where id = auth.uid())
  select coalesce((
    select role in ('admin','president','coordinateur')
        or coalesce(fiche->'roles_asbl' ?| array[
             'president','vice_president',
             'coord_transport','coord_transport_adjoint',
             'recolteur_souhait',
             'coord_benevoles','coord_benevoles_adjoint',
             'resp_informatique','resp_informatique_adjoint','administrateur_asbl'
           ], false)
    from me
  ), false)
$$;

-- Volontaire non médical « de base » (pas les coordinations)
create or replace function public.calendrier_non_med_restreint()
returns boolean language sql stable security definer set search_path = public as $$
  select not public.peut_voir_toutes_dispos()
     and exists (
       select 1 from public.profiles
       where id = auth.uid()
         and (
           (fiche->>'type_benevole') = 'non_medical'
           or (role::text = 'volontaire_non_medical'
               and coalesce(fiche->>'type_benevole','') is distinct from 'medical')
         )
     )
$$;

create or replace function public.quals_d_un_profil(p_role text, p_fiche jsonb)
returns text[] language sql immutable as $$
  select coalesce(array_agg(distinct q), '{}'::text[])
  from unnest(
    coalesce((
      select array_agg(value)
      from jsonb_array_elements_text(coalesce(p_fiche->'qualifications', '[]'::jsonb))
    ), '{}'::text[])
    || case p_role
         when 'ambulancier_bleu' then array['ambulancier']
         when 'ambulancier_gris' then array['ambulancier']
         when 'infirmier' then array['infirmier']
         when 'medecin' then array['medecin']
         when 'volontaire_non_medical' then array['volontaire_non_medical']
         else '{}'::text[]
       end
    || case when p_fiche->>'type_benevole' = 'non_medical' then array['volontaire_non_medical'] else '{}'::text[] end
  ) as q
  where q is not null and q <> ''
$$;

drop function if exists public.calendrier_missions(date, date);
create or replace function public.calendrier_missions(p_debut date, p_fin date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  restreint boolean;
  resultat jsonb := '[]'::jsonb;
  r record;
  requis text[];
  couverts text[];
  besoin_nm boolean;
  d0 date;
  d1 date;
  lieu text;
  act text;
begin
  if p_debut is null or p_fin is null then return '[]'::jsonb; end if;
  restreint := public.calendrier_non_med_restreint();

  for r in
    select s.id, s.date_souhaitee, s.date_fin, s.courte_duree, s.heure_depart, s.heure_retour,
           s.localisation, s.description, s.statut, s.mission
    from public.souhaits s
    where s.statut::text <> 'non_realise'
      and s.date_souhaitee is not null
      and coalesce(s.date_fin, s.date_souhaitee) >= p_debut
      and s.date_souhaitee <= p_fin
  loop
    d0 := r.date_souhaitee;
    d1 := coalesce(r.date_fin, r.date_souhaitee);
    select coalesce(array_agg(x), '{}'::text[]) into requis
      from jsonb_array_elements_text(coalesce(r.mission->'roles_requis', '[]'::jsonb)) as t(x);
    besoin_nm := ('volontaire_non_medical' = any (requis))
              or coalesce((r.mission->>'besoin_non_medical') in ('true','t','1'), false);
    if restreint and not besoin_nm then
      continue;
    end if;

    select coalesce(array_agg(distinct q), '{}'::text[])
      into couverts
    from public.souhait_personnel sp
    join public.profiles p on p.id = sp.user_id
    cross join lateral unnest(public.quals_d_un_profil(p.role::text, coalesce(p.fiche, '{}'::jsonb))) q
    where sp.souhait_id = r.id
      and (requis = '{}'::text[] or q = any (requis));

    if requis = '{}'::text[] then
      couverts := '{}'::text[];
    end if;

    lieu := nullif(btrim(coalesce(r.localisation, '')), '');
    act := left(btrim(coalesce(r.description, '')), 80);

    resultat := resultat || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'souhait_id', r.id,
      'date_debut', d0,
      'date_fin', d1,
      'courte_duree', coalesce(r.courte_duree, false),
      'heure_debut', r.heure_depart,
      'heure_fin', r.heure_retour,
      'lieu', lieu,
      'activite', nullif(act, ''),
      'besoin_non_medical', besoin_nm,
      'roles_requis', to_jsonb(requis),
      'roles_couverts', to_jsonb(coalesce(couverts, '{}'::text[])),
      'statut', r.statut::text,
      'ouvre', public.peut_voir_souhaits(),
      'affecte', public.suis_affecte(r.id)
    )));
  end loop;

  return resultat;
end $$;

grant execute on function public.peut_voir_toutes_dispos() to authenticated;
grant execute on function public.calendrier_missions(date, date) to authenticated;

-- RLS disponibilités : soi-même ; tout le personnel seulement pour les rôles ci-dessus
drop policy if exists disponibilites_staff_all on public.disponibilites;
drop policy if exists dispos_select on public.disponibilites;
drop policy if exists dispos_insert on public.disponibilites;
drop policy if exists dispos_update on public.disponibilites;
drop policy if exists dispos_delete on public.disponibilites;

create policy dispos_select on public.disponibilites for select to authenticated
  using (user_id = auth.uid() or public.peut_voir_toutes_dispos());
create policy dispos_insert on public.disponibilites for insert to authenticated
  with check (user_id = auth.uid() and public.is_staff());
create policy dispos_update on public.disponibilites for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy dispos_delete on public.disponibilites for delete to authenticated
  using (user_id = auth.uid());

notify pgrst, 'reload schema';
