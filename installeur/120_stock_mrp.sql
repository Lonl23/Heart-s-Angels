-- MRP léger ASBL : quantités de nomenclature (BOM) sur la dotation,
-- vue des besoins nets (sécurité + kits − stock − commandes).

alter table public.stock_dotation
  add column if not exists qte numeric not null default 1;

alter table public.stock_dotation
  drop constraint if exists stock_dotation_qte;

alter table public.stock_dotation
  add constraint stock_dotation_qte check (qte > 0 and qte <= 9999);

comment on column public.stock_dotation.qte is
  'Quantité BOM attendue dans ce lieu (nomenclature MRP).';

comment on table public.stock_dotation is
  'Nomenclature / contenu prévu par emplacement (BOM lieu × article × qté).';

-- Besoins nets calculés à la volée (pas de table d’OF).
create or replace function public.stock_mrp_besoins()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.peut_gerer_stock() then
    return jsonb_build_object('ok', false, 'error', 'Accès stock refusé.');
  end if;

  with lieux as (
    select id, type, coalesce(type in ('sac','pochette','kit','vehicule'), false) as est_mission
    from public.stock_lieux where actif
  ),
  dispo as (
    select
      u.catalogue_id,
      coalesce(sum(
        case
          when c.mode = 'boite' then coalesce(u.qte_restante, 0)
          when c.mode = 'oxygene' then case when coalesce(u.pression_bar, 0) > 0 then 1 else 0 end
          else 1
        end
      ) filter (where u.etat = 'dispo'), 0) as qte_dispo,
      coalesce(sum(
        case
          when c.mode = 'boite' then coalesce(u.qte_restante, 0)
          when c.mode = 'oxygene' then case when coalesce(u.pression_bar, 0) > 0 then 1 else 0 end
          else 1
        end
      ) filter (where u.etat = 'dispo' and not coalesce(l.est_mission, false)), 0) as qte_reserve,
      coalesce(sum(
        case
          when c.mode = 'boite' then coalesce(u.qte_restante, 0)
          when c.mode = 'oxygene' then case when coalesce(u.pression_bar, 0) > 0 then 1 else 0 end
          else 1
        end
      ) filter (where u.etat = 'dispo' and coalesce(l.est_mission, false)), 0) as qte_mission
    from public.stock_unites u
    join public.stock_catalogue c on c.id = u.catalogue_id
    left join lieux l on l.id = u.lieu_id
    group by u.catalogue_id
  ),
  present_lieu as (
    select
      u.lieu_id,
      u.catalogue_id,
      coalesce(sum(
        case
          when c.mode = 'boite' then coalesce(u.qte_restante, 0)
          when c.mode = 'oxygene' then case when coalesce(u.pression_bar, 0) > 0 then 1 else 0 end
          else 1
        end
      ) filter (where u.etat = 'dispo'), 0) as qte_presente
    from public.stock_unites u
    join public.stock_catalogue c on c.id = u.catalogue_id
    where u.lieu_id is not null
    group by u.lieu_id, u.catalogue_id
  ),
  bom as (
    select
      d.catalogue_id,
      coalesce(sum(greatest(d.qte - coalesce(p.qte_presente, 0), 0)), 0) as manque_bom,
      coalesce(sum(d.qte), 0) as qte_bom
    from public.stock_dotation d
    left join present_lieu p on p.lieu_id = d.lieu_id and p.catalogue_id = d.catalogue_id
    group by d.catalogue_id
  ),
  cmd as (
    select catalogue_id, coalesce(sum(quantite), 0) as en_commande
    from public.stock_commandes
    where statut in ('a_commander', 'commandee', 'en_attente')
    group by catalogue_id
  ),
  calc as (
    select
      c.id as catalogue_id,
      c.nom,
      c.mode,
      c.nature,
      c.unite,
      c.fournisseur_id,
      c.ref_fournisseur,
      c.delai_reappro,
      coalesce(c.stock_minimal, 0) as stock_minimal,
      coalesce(c.stock_minimal_sacs, 0) as stock_minimal_sacs,
      coalesce(d.qte_dispo, 0) as qte_dispo,
      coalesce(d.qte_reserve, 0) as qte_reserve,
      coalesce(d.qte_mission, 0) as qte_mission,
      coalesce(b.qte_bom, 0) as qte_bom,
      coalesce(b.manque_bom, 0) as manque_bom,
      coalesce(m.en_commande, 0) as en_commande,
      greatest(coalesce(c.stock_minimal, 0) - coalesce(d.qte_reserve, 0), 0) as manque_securite_reserve,
      greatest(coalesce(c.stock_minimal_sacs, 0) - coalesce(d.qte_mission, 0), 0) as manque_securite_mission
    from public.stock_catalogue c
    left join dispo d on d.catalogue_id = c.id
    left join bom b on b.catalogue_id = c.id
    left join cmd m on m.catalogue_id = c.id
    where c.actif
  ),
  lignes as (
    select
      catalogue_id, nom, mode, nature, unite, fournisseur_id, ref_fournisseur, delai_reappro,
      stock_minimal, stock_minimal_sacs,
      qte_dispo, qte_reserve, qte_mission, qte_bom, manque_bom, en_commande,
      manque_securite_reserve, manque_securite_mission,
      -- À doter : trou de nomenclature couvert par le stock global
      least(manque_bom, qte_dispo) as a_doter,
      -- À acheter : sécurité + BOM non couverts − déjà commandé
      greatest(
        manque_securite_reserve
        + manque_securite_mission
        + greatest(manque_bom - qte_dispo, 0)
        - en_commande,
        0
      ) as a_acheter
    from calc
  )
  select jsonb_build_object(
    'ok', true,
    'calcule_le', now(),
    'lignes', coalesce((
      select jsonb_agg(to_jsonb(l) order by
        case when l.a_acheter > 0 then 0 when l.a_doter > 0 then 1 else 2 end,
        l.nom)
      from lignes l
      where l.a_acheter > 0 or l.a_doter > 0 or l.manque_bom > 0
        or l.manque_securite_reserve > 0 or l.manque_securite_mission > 0
    ), '[]'::jsonb),
    'totaux', (
      select jsonb_build_object(
        'articles', count(*),
        'a_acheter', coalesce(sum(a_acheter), 0),
        'a_doter', coalesce(sum(a_doter), 0)
      ) from lignes
      where a_acheter > 0 or a_doter > 0
    )
  ) into result;

  return result;
end;
$$;

revoke all on function public.stock_mrp_besoins() from public, anon;
grant execute on function public.stock_mrp_besoins() to authenticated, service_role;

notify pgrst, 'reload schema';
