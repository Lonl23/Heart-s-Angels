-- ════════════════════════════════════════════════════════════════════════════
--  Étape par vecteur : ne jamais reprendre etape_terrain (souvent l’étape
--  d’un autre véhicule). Idempotent. Après 41_lock_terrain_mission.sql.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.etape_du_vecteur(m jsonb, p_vid text)
returns text language sql immutable as $$
  select case
    when nullif(p_vid, '') is not null then
      coalesce(nullif(m #>> array['vecteur_etapes', p_vid], ''), 'a_la_base')
    else coalesce(nullif(m->>'etape_terrain', ''), 'a_la_base')
  end;
$$;

drop function if exists public.mes_affectations();
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
  medecin_nom text
)
language sql stable security definer set search_path = public as $$
  select
    s.id,
    s.beneficiaire_prenom,
    s.date_souhaitee,
    s.date_fin,
    coalesce(s.dates_possibles, '[]'::jsonb),
    s.statut::text,
    coalesce(
      nullif(sp.vehicule, ''),
      (
        select e->>'nom'
        from jsonb_array_elements(coalesce(s.mission->'vecteurs', '[]'::jsonb)) e
        where e->>'id' = sp.vecteur_id
        limit 1
      )
    ),
    sp.role_mission,
    s.description,
    coalesce(
      s.mission->'dest_adresse'->>'localite',
      s.mission->'pec_adresse'->>'localite',
      s.localisation
    ),
    coalesce(sp.statut_base, s.mission->'personnel_statuts'->>sp.user_id::text),
    public.etape_du_vecteur(s.mission, sp.vecteur_id),
    public.coordonnees_appel(s.id)->>'tel',
    public.coordonnees_appel(s.id)->>'libelle',
    coalesce(s.origine, 'prive'),
    case when public.session_profil_est_medical(sp.role_mission)
         then public.medecin_equipe_pluri(s.mission)->>'tel' end,
    case when public.session_profil_est_medical(sp.role_mission)
         then public.medecin_equipe_pluri(s.mission)->>'nom' end
  from public.souhait_personnel sp
  join public.souhaits s on s.id = sp.souhait_id
  where sp.user_id = auth.uid()
  order by
    case s.statut::text
      when 'en_cours' then 0
      when 'pret' then 1
      when 'en_attente' then 2
      when 'nouveau' then 3
      else 4
    end,
    s.date_souhaitee nulls last
$$;

grant execute on function public.etape_du_vecteur(jsonb, text) to authenticated;
grant execute on function public.mes_affectations() to authenticated;

notify pgrst, 'reload schema';
