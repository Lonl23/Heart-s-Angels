-- Les statistiques comptent tous les souhaits, quel que soit le statut.
-- La formation fictive reste hors du décompte.

create or replace function public.stats_souhaits()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.peut_gerer_app() then
    return jsonb_build_object('ok', false, 'error', 'réservé à la présidence et à l’informatique');
  end if;
  return jsonb_build_object(
    'ok', true,
    'lignes', coalesce((
      select jsonb_agg(to_jsonb(t))
      from (
        select
          s.id,
          s.statut::text as statut,
          coalesce(
            s.date_realisee,
            s.date_souhaitee,
            (s.created_at at time zone 'Europe/Brussels')::date
          ) as jour,
          nullif(trim(both ' ' from coalesce(s.beneficiaire_prenom, '') || ' ' || coalesce(s.beneficiaire_nom, '')), '') as beneficiaire,
          coalesce(
            nullif(s.mission->'dest_adresse'->>'localite', ''),
            nullif(s.mission->'pec_adresse'->>'localite', ''),
            nullif(s.localisation, ''),
            ''
          ) as lieu,
          coalesce(s.mission->'categories'->'activites', '[]'::jsonb) as activites,
          coalesce(s.mission->'categories'->'pathologies', '[]'::jsonb) as pathologies,
          coalesce(s.beneficiaire_genre, '') as genre,
          coalesce(nullif(s.mission->>'pec_institution', ''), '') as institution,
          coalesce(nullif(s.mission->>'pec_service', ''), '') as service,
          s.beneficiaire_ddn as ddn,
          (
            select coalesce(sum(
              case
                when (v->>'kms_retour') ~ '^[0-9]+([.,][0-9]+)?$'
                 and (v->>'kms_depart') ~ '^[0-9]+([.,][0-9]+)?$'
                 and replace(v->>'kms_retour', ',', '.')::numeric >= replace(v->>'kms_depart', ',', '.')::numeric
                then replace(v->>'kms_retour', ',', '.')::numeric - replace(v->>'kms_depart', ',', '.')::numeric
                else 0
              end
            ), 0)
            from jsonb_array_elements(coalesce(s.mission->'vecteurs', '[]'::jsonb)) v
          ) as km,
          coalesce((
            select jsonb_agg(jsonb_build_object(
              'id', sp.user_id,
              'nom', trim(both ' ' from coalesce(p.prenom, '') || ' ' || coalesce(p.nom, ''))
            ))
            from public.souhait_personnel sp
            join public.profiles p on p.id = sp.user_id
            where sp.souhait_id = s.id
          ), '[]'::jsonb) as volontaires
        from public.souhaits s
        where coalesce(s.fictif, false) = false
      ) t
    ), '[]'::jsonb)
  );
end
$$;

grant execute on function public.stats_souhaits() to authenticated;

notify pgrst, 'reload schema';
