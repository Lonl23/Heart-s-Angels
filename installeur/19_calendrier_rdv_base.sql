-- RDV base affiché sur le calendrier (heure → fin de journée).
-- Idempotent. Après 14_quals_implicites.sql.

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

grant execute on function public.calendrier_missions(date, date) to authenticated;

notify pgrst, 'reload schema';
