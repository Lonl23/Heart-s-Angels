-- Disponibilités : retrait réservé au N+1 et au N+2, chauffeur si
-- sélection médicale (ambulancier ou infirmier), ville de la base sur
-- le calendrier. Une annulation libère l’équipage et laisse la
-- disponibilité en place.

create or replace function public.quals_d_un_profil(p_role text, p_fiche jsonb)
returns text[] language plpgsql immutable set search_path = public as $$
declare
  qs text[] := '{}';
  permis jsonb;
  a_permis boolean;
  a_select boolean;
begin
  select coalesce(array_agg(value), '{}'::text[]) into qs
    from jsonb_array_elements_text(coalesce(p_fiche->'qualifications', '[]'::jsonb));

  qs := qs || case p_role
    when 'ambulancier_bleu' then array['ambulancier']
    when 'ambulancier_gris' then array['ambulancier']
    when 'infirmier' then array['infirmier']
    when 'medecin' then array['medecin']
    when 'volontaire_non_medical' then array['volontaire_non_medical']
    else '{}'::text[]
  end;
  if p_fiche->>'type_benevole' = 'non_medical' or 'secouriste' = any (qs) then
    qs := qs || array['volontaire_non_medical'];
  end if;

  permis := coalesce(p_fiche->'permis', '{}'::jsonb);
  a_permis := coalesce((permis->>'B') in ('true','t','1'), false)
           or coalesce((permis->>'C') in ('true','t','1'), false)
           or coalesce((permis->>'E') in ('true','t','1'), false);
  a_select := coalesce((permis->>'selection_medicale') in ('true','t','1'), false);

  if ('ambulancier' = any (qs) or 'infirmier' = any (qs)) and a_permis and a_select then
    qs := qs || array['chauffeur'];
  end if;

  select coalesce(array_agg(distinct x), '{}'::text[]) into qs
    from unnest(qs) as x
    where x is not null and x <> '';
  return qs;
end $$;

-- N+1 et N+2 d’une personne, d’après l’organigramme.
-- Dans l’arbre : N+1 = n1_id, N+2 = le N+1 de ce N+1.
-- Hors arbre (volontaire) : N+1 = lignes n1_volontaires, N+2 = leur N+1.
create or replace function public.superieurs_disponibilite(p_user uuid)
returns table (superieur_id uuid, rang int)
language sql
stable
security definer
set search_path = public
as $$
  with place as (
    select o.n1_id
    from public.organigramme o
    where o.profile_id = p_user
  )
  select s.superieur_id, s.rang
  from (
    select p.n1_id as superieur_id, 1 as rang
    from place p
    where p.n1_id is not null
    union
    select parent.n1_id, 2
    from place p
    join public.organigramme parent on parent.profile_id = p.n1_id
    where parent.n1_id is not null
  ) s
  where exists (select 1 from place)
  union
  select s.superieur_id, s.rang
  from (
    select o.profile_id as superieur_id, 1 as rang
    from public.organigramme o
    where o.n1_volontaires
    union
    select o.n1_id, 2
    from public.organigramme o
    where o.n1_volontaires and o.n1_id is not null
  ) s
  where not exists (select 1 from place);
$$;

create or replace function public.peut_retirer_disponibilite(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_user is not null
     and auth.uid() is not null
     and p_user is distinct from auth.uid()
     and exists (
       select 1
       from public.superieurs_disponibilite(p_user) s
       where s.superieur_id = auth.uid()
         and s.rang in (1, 2)
     );
$$;

create or replace function public.mes_retraits_disponibilites()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.id
  from public.profiles p
  where public.peut_retirer_disponibilite(p.id);
$$;

revoke all on function public.superieurs_disponibilite(uuid) from public, anon;
revoke all on function public.peut_retirer_disponibilite(uuid) from public, anon;
revoke all on function public.mes_retraits_disponibilites() from public, anon;
grant execute on function public.superieurs_disponibilite(uuid) to authenticated;
grant execute on function public.peut_retirer_disponibilite(uuid) to authenticated;
grant execute on function public.mes_retraits_disponibilites() to authenticated;

drop policy if exists dispos_select on public.disponibilites;
create policy dispos_select on public.disponibilites
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.peut_voir_toutes_dispos()
    or public.peut_retirer_disponibilite(user_id)
  );

drop policy if exists dispos_delete on public.disponibilites;
create policy dispos_delete on public.disponibilites
  for delete to authenticated
  using (public.peut_retirer_disponibilite(user_id));

-- Non réalisé ou annulé : l’équipage est libéré. Les disponibilités restent.
create or replace function public.trg_liberer_affectation_non_realise()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;
  if new.statut::text not in ('non_realise', 'annule') then
    return new;
  end if;
  if old.statut::text in ('non_realise', 'annule') then
    return new;
  end if;

  delete from public.souhait_personnel where souhait_id = new.id;

  new.mission := jsonb_set(
    coalesce(new.mission, '{}'::jsonb),
    '{attente}',
    coalesce(new.mission->'attente', '{}'::jsonb) || jsonb_build_object('equipage', true),
    true
  );
  return new;
end
$$;

delete from public.souhait_personnel sp
using public.souhaits s
where sp.souhait_id = s.id
  and s.statut::text = 'annule';

create or replace function public.personnel_disponible_souhait(p_souhait uuid)
returns table (
  user_id uuid,
  prenom text,
  nom text,
  role text,
  quals jsonb,
  dispo text,
  conflit boolean,
  jours_dispo date[],
  jours_conflit date[]
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  dates jsonb;
  d0 date;
  d1 date;
  njours int;
  rec record;
  n_dispo int;
  a_conflit boolean;
  jours_ok date[];
  jours_ko date[];
begin
  if p_souhait is null then return; end if;
  if not (public.peut_voir_souhaits() or public.peut_voir_toutes_dispos()) then
    return;
  end if;

  select s.dates_possibles, s.date_souhaitee, coalesce(s.date_fin, s.date_souhaitee)
    into dates, d0, d1
  from public.souhaits s where s.id = p_souhait;

  select count(*) into njours from public.jours_d_un_souhait(dates, d0, d1);

  for rec in
    select p.id, p.prenom, p.nom, p.role::text as role, coalesce(p.fiche, '{}'::jsonb) as fiche
    from public.profiles p
    where coalesce(p.actif, true) and p.role::text <> 'partenaire'
    order by p.nom, p.prenom
  loop
    jours_ok := '{}'::date[];
    jours_ko := '{}'::date[];
    n_dispo := 0;
    a_conflit := false;

    if njours > 0 then
      select coalesce(array_agg(j.j order by j.j), '{}'::date[]) into jours_ok
      from public.jours_d_un_souhait(dates, d0, d1) j
      where exists (
        select 1 from public.disponibilites dis
        where dis.user_id = rec.id
          and dis.date_debut <= j.j
          and dis.date_fin >= j.j
      );
      n_dispo := coalesce(array_length(jours_ok, 1), 0);

      select coalesce((
        select array_agg(x.j order by x.j)
        from (
          select distinct j1.j
          from public.souhait_personnel sp
          join public.souhaits s on s.id = sp.souhait_id
          join public.jours_d_un_souhait(s.dates_possibles, s.date_souhaitee, s.date_fin) j2 on true
          join public.jours_d_un_souhait(dates, d0, d1) j1 on j1.j = j2.j
          where sp.user_id = rec.id
            and s.id <> p_souhait
            and s.statut::text not in ('non_realise', 'annule')
        ) x
      ), '{}'::date[]) into jours_ko;
      a_conflit := coalesce(array_length(jours_ko, 1), 0) > 0;
    end if;

    return query select
      rec.id,
      rec.prenom,
      rec.nom,
      rec.role,
      to_jsonb(public.quals_d_un_profil(rec.role, rec.fiche)),
      case
        when njours = 0 then 'inconnu'
        when n_dispo >= njours then 'plein'
        when n_dispo > 0 then 'partiel'
        else 'non'
      end,
      coalesce(a_conflit, false),
      coalesce(jours_ok, '{}'::date[]),
      coalesce(jours_ko, '{}'::date[]);
  end loop;
end $$;

grant execute on function public.personnel_disponible_souhait(uuid) to authenticated;

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
  per record;
  cov record;
  requis text[];
  couverts text[];
  besoin_nm boolean;
  lieu text;
  act text;
  acts jsonb;
  ville text;
  brut jsonb;
begin
  if p_debut is null or p_fin is null then return '[]'::jsonb; end if;
  restreint := public.calendrier_non_med_restreint();

  for r in
    select s.id, s.date_souhaitee, s.date_fin, s.dates_possibles, s.courte_duree, s.heure_depart, s.heure_retour,
           s.localisation, s.description, s.statut, s.mission
    from public.souhaits s
    where s.statut::text not in ('non_realise', 'annule')
      and exists (
        select 1
        from public.periodes_d_un_souhait(s.dates_possibles, s.date_souhaitee, s.date_fin) p
        where p.fin >= p_debut and p.debut <= p_fin
      )
  loop
    requis := public.roles_requis_d_un_souhait(r.mission);
    besoin_nm := ('volontaire_non_medical' = any (requis))
              or ('secouriste' = any (requis))
              or coalesce((r.mission->>'besoin_non_medical') in ('true','t','1'), false);
    if restreint and not besoin_nm then
      continue;
    end if;

    lieu := nullif(btrim(coalesce(r.localisation, '')), '');
    act := left(btrim(coalesce(r.description, '')), 80);
    ville := nullif(btrim(coalesce(r.mission->'base_adresse'->>'localite', '')), '');
    brut := r.mission->'categories'->'activites';
    if jsonb_typeof(brut) = 'array' then
      select coalesce(jsonb_agg(to_jsonb(btrim(x))), '[]'::jsonb) into acts
      from jsonb_array_elements_text(brut) x
      where btrim(x) <> '';
    elsif jsonb_typeof(brut) = 'string' and btrim(brut #>> '{}') <> '' then
      acts := jsonb_build_array(btrim(brut #>> '{}'));
    else
      acts := '[]'::jsonb;
    end if;

    for per in
      select p.debut, p.fin
      from public.periodes_d_un_souhait(r.dates_possibles, r.date_souhaitee, r.date_fin) p
      where p.fin >= p_debut and p.debut <= p_fin
    loop
      select * into cov from public.couverture_d_un_souhait(r.id, per.debut, per.fin, r.mission);
      couverts := coalesce(cov.p_couverts, '{}'::text[]);
      requis := coalesce(cov.p_requis, requis);
      resultat := resultat || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
        'souhait_id', r.id,
        'date_debut', per.debut,
        'date_fin', per.fin,
        'courte_duree', coalesce(r.courte_duree, false),
        'heure_debut', r.heure_depart,
        'heure_fin', r.heure_retour,
        'rdv_base', r.mission->>'rdv_base',
        'lieu', lieu,
        'activite', nullif(act, ''),
        'activites', acts,
        'ville_base', ville,
        'besoin_non_medical', besoin_nm,
        'roles_requis', to_jsonb(requis),
        'roles_couverts', to_jsonb(coalesce(couverts, '{}'::text[])),
        'statut', r.statut::text
      )));
    end loop;
  end loop;

  return resultat;
end $$;

grant execute on function public.calendrier_missions(date, date) to authenticated;

notify pgrst, 'reload schema';
