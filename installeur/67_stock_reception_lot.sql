-- ════════════════════════════════════════════════════════════════════════════
--  Réception : plusieurs QR d’un coup (même lot / DLC).
--  Péremption : retirer toutes les unités d’un n° de lot.
--  Idempotent. Après 66_nom_souhaits_verrouilles.sql.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.stock_creer_unites(
  p_catalogue uuid,
  p_qte numeric,
  p_lot text default null,
  p_dlc date default null,
  p_lieu uuid default null,
  p_notes text default null,
  p_pression numeric default 200,
  p_nb int default 1
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  nb int;
  i int;
  r jsonb;
  acc jsonb := '[]'::jsonb;
begin
  if not public.peut_gerer_stock() then
    return json_build_object('ok', false, 'error', 'réservé à la logistique');
  end if;
  nb := greatest(1, least(coalesce(p_nb, 1), 80));
  for i in 1..nb loop
    r := public.stock_creer_unite(p_catalogue, p_qte, p_lot, p_dlc, p_lieu, p_notes, p_pression)::jsonb;
    if coalesce(r->>'ok', '') is distinct from 'true' then
      return r::json;
    end if;
    acc := acc || jsonb_build_array(r->'unite');
  end loop;
  return json_build_object(
    'ok', true,
    'nb', nb,
    'unites', acc,
    'unite', acc->0
  );
end $$;
grant execute on function public.stock_creer_unites(uuid, numeric, text, date, uuid, text, numeric, int) to authenticated;

create or replace function public.stock_marquer_perime_lot(
  p_catalogue uuid,
  p_lot text default null,
  p_motif text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  u record;
  r json;
  n int := 0;
  lot_txt text;
begin
  if not public.peut_gerer_stock() then
    return json_build_object('ok', false, 'error', 'réservé à la logistique');
  end if;
  if p_catalogue is null then
    return json_build_object('ok', false, 'error', 'article manquant');
  end if;
  lot_txt := nullif(btrim(coalesce(p_lot, '')), '');
  for u in
    select id from public.stock_unites
    where catalogue_id = p_catalogue
      and etat = 'dispo'
      and nullif(btrim(coalesce(lot, '')), '') is not distinct from lot_txt
  loop
    r := public.stock_marquer_perime(u.id, coalesce(nullif(btrim(p_motif), ''), 'périmé — lot retiré'));
    if coalesce(r->>'ok', '') = 'true' then
      n := n + 1;
    end if;
  end loop;
  if n = 0 then
    return json_build_object('ok', false, 'error', 'aucune unité disponible pour ce lot');
  end if;
  return json_build_object('ok', true, 'nb', n);
end $$;
grant execute on function public.stock_marquer_perime_lot(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';
