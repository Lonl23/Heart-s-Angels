-- QR optionnel par type d’article.
-- true  = 1 QR par pièce / boîte / bouteille (impression à domicile)
-- false = suivi quantité / lot sans étiquette QR

alter table public.stock_catalogue
  add column if not exists gestion_qr boolean not null default true;

comment on column public.stock_catalogue.gestion_qr is
  'Si vrai : 1 QR par unité physique. Si faux : stock sans étiquette (quantité / lot).';

-- O₂ et durable : QR utile par défaut. Consommables en boîte aussi.
-- L’utilisateur peut décocher dans Gestion articles.

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
  elsif c.mode = 'oxygene' then
    n := 1;
  elsif coalesce(c.gestion_qr, true) then
    -- 1 QR = 1 pièce
    n := 1;
  else
    -- Sans QR : une ligne de stock avec la quantité saisie
    n := coalesce(nullif(p_qte, 0), 1);
    if n <= 0 then
      return json_build_object('ok', false, 'error', 'indiquez la quantité');
    end if;
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

  return json_build_object('ok', true, 'unite', row_to_json(u));
end $$;

notify pgrst, 'reload schema';
