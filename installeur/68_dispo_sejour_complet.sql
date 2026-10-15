-- ════════════════════════════════════════════════════════════════════════════
--  Un séjour de plusieurs jours : une disponibilité ne compte que si elle
--  couvre CHAQUE jour. Même équipage tout le séjour.
--  Idempotent. Après 67_stock_reception_lot.sql.
-- ════════════════════════════════════════════════════════════════════════════

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
  njours int;
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

  njours := case
    when p_debut is null then 0
    else (coalesce(p_fin, p_debut) - p_debut) + 1
  end;

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
          or (
            njours > 0
            and (
              select count(*)
              from generate_series(p_debut, coalesce(p_fin, p_debut), interval '1 day') gs
              where exists (
                select 1 from public.disponibilites d
                where d.user_id = p.id
                  and d.date_debut <= gs::date
                  and d.date_fin >= gs::date
              )
            ) = njours
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

grant execute on function public.couverture_d_un_souhait(uuid, date, date, jsonb) to authenticated;

-- Couverture par période (un séjour de 3 jours ≠ deux dates alternatives).
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
begin
  if p_debut is null or p_fin is null then return '[]'::jsonb; end if;
  restreint := public.calendrier_non_med_restreint();

  for r in
    select s.id, s.date_souhaitee, s.date_fin, s.dates_possibles, s.courte_duree, s.heure_depart, s.heure_retour,
           s.localisation, s.description, s.statut, s.mission
    from public.souhaits s
    where s.statut::text <> 'non_realise'
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
