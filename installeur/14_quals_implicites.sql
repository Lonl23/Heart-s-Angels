-- ════════════════════════════════════════════════════════════════════════════
--  Qualifications implicites (fiche) : pas de saisie sur la disponibilité.
--  Ambulancier → chauffeur si permis + sélection médicale.
--  Infi + ambulancier : le rôle au calendrier suit le besoin (côté le moins
--  déjà couvert par les autres disponibilités / l'équipage).
--  Idempotent. Après 13_dispos_equipe.sql.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.disponibilites alter column qualification drop not null;
alter table public.disponibilites alter column qualification set default '';

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

  if 'ambulancier' = any (qs) and a_permis and a_select then
    qs := qs || array['chauffeur'];
  end if;

  select coalesce(array_agg(distinct x), '{}'::text[]) into qs
    from unnest(qs) as x
    where x is not null and x <> '';
  return qs;
end $$;

-- Couverture : personnes dispo sur la période + déjà affectées.
-- Un infi+ambu va du côté (infi vs ambu) qui a le moins de monde.
create or replace function public.roles_couverts_periode(p_souhait uuid, p_debut date, p_fin date, p_requis text[])
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
begin
  -- Rien de coché = équipage par défaut. Chauffeur seul coché : on ne rajoute pas le défaut.
  if p_requis is null or p_requis = '{}'::text[] then
    p_requis := array['ambulancier', 'infirmier'];
  end if;

  for rec in
    select p.role::text as role, coalesce(p.fiche, '{}'::jsonb) as fiche
    from (
      select user_id from public.souhait_personnel where souhait_id = p_souhait
      union
      select user_id from public.disponibilites
        where date_debut <= p_fin and date_fin >= p_debut
    ) u
    join public.profiles p on p.id = u.user_id
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
      if q = any (p_requis) and q not in ('infirmier','ambulancier') and not (q = any (couverts)) then
        couverts := couverts || array[q];
      end if;
    end loop;
  end loop;

  for i in 1..n_dual loop
    if 'infirmier' = any (p_requis) and 'ambulancier' = any (p_requis) then
      if n_infi <= n_ambu then n_infi := n_infi + 1; else n_ambu := n_ambu + 1; end if;
    elsif 'infirmier' = any (p_requis) then n_infi := n_infi + 1;
    elsif 'ambulancier' = any (p_requis) then n_ambu := n_ambu + 1;
    end if;
  end loop;

  if 'infirmier' = any (p_requis) and n_infi > 0 then couverts := couverts || array['infirmier']; end if;
  if 'ambulancier' = any (p_requis) and n_ambu > 0 then couverts := couverts || array['ambulancier']; end if;
  return couverts;
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
      from jsonb_array_elements_text(
        case when jsonb_typeof(r.mission->'roles_requis') = 'array' then r.mission->'roles_requis' else '[]'::jsonb end
      ) as t(x);
    if requis is null or requis = '{}'::text[] then
      requis := array['ambulancier', 'infirmier'];
    end if;
    besoin_nm := ('volontaire_non_medical' = any (requis))
              or ('secouriste' = any (requis))
              or coalesce((r.mission->>'besoin_non_medical') in ('true','t','1'), false);
    if restreint and not besoin_nm then
      continue;
    end if;

    couverts := public.roles_couverts_periode(r.id, d0, d1, requis);

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

grant execute on function public.quals_d_un_profil(text, jsonb) to authenticated;
grant execute on function public.roles_couverts_periode(uuid, date, date, text[]) to authenticated;
grant execute on function public.calendrier_missions(date, date) to authenticated;

notify pgrst, 'reload schema';
