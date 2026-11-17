-- Traçabilité par type d’article : lot et/ou DLC optionnels.
-- Certains articles n’ont pas de date de péremption.

alter table public.stock_catalogue
  add column if not exists gestion_lot boolean not null default true;

alter table public.stock_catalogue
  add column if not exists gestion_dlc boolean not null default true;

comment on column public.stock_catalogue.gestion_lot is
  'Si vrai : la réception / inventaire demande un n° de lot (sinon lot libre / ignoré).';
comment on column public.stock_catalogue.gestion_dlc is
  'Si vrai : suivi de péremption (DLC) liée au lot. Sinon pas de date attendue.';

-- Matériel durable / pièces matériel : pas de DLC ni lot par défaut.
update public.stock_catalogue
set gestion_lot = false, gestion_dlc = false
where mode = 'durable'
   or (coalesce(nature, '') = 'materiel' and mode = 'piece');

-- O₂ : lot utile, DLC rarement.
update public.stock_catalogue
set gestion_lot = true, gestion_dlc = false
where mode = 'oxygene';

-- Consommables / boîtes : lot + DLC.
update public.stock_catalogue
set gestion_lot = true, gestion_dlc = true
where mode = 'boite'
   or (coalesce(nature, 'consommable') = 'consommable' and mode = 'piece');

create or replace function public.stock_completer_unite(
  p_unite uuid,
  p_lot text default null,
  p_dlc date default null,
  p_lieu uuid default null,
  p_qte numeric default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  u public.stock_unites;
  c public.stock_catalogue;
  lot_txt text := nullif(btrim(coalesce(p_lot, '')), '');
  dlc_connue date;
  dlc_finale date := p_dlc;
begin
  if not public.peut_gerer_stock() then
    return json_build_object('ok', false, 'error', 'Accès stock refusé.');
  end if;

  select * into u from public.stock_unites where id = p_unite;
  if not found then
    return json_build_object('ok', false, 'error', 'Unité introuvable.');
  end if;

  select * into c from public.stock_catalogue where id = u.catalogue_id;

  if coalesce(c.gestion_lot, true)
     and lot_txt is null
     and nullif(btrim(coalesce(u.lot, '')), '') is null then
    return json_build_object('ok', false, 'error', 'Indiquez le n° de lot pour cet article.');
  end if;

  if coalesce(c.gestion_dlc, true)
     and dlc_finale is null
     and u.date_peremption is null then
    return json_build_object('ok', false, 'error', 'Indiquez la date de péremption (DLC).');
  end if;

  -- Même lot = même DLC si déjà connue.
  if lot_txt is not null and coalesce(c.gestion_dlc, true) then
    select min(date_peremption) into dlc_connue
    from public.stock_unites
    where catalogue_id = u.catalogue_id
      and lower(btrim(coalesce(lot, ''))) = lower(lot_txt)
      and date_peremption is not null
      and id <> u.id;
    if dlc_connue is not null then
      dlc_finale := dlc_connue;
    end if;
  end if;

  update public.stock_unites set
    lot = case when coalesce(c.gestion_lot, true) then coalesce(lot_txt, lot) else lot end,
    date_peremption = case
      when not coalesce(c.gestion_dlc, true) then date_peremption
      else coalesce(dlc_finale, date_peremption)
    end,
    lieu_id = coalesce(p_lieu, lieu_id),
    qte_restante = case
      when p_qte is not null and p_qte >= 0 then p_qte
      else qte_restante
    end
  where id = u.id
  returning * into u;

  return json_build_object('ok', true, 'unite', row_to_json(u));
end;
$$;

revoke all on function public.stock_completer_unite(uuid, text, date, uuid, numeric) from public, anon;
grant execute on function public.stock_completer_unite(uuid, text, date, uuid, numeric) to authenticated, service_role;

notify pgrst, 'reload schema';
