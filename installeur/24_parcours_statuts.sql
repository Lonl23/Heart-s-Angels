-- ════════════════════════════════════════════════════════════════════════════
--  Statuts terrain : 9 étapes (sur place / départ vers le lieu suivant).
--  Idempotent. Après 23_parcours_terrain.sql.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.normaliser_etape_terrain(p_etape text)
returns text language sql immutable as $$
  select case coalesce(p_etape, '')
    when 'vehicule'     then 'base_sur_place'
    when 'pec'          then 'pec_sur_place'
    when 'retour_pec'   then 'dest_sur_place'
    when 'retour_base'  then 'depart_base'
    when 'base_depart'  then 'depart_pec'
    when 'pec_route'    then 'depart_pec'
    when 'pec_depart'   then 'depart_dest'
    when 'dest_route'   then 'depart_dest'
    when 'dest_depart'  then 'depart_retour'
    when 'retour_route' then 'depart_retour'
    when ''             then 'base_sur_place'
    else p_etape
  end
$$;

create or replace function public.etape_terrain_ok(p_etape text)
returns boolean language sql immutable as $$
  select public.normaliser_etape_terrain(p_etape) in (
    'base_sur_place', 'depart_pec',
    'pec_sur_place', 'depart_dest',
    'dest_sur_place', 'depart_retour',
    'retour_sur_place', 'depart_base',
    'base_rentre'
  )
$$;

grant execute on function public.normaliser_etape_terrain(text) to authenticated;
grant execute on function public.etape_terrain_ok(text) to authenticated;

notify pgrst, 'reload schema';
