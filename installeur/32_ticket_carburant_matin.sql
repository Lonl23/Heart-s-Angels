-- Ticket carburant du matin (plein si le véhicule n’est pas à 100 % à la prise).
-- Distinct du ticket du soir (retour base). Sert au remboursement auprès du prêteur.

create or replace function public.sauver_photo_terrain(
  p_souhait uuid, p_vecteur text, p_slot text, p_meta jsonb, p_action text default 'set'
)
returns json language plpgsql security definer set search_path = public as $$
declare
  m jsonb;
  coins text[] := array['avant','arriere','gauche','droit','avant_gauche','avant_droit','arriere_gauche','arriere_droit'];
  extras text[] := array['pec','retour_pec','retour_base','ticket_carburant','ticket_carburant_matin'];
  arr jsonb;
  i int;
  found boolean := false;
  coin_key text;
begin
  if not public.suis_affecte(p_souhait) then
    return json_build_object('ok', false, 'error', 'non affecté');
  end if;
  if p_vecteur is null or p_vecteur = '' then
    return json_build_object('ok', false, 'error', 'vecteur requis');
  end if;
  if not (p_slot = any(coins) or p_slot = any(extras) or p_slot like 'r\_%' escape '\') then
    return json_build_object('ok', false, 'error', 'slot interdit');
  end if;
  select coalesce(mission, '{}'::jsonb) into m from public.souhaits where id = p_souhait;

  if p_slot = any(coins) then
    m := public._jsonb_set_path(m, array['terrain_photos', p_vecteur, 'coins', p_slot], coalesce(p_meta, 'null'::jsonb));
  elsif p_slot in ('ticket_carburant', 'ticket_carburant_matin') then
    m := public._jsonb_set_path(m, array['terrain_photos', p_vecteur, p_slot], coalesce(p_meta, 'null'::jsonb));
  elsif p_slot like 'r\_%' escape '\' then
    coin_key := substr(p_slot, 3);
    if coin_key = any(coins) then
      m := public._jsonb_set_path(m, array['terrain_photos', p_vecteur, 'coins_retour', coin_key], coalesce(p_meta, 'null'::jsonb));
    else
      return json_build_object('ok', false, 'error', 'slot interdit');
    end if;
  else
    arr := coalesce(m->'terrain_photos'->p_vecteur->p_slot, '[]'::jsonb);
    if jsonb_typeof(arr) <> 'array' then arr := '[]'::jsonb; end if;
    if p_action = 'add' then
      arr := arr || jsonb_build_array(p_meta);
    elsif p_action = 'delete' then
      arr := coalesce((
        select jsonb_agg(x) from jsonb_array_elements(arr) x
        where x->>'id' is distinct from p_meta->>'id'
      ), '[]'::jsonb);
    else
      for i in 0 .. jsonb_array_length(arr) - 1 loop
        if (arr -> i) ->> 'id' = p_meta->>'id' then
          arr := jsonb_set(arr, array[i::text], p_meta, false);
          found := true;
        end if;
      end loop;
      if not found then arr := arr || jsonb_build_array(p_meta); end if;
    end if;
    m := public._jsonb_set_path(m, array['terrain_photos', p_vecteur, p_slot], arr);
  end if;

  update public.souhaits set mission = m where id = p_souhait;
  return json_build_object('ok', true);
end $$;

grant execute on function public.sauver_photo_terrain(uuid, text, text, jsonb, text) to authenticated;

notify pgrst, 'reload schema';
