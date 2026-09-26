-- ════════════════════════════════════════════════════════════════════════════
--  Stock par lots : agrégation (article, n° de lot, DLC, qté, emplacements)
--  et DLC liée au lot à la réception (même lot = même péremption).
--  Idempotent. Après 27_stock_excel.sql / 28_annuaire_beneficiaires.sql.
-- ════════════════════════════════════════════════════════════════════════════

create index if not exists stock_unites_cat_lot_idx
  on public.stock_unites (catalogue_id, lower(btrim(lot)))
  where lot is not null and btrim(lot) <> '';

-- Chemin lisible d’un emplacement (Réserve › Armoire A › Étagère 2)
create or replace function public.stock_lieu_chemin(p_id uuid)
returns text
language sql
stable
set search_path = public
as $$
  with recursive t as (
    select l.id, l.parent_id, l.nom, 1 as depth
    from public.stock_lieux l
    where l.id = p_id
    union all
    select p.id, p.parent_id, p.nom, t.depth + 1
    from public.stock_lieux p
    join t on t.parent_id = p.id
    where t.depth < 12
  )
  select string_agg(t.nom, ' › ' order by t.depth desc)
  from t;
$$;
revoke all on function public.stock_lieu_chemin(uuid) from public;
grant execute on function public.stock_lieu_chemin(uuid) to authenticated;

-- Lots agrégés : article, lot, DLC, quantité restante, où c’est rangé
create or replace function public.stock_lots()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  items json;
begin
  if not public.peut_gerer_stock() then
    return json_build_object('ok', false, 'error', 'réservé à la logistique');
  end if;

  with dispo as (
    select
      u.catalogue_id,
      u.lieu_id,
      u.qte_restante,
      u.date_peremption,
      nullif(btrim(u.lot), '') as lot
    from public.stock_unites u
    where u.etat = 'dispo'
  ),
  lots as (
    select
      d.catalogue_id,
      d.lot,
      min(d.date_peremption) as dlc,
      (count(distinct d.date_peremption) filter (where d.date_peremption is not null) > 1) as dlc_incoherente,
      coalesce(
        json_agg(distinct d.date_peremption) filter (where d.date_peremption is not null),
        '[]'::json
      ) as dlcs,
      coalesce(sum(d.qte_restante), 0) as qte_totale,
      count(*)::int as nb_unites
    from dispo d
    group by d.catalogue_id, d.lot
  ),
  lieux_lot as (
    select
      d.catalogue_id,
      d.lot,
      d.lieu_id,
      coalesce(sum(d.qte_restante), 0) as qte
    from dispo d
    group by d.catalogue_id, d.lot, d.lieu_id
  )
  select coalesce(json_agg(json_build_object(
      'catalogue_id', l.catalogue_id,
      'article', c.nom,
      'mode', c.mode,
      'unite', c.unite,
      'photo_path', c.photo_path,
      'lot', l.lot,
      'dlc', l.dlc,
      'dlc_incoherente', l.dlc_incoherente,
      'dlcs', l.dlcs,
      'qte_totale', l.qte_totale,
      'nb_unites', l.nb_unites,
      'lieux', coalesce((
        select json_agg(json_build_object(
          'lieu_id', x.lieu_id,
          'nom', coalesce(sl.nom, 'sans lieu'),
          'chemin', coalesce(public.stock_lieu_chemin(x.lieu_id), 'sans lieu'),
          'qte', x.qte
        ) order by coalesce(public.stock_lieu_chemin(x.lieu_id), 'sans lieu'))
        from lieux_lot x
        left join public.stock_lieux sl on sl.id = x.lieu_id
        where x.catalogue_id = l.catalogue_id
          and x.lot is not distinct from l.lot
      ), '[]'::json)
    ) order by c.nom, l.lot nulls last), '[]'::json)
    into items
  from lots l
  join public.stock_catalogue c on c.id = l.catalogue_id;

  return json_build_object('ok', true, 'lots', items);
end $$;
grant execute on function public.stock_lots() to authenticated;

-- Réception : si le n° de lot existe déjà pour cet article, on reprend sa DLC
create or replace function public.stock_creer_unite(
  p_catalogue uuid,
  p_qte numeric,
  p_lot text default null,
  p_dlc date default null,
  p_lieu uuid default null,
  p_notes text default null,
  p_pression numeric default 200
)
returns json language plpgsql security definer set search_path = public as $$
declare
  c public.stock_catalogue;
  n numeric;
  u public.stock_unites;
  l public.stock_lieux;
  vol numeric;
  pres numeric;
  lot_txt text;
  dlc date;
  known_dlcs date[];
begin
  if not public.peut_gerer_stock() then
    return json_build_object('ok', false, 'error', 'réservé à la logistique');
  end if;
  select * into c from public.stock_catalogue where id = p_catalogue and actif;
  if not found then return json_build_object('ok', false, 'error', 'type inconnu'); end if;
  if c.mode = 'boite' then
    n := coalesce(nullif(p_qte, 0), c.qte_defaut);
    if n is null or n <= 0 then
      return json_build_object('ok', false, 'error', 'indiquez combien il y a dans la boîte');
    end if;
  else
    n := 1;
  end if;
  vol := case when c.mode = 'oxygene' then c.volume_l else null end;
  if c.mode = 'oxygene' and (vol is null or vol <= 0) then
    return json_build_object('ok', false, 'error', 'volume de la bouteille manquant (2, 5 ou 10 L)');
  end if;
  pres := case when c.mode = 'oxygene' then coalesce(nullif(p_pression, 0), 200) else null end;

  lot_txt := nullif(btrim(coalesce(p_lot, '')), '');
  dlc := p_dlc;
  if lot_txt is not null then
    select array_agg(distinct x.date_peremption order by x.date_peremption)
      into known_dlcs
    from public.stock_unites x
    where x.catalogue_id = c.id
      and lower(btrim(x.lot)) = lower(lot_txt)
      and x.date_peremption is not null;
    if known_dlcs is not null and array_length(known_dlcs, 1) = 1 then
      if dlc is null then
        dlc := known_dlcs[1];
      elsif dlc is distinct from known_dlcs[1] then
        return json_build_object(
          'ok', false,
          'error', 'ce lot a déjà la DLC ' || to_char(known_dlcs[1], 'DD/MM/YYYY')
            || ' — même lot = même péremption',
          'dlc_connue', known_dlcs[1]
        );
      end if;
    elsif known_dlcs is not null and array_length(known_dlcs, 1) > 1 then
      if dlc is null then
        dlc := known_dlcs[1];
      elsif not (dlc = any (known_dlcs)) then
        return json_build_object(
          'ok', false,
          'error', 'ce lot a déjà des DLC différentes ('
            || array_to_string(known_dlcs, ', ')
            || '). Utilisez l’une d’elles.',
          'dlc_connues', to_json(known_dlcs)
        );
      end if;
    end if;
  end if;

  insert into public.stock_unites(
    catalogue_id, lot, date_peremption, qte_initiale, qte_restante, lieu_id, notes,
    volume_l, pression_bar, pression_pleine
  )
    values (c.id, lot_txt, dlc, n, n, p_lieu, p_notes, vol, pres, coalesce(pres, 200))
    returning * into u;

  if lot_txt is not null and dlc is not null then
    update public.stock_unites
      set date_peremption = dlc
      where catalogue_id = c.id
        and lower(btrim(lot)) = lower(lot_txt)
        and date_peremption is null;
  end if;

  insert into public.stock_mouvements(type, quantite, motif, par, unite_id, lieu_id, catalogue_id)
    values ('entree', coalesce(pres, n), case when c.mode = 'oxygene' then 'réception bouteille' else 'réception' end, auth.uid(), u.id, p_lieu, c.id);
  select * into l from public.stock_lieux where id = u.lieu_id;
  return json_build_object('ok', true, 'unite', public._stock_unite_json(u, c, l));
end $$;
grant execute on function public.stock_creer_unite(uuid, numeric, text, date, uuid, text, numeric) to authenticated;

notify pgrst, 'reload schema';
