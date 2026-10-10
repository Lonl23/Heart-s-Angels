-- ════════════════════════════════════════════════════════════════════════════
--  Sur place Base = statut personnel. Le parcours vecteur commence au départ.
--  Idempotent. Après 24_parcours_statuts.sql.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.normaliser_etape_terrain(p_etape text)
returns text language sql immutable as $$
  select case coalesce(p_etape, '')
    when 'vehicule'       then 'a_la_base'
    when 'base_sur_place' then 'a_la_base'
    when ''               then 'a_la_base'
    when 'pec'            then 'pec_sur_place'
    when 'retour_pec'     then 'dest_sur_place'
    when 'retour_base'    then 'depart_base'
    when 'base_depart'    then 'depart_pec'
    when 'pec_route'      then 'depart_pec'
    when 'pec_depart'     then 'depart_dest'
    when 'dest_route'     then 'depart_dest'
    when 'dest_depart'    then 'depart_retour'
    when 'retour_route'   then 'depart_retour'
    else p_etape
  end
$$;

create or replace function public.etape_terrain_ok(p_etape text)
returns boolean language sql immutable as $$
  select public.normaliser_etape_terrain(p_etape) in (
    'a_la_base',
    'depart_pec', 'pec_sur_place',
    'depart_dest', 'dest_sur_place',
    'depart_retour', 'retour_sur_place',
    'depart_base', 'base_rentre'
  )
$$;

grant execute on function public.normaliser_etape_terrain(text) to authenticated;
grant execute on function public.etape_terrain_ok(text) to authenticated;

notify pgrst, 'reload schema';
