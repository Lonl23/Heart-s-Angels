-- ════════════════════════════════════════════════════════════════════════════
--  Équipage requis par vecteur (pas une fois pour tout le souhait).
--  Deux véhicules infi+ambu = deux infi + deux ambu. Un infi+ambu n’occupe
--  qu’un côté, sur ce vecteur. Repli : vecteur.roles_requis → mission.roles_requis
--  → ambulancier+infirmier. Idempotent. Après 19_calendrier_rdv_base.sql.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.roles_effectifs(p_requis text[])
returns text[] language sql immutable as $$
  select case when p_requis is null or p_requis = '{}'::text[]
    then array['ambulancier', 'infirmier']::text[]
    else p_requis
  end;
$$;

create or replace function public.array_remove_once(arr text[], elem text)
returns text[] language sql immutable as $$
  select coalesce((
    select array_agg(x order by n)
    from (
      select x, n,
             sum(case when x = elem then 1 else 0 end) over (order by n) as seen
      from unnest(arr) with ordinality as t(x, n)
    ) s
    where not (x = elem and seen = 1)
  ), '{}'::text[]);
$$;

-- Concaténation des rôles de chaque vecteur (doublons conservés).
create or replace function public.roles_requis_d_un_souhait(p_mission jsonb)
returns text[] language plpgsql immutable set search_path = public as $$
declare
  vecteurs jsonb;
  v jsonb;
  requis text[] := '{}';
  vr text[];
  fallback text[] := '{}';
begin
  select coalesce(array_agg(x), '{}'::text[]) into fallback
    from jsonb_array_elements_text(
      case when jsonb_typeof(coalesce(p_mission, '{}'::jsonb)->'roles_requis') = 'array'
           then p_mission->'roles_requis' else '[]'::jsonb end
    ) as t(x);

  vecteurs := case when jsonb_typeof(coalesce(p_mission, '{}'::jsonb)->'vecteurs') = 'array'
                   then p_mission->'vecteurs' else '[]'::jsonb end;

  if jsonb_array_length(vecteurs) > 0 then
    for v in select value from jsonb_array_elements(vecteurs)
    loop
      if v ? 'roles_requis' and jsonb_typeof(v->'roles_requis') = 'array' then
        select coalesce(array_agg(x), '{}'::text[]) into vr
          from jsonb_array_elements_text(v->'roles_requis') as t(x);
      else
        vr := fallback;
      end if;
      requis := requis || public.roles_effectifs(vr);
    end loop;
  else
    requis := public.roles_effectifs(fallback);
  end if;
  return requis;
end $$;

-- Couverture présence-par-rôle (un vecteur = au plus une occurrence de chaque rôle).
create or replace function public.roles_couverts_par_personnes(p_requis text[], p_user_ids uuid[])
returns text[] language plpgsql stable security definer set search_path = public as $$
declare
  n_infi int := 0;
  n_ambu int := 0;
  n_dual int := 0;
  couverts text[] := '{}';
  rec record;
  qs text[];
  q text;
  has_infi boolean;
  has_ambu boolean;
  requis text[];
begin
  requis := public.roles_effectifs(p_requis);
  if p_user_ids is null or p_user_ids = '{}'::uuid[] then
    return '{}'::text[];
  end if;

  for rec in
    select p.role::text as role, coalesce(p.fiche, '{}'::jsonb) as fiche
    from public.profiles p
    where p.id = any (p_user_ids)
  loop
    qs := public.quals_d_un_profil(rec.role, rec.fiche);
    has_infi := 'infirmier' = any (qs);
    has_ambu := 'ambulancier' = any (qs);
    if has_infi and has_ambu then
      n_dual := n_dual + 1;
    elsif has_infi then
      n_infi := n_infi + 1;
    elsif has_ambu then
      n_ambu := n_ambu + 1;
    end if;
    foreach q in array qs loop
      if q = any (requis) and q not in ('infirmier','ambulancier') and not (q = any (couverts)) then
        couverts := couverts || array[q];
      end if;
    end loop;
  end loop;

  for i in 1..n_dual loop
    if 'infirmier' = any (requis) and 'ambulancier' = any (requis) then
      if n_infi <= n_ambu then n_infi := n_infi + 1; else n_ambu := n_ambu + 1; end if;
    elsif 'infirmier' = any (requis) then n_infi := n_infi + 1;
    elsif 'ambulancier' = any (requis) then n_ambu := n_ambu + 1;
    end if;
  end loop;

  if 'infirmier' = any (requis) and n_infi > 0 then couverts := couverts || array['infirmier']; end if;
  if 'ambulancier' = any (requis) and n_ambu > 0 then couverts := couverts || array['ambulancier']; end if;
  return couverts;
end $$;

create or replace function public.role_suggere_restant(p_quals text[], p_remaining text[])
returns text language plpgsql immutable set search_path = public as $$
declare
  dual boolean;
  need_i boolean;
  need_a boolean;
  n_infi int;
  n_ambu int;
  r text;
begin
  if p_remaining is null or p_remaining = '{}'::text[] then return null; end if;
  dual := 'ambulancier' = any (p_quals) and 'infirmier' = any (p_quals);
  need_i := 'infirmier' = any (p_remaining);
  need_a := 'ambulancier' = any (p_remaining);
  select count(*) filter (where x = 'infirmier') into n_infi from unnest(p_remaining) x;
  select count(*) filter (where x = 'ambulancier') into n_ambu from unnest(p_remaining) x;
  if dual and need_i and need_a then
    if n_infi >= n_ambu then return 'infirmier'; else return 'ambulancier'; end if;
  end if;
  if dual and need_i then return 'infirmier'; end if;
  if dual and need_a then return 'ambulancier'; end if;
  foreach r in array p_remaining loop
    if r = any (p_quals) then return r; end if;
  end loop;
  return null;
end $$;

create or replace function public.couverture_d_un_souhait(
  p_souhait uuid, p_debut date, p_fin date, p_mission jsonb,
  out p_requis text[], out p_couverts text[]
)
language plpgsql stable security definer set search_path = public as $$
declare
  vecteurs jsonb;
  v jsonb;
  vid text;
  vr text[];
  fallback text[] := '{}';
  assigned uuid[];
  used uuid[] := '{}';
  covered_v text[];
  remaining text[];
  rec record;
  qs text[];
  role_fill text;
begin
  p_requis := '{}';
  p_couverts := '{}';

  select coalesce(array_agg(x), '{}'::text[]) into fallback
    from jsonb_array_elements_text(
      case when jsonb_typeof(coalesce(p_mission, '{}'::jsonb)->'roles_requis') = 'array'
           then p_mission->'roles_requis' else '[]'::jsonb end
    ) as t(x);

  vecteurs := case when jsonb_typeof(coalesce(p_mission, '{}'::jsonb)->'vecteurs') = 'array'
                   then p_mission->'vecteurs' else '[]'::jsonb end;

  if jsonb_array_length(vecteurs) is null or jsonb_array_length(vecteurs) = 0 then
    p_requis := public.roles_effectifs(fallback);
    select coalesce(array_agg(user_id), '{}'::uuid[]) into assigned
      from public.souhait_personnel where souhait_id = p_souhait;
    used := assigned;
    p_couverts := public.roles_couverts_par_personnes(p_requis, assigned);
  else
    for v in select value from jsonb_array_elements(vecteurs)
    loop
      vid := v->>'id';
      if v ? 'roles_requis' and jsonb_typeof(v->'roles_requis') = 'array' then
        select coalesce(array_agg(x), '{}'::text[]) into vr
          from jsonb_array_elements_text(v->'roles_requis') as t(x);
      else
        vr := fallback;
      end if;
      vr := public.roles_effectifs(vr);
      p_requis := p_requis || vr;

      select coalesce(array_agg(user_id), '{}'::uuid[]) into assigned
        from public.souhait_personnel
        where souhait_id = p_souhait and vecteur_id is not distinct from vid;
      used := used || assigned;
      covered_v := public.roles_couverts_par_personnes(vr, assigned);
      -- covered_v est un sous-ensemble unique de vr : on le recolle dans l’ordre de vr
      foreach role_fill in array vr loop
        if role_fill = any (covered_v) then
          p_couverts := p_couverts || array[role_fill];
          covered_v := public.array_remove_once(covered_v, role_fill);
        end if;
      end loop;
    end loop;
  end if;

  remaining := p_requis;
  foreach role_fill in array p_couverts loop
    remaining := public.array_remove_once(remaining, role_fill);
  end loop;

  if remaining <> '{}'::text[] then
    for rec in
      select p.id, p.role::text as role, coalesce(p.fiche, '{}'::jsonb) as fiche
      from public.profiles p
      where not (p.id = any (used))
        and (
          exists (
            select 1 from public.souhait_personnel sp
            where sp.souhait_id = p_souhait and sp.user_id = p.id
              and coalesce(sp.vecteur_id, '') = ''
          )
          or exists (
            select 1 from public.disponibilites d
            where d.user_id = p.id and p_debut is not null
              and d.date_debut <= p_fin and d.date_fin >= p_debut
          )
        )
    loop
      exit when remaining = '{}'::text[];
      qs := public.quals_d_un_profil(rec.role, rec.fiche);
      role_fill := public.role_suggere_restant(qs, remaining);
      if role_fill is not null then
        remaining := public.array_remove_once(remaining, role_fill);
        p_couverts := p_couverts || array[role_fill];
        used := used || rec.id;
      end if;
    end loop;
  end if;
end $$;

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
  cov record;
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
    select * into cov from public.couverture_d_un_souhait(r.id, d0, d1, r.mission);
    requis := coalesce(cov.p_requis, public.roles_requis_d_un_souhait(r.mission));
    couverts := coalesce(cov.p_couverts, '{}'::text[]);
    besoin_nm := ('volontaire_non_medical' = any (requis))
              or ('secouriste' = any (requis))
              or coalesce((r.mission->>'besoin_non_medical') in ('true','t','1'), false);
    if restreint and not besoin_nm then
      continue;
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
      'rdv_base', r.mission->>'rdv_base',
      'lieu', lieu,
      'activite', nullif(act, ''),
      'besoin_non_medical', besoin_nm,
      'roles_requis', to_jsonb(requis),
      'roles_couverts', to_jsonb(coalesce(couverts, '{}'::text[])),
      'statut', r.statut::text
    )));
  end loop;

  return resultat;
end $$;

grant execute on function public.roles_effectifs(text[]) to authenticated;
grant execute on function public.array_remove_once(text[], text) to authenticated;
grant execute on function public.roles_requis_d_un_souhait(jsonb) to authenticated;
grant execute on function public.roles_couverts_par_personnes(text[], uuid[]) to authenticated;
grant execute on function public.role_suggere_restant(text[], text[]) to authenticated;
grant execute on function public.couverture_d_un_souhait(uuid, date, date, jsonb) to authenticated;
grant execute on function public.calendrier_missions(date, date) to authenticated;

notify pgrst, 'reload schema';
