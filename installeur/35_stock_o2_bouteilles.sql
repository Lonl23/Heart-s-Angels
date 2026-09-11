-- ════════════════════════════════════════════════════════════════════════════
--  Types O₂ en notation B (B2 / B5 / B10) + inventaire actuel :
--  2 × B10, 2 × B5, 1 × B2 dans Réserve Oxygène, 200 bar, sans n° de lot.
--  Idempotent. Après 34_stock_dotation_intervention.sql.
-- ════════════════════════════════════════════════════════════════════════════

do $$
declare
  rec record;
  keep uuid;
  reserve uuid;
  i int;
  uid uuid;
begin
  for rec in select unnest(array[2, 5, 10]) as vol loop
    keep := null;
    select id into keep from public.stock_catalogue
     where mode = 'oxygene' and volume_l = rec.vol
       and nom ~* ('^O2[[:space:]]*B' || rec.vol::text || 'L$')
     order by actif desc nulls last, created_at
     limit 1;
    if keep is null then
      select id into keep from public.stock_catalogue
       where mode = 'oxygene' and volume_l = rec.vol
       order by actif desc nulls last, created_at
       limit 1;
    end if;
    if keep is null then
      insert into public.stock_catalogue (nom, categorie, mode, unite, volume_l, actif)
        values ('O2 B' || rec.vol::text || 'L', 'oxygène', 'oxygene', 'L', rec.vol, true)
        returning id into keep;
    else
      update public.stock_catalogue
         set nom = 'O2 B' || rec.vol::text || 'L',
             actif = true,
             categorie = 'oxygène',
             unite = 'L',
             volume_l = rec.vol
       where id = keep;
    end if;
    update public.stock_catalogue
       set actif = false
     where mode = 'oxygene' and volume_l = rec.vol and id is distinct from keep;
  end loop;

  reserve := public._stock_assurer_lieu('Réserve Oxygène', 'reserve', null);

  -- Ne semer que s’il n’y a encore aucune bouteille O₂ (réinstall / 1er passage).
  if exists (
    select 1
      from public.stock_unites u
      join public.stock_catalogue c on c.id = u.catalogue_id
     where c.mode = 'oxygene'
  ) then
    return;
  end if;

  for rec in
    select * from (values (2::numeric, 1), (5::numeric, 2), (10::numeric, 2)) as t(vol, nb)
  loop
    select id into keep from public.stock_catalogue
     where mode = 'oxygene' and volume_l = rec.vol and actif
     limit 1;
    if keep is null then
      continue;
    end if;
    for i in 1..rec.nb loop
      insert into public.stock_unites (
        catalogue_id, lieu_id, volume_l, pression_bar, pression_pleine,
        etat, qte_initiale, qte_restante
      ) values (
        keep, reserve, rec.vol, 200, 200, 'dispo', 1, 1
      ) returning id into uid;
      insert into public.stock_mouvements (type, quantite, motif, unite_id, lieu_id, catalogue_id)
        values ('entree', 200, 'inventaire — bouteille pleine', uid, reserve, keep);
    end loop;
  end loop;
end $$;

notify pgrst, 'reload schema';
