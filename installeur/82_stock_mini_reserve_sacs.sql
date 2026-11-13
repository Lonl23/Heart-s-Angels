-- ════════════════════════════════════════════════════════════════════════════
--  Stock mini réserve / sacs sur le catalogue (popup type d’article).
--  stock_minimal = seuil réserve ; stock_minimal_sacs = seuil sacs / vecteurs.
--  Idempotent. Ne touche pas aux données. Après 81_stock_gestion_rapports.sql.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.stock_catalogue
  add column if not exists stock_minimal_sacs numeric default 0;

comment on column public.stock_catalogue.stock_minimal is
  'Seuil d’alerte en réserve (reserve, armoire, autre, sans lieu).';
comment on column public.stock_catalogue.stock_minimal_sacs is
  'Seuil d’alerte dans les sacs / pochettes / véhicules.';

create or replace function public._stock_lieu_est_sac(p_type text)
returns boolean language sql immutable as $$
  select coalesce(p_type, '') in ('sac', 'pochette', 'vehicule', 'armoire_vehicule');
$$;

-- Alertes : seuil réserve et seuil sacs séparés
create or replace function public.stock_alertes()
returns json language plpgsql stable security definer set search_path = public as $$
declare
  perimes json;
  proches json;
  proches_j15 json;
  vides json;
  bas json;
  o2 json;
  o2_bouteilles json;
  commandes json;
begin
  if not public.peut_gerer_stock() then
    return json_build_object('ok', false, 'error', 'réservé à la logistique');
  end if;
  select coalesce(json_agg(public._stock_unite_json(u, c, l) order by u.date_peremption), '[]'::json) into perimes
  from public.stock_unites u
  join public.stock_catalogue c on c.id = u.catalogue_id
  left join public.stock_lieux l on l.id = u.lieu_id
  where u.etat = 'dispo'
    and u.date_peremption is not null and u.date_peremption < current_date;
  select coalesce(json_agg(public._stock_unite_json(u, c, l) order by u.date_peremption), '[]'::json) into proches_j15
  from public.stock_unites u
  join public.stock_catalogue c on c.id = u.catalogue_id
  left join public.stock_lieux l on l.id = u.lieu_id
  where u.etat = 'dispo' and coalesce(u.qte_restante, 0) > 0
    and u.date_peremption is not null
    and u.date_peremption >= current_date
    and u.date_peremption <= current_date + 15;
  select coalesce(json_agg(public._stock_unite_json(u, c, l) order by u.date_peremption), '[]'::json) into proches
  from public.stock_unites u
  join public.stock_catalogue c on c.id = u.catalogue_id
  left join public.stock_lieux l on l.id = u.lieu_id
  where u.etat = 'dispo' and coalesce(u.qte_restante, 0) > 0
    and u.date_peremption is not null
    and u.date_peremption > current_date + 15
    and u.date_peremption <= current_date + 90;
  select coalesce(json_agg(public._stock_unite_json(u, c, l)), '[]'::json) into vides
  from public.stock_unites u
  join public.stock_catalogue c on c.id = u.catalogue_id
  left join public.stock_lieux l on l.id = u.lieu_id
  where u.etat in ('vide','consomme') or (c.mode = 'boite' and u.qte_restante > 0 and u.qte_restante <= 10);
  select coalesce(json_agg(row_to_json(s) order by s.nom, s.zone), '[]'::json) into bas
  from (
    select c.id, c.nom, c.mode, c.photo_path, c.fournisseur_id,
           c.ref_fournisseur, f.nom as fournisseur_nom,
           'reserve'::text as zone,
           coalesce(sum(u.qte_restante) filter (
             where u.etat = 'dispo' and not public._stock_lieu_est_sac(l.type)
           ), 0) as reste,
           c.stock_minimal
    from public.stock_catalogue c
    left join public.stock_unites u on u.catalogue_id = c.id
    left join public.stock_lieux l on l.id = u.lieu_id
    left join public.stock_fournisseurs f on f.id = c.fournisseur_id
    where c.actif and c.stock_minimal > 0 and c.mode <> 'oxygene'
    group by c.id, f.nom
    having coalesce(sum(u.qte_restante) filter (
      where u.etat = 'dispo' and not public._stock_lieu_est_sac(l.type)
    ), 0) <= c.stock_minimal
    union all
    select c.id, c.nom, c.mode, c.photo_path, c.fournisseur_id,
           c.ref_fournisseur, f.nom as fournisseur_nom,
           'sacs'::text as zone,
           coalesce(sum(u.qte_restante) filter (
             where u.etat = 'dispo' and public._stock_lieu_est_sac(l.type)
           ), 0) as reste,
           c.stock_minimal_sacs as stock_minimal
    from public.stock_catalogue c
    left join public.stock_unites u on u.catalogue_id = c.id
    left join public.stock_lieux l on l.id = u.lieu_id
    left join public.stock_fournisseurs f on f.id = c.fournisseur_id
    where c.actif and coalesce(c.stock_minimal_sacs, 0) > 0 and c.mode <> 'oxygene'
    group by c.id, f.nom
    having coalesce(sum(u.qte_restante) filter (
      where u.etat = 'dispo' and public._stock_lieu_est_sac(l.type)
    ), 0) <= c.stock_minimal_sacs
  ) s;
  select coalesce(json_agg(public._stock_unite_json(u, c, l)), '[]'::json) into o2
  from public.stock_unites u
  join public.stock_catalogue c on c.id = u.catalogue_id
  left join public.stock_lieux l on l.id = u.lieu_id
  where u.etat = 'dispo' and c.mode = 'oxygene'
    and coalesce(u.pression_bar, 0) <= 50;
  select coalesce(json_agg(json_build_object(
      'id', u.id, 'nom', c.nom, 'lot', u.lot, 'photo_path', c.photo_path,
      'date_peremption', u.date_peremption,
      'volume_l', coalesce(u.volume_l, c.volume_l),
      'pression_bar', u.pression_bar,
      'pression_pleine', coalesce(u.pression_pleine, 200),
      'capacite_l', round(coalesce(u.volume_l, c.volume_l, 0) * coalesce(u.pression_bar, 0), 1),
      'niveau_pct', case
        when coalesce(u.pression_pleine, 200) > 0
          then round(100.0 * coalesce(u.pression_bar, 0) / coalesce(u.pression_pleine, 200), 0)
        else 0 end,
      'lieu_nom', l.nom,
      'lieu_chemin', coalesce(public.stock_lieu_chemin(u.lieu_id), l.nom)
    ) order by coalesce(u.pression_bar, 0), c.nom), '[]'::json) into o2_bouteilles
  from public.stock_unites u
  join public.stock_catalogue c on c.id = u.catalogue_id
  left join public.stock_lieux l on l.id = u.lieu_id
  where u.etat = 'dispo' and c.mode = 'oxygene';
  select coalesce(json_agg(json_build_object(
      'id', cmd.id, 'catalogue_id', cmd.catalogue_id, 'fournisseur_id', cmd.fournisseur_id,
      'quantite', cmd.quantite, 'statut', cmd.statut, 'date_rappel', cmd.date_rappel,
      'date_commande', cmd.date_commande, 'notes', cmd.notes,
      'article', c.nom, 'photo_path', c.photo_path, 'mode', c.mode,
      'fournisseur_nom', f.nom
    ) order by cmd.date_rappel nulls last, cmd.created_at), '[]'::json) into commandes
  from public.stock_commandes cmd
  join public.stock_catalogue c on c.id = cmd.catalogue_id
  left join public.stock_fournisseurs f on f.id = cmd.fournisseur_id
  where cmd.statut in ('a_commander','commandee')
    and (cmd.date_rappel is null or cmd.date_rappel <= current_date + 7);
  return json_build_object('ok', true, 'perimes', perimes, 'proches_j15', proches_j15,
    'proches', proches, 'vides', vides, 'bas', bas, 'o2_basse', o2,
    'o2_bouteilles', o2_bouteilles, 'commandes', commandes);
end $$;
grant execute on function public.stock_alertes() to authenticated;

create or replace function public.trg_stock_bas_notif()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cat public.stock_catalogue;
  reste_r numeric;
  reste_s numeric;
  cid uuid;
begin
  if tg_op = 'INSERT' then return new; end if;
  if tg_op = 'UPDATE'
     and coalesce(new.qte_restante, 0) >= coalesce(old.qte_restante, 0)
     and new.etat is not distinct from old.etat then
    return new;
  end if;
  cid := coalesce(new.catalogue_id, old.catalogue_id);
  if cid is null then return coalesce(new, old); end if;
  select * into cat from public.stock_catalogue where id = cid;
  if not found or cat.mode = 'oxygene' then
    return coalesce(new, old);
  end if;
  select
    coalesce(sum(u.qte_restante) filter (
      where u.etat = 'dispo' and not public._stock_lieu_est_sac(l.type)
    ), 0),
    coalesce(sum(u.qte_restante) filter (
      where u.etat = 'dispo' and public._stock_lieu_est_sac(l.type)
    ), 0)
  into reste_r, reste_s
  from public.stock_unites u
  left join public.stock_lieux l on l.id = u.lieu_id
  where u.catalogue_id = cid;
  if coalesce(cat.stock_minimal, 0) > 0 and reste_r <= cat.stock_minimal then
    perform public.notifier_evenement(
      'stock_bas',
      'Stock sous le seuil',
      cat.nom || ' · réserve ' || reste_r::text || ' / mini ' || cat.stock_minimal::text,
      '/app/stock',
      'haute',
      null,
      cat.id,
      jsonb_build_object('catalogue_id', cat.id, 'zone', 'reserve', 'reste', reste_r)
    );
  end if;
  if coalesce(cat.stock_minimal_sacs, 0) > 0 and reste_s <= cat.stock_minimal_sacs then
    perform public.notifier_evenement(
      'stock_bas',
      'Stock sous le seuil',
      cat.nom || ' · sacs ' || reste_s::text || ' / mini ' || cat.stock_minimal_sacs::text,
      '/app/stock',
      'haute',
      null,
      cat.id,
      jsonb_build_object('catalogue_id', cat.id, 'zone', 'sacs', 'reste', reste_s)
    );
  end if;
  return coalesce(new, old);
end
$$;
drop trigger if exists trg_stock_bas_notif on public.stock_unites;
create trigger trg_stock_bas_notif
  after insert or update of qte_restante, etat
  on public.stock_unites
  for each row execute function public.trg_stock_bas_notif();

create or replace function public.trg_stock_seuil_notif()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  reste_r numeric;
  reste_s numeric;
begin
  if new.mode = 'oxygene' then return new; end if;
  if tg_op = 'UPDATE'
     and old.stock_minimal is not distinct from new.stock_minimal
     and old.stock_minimal_sacs is not distinct from new.stock_minimal_sacs then
    return new;
  end if;
  select
    coalesce(sum(u.qte_restante) filter (
      where u.etat = 'dispo' and not public._stock_lieu_est_sac(l.type)
    ), 0),
    coalesce(sum(u.qte_restante) filter (
      where u.etat = 'dispo' and public._stock_lieu_est_sac(l.type)
    ), 0)
  into reste_r, reste_s
  from public.stock_unites u
  left join public.stock_lieux l on l.id = u.lieu_id
  where u.catalogue_id = new.id;
  if coalesce(new.stock_minimal, 0) > 0 and reste_r <= new.stock_minimal then
    perform public.notifier_evenement(
      'stock_bas',
      'Stock sous le seuil',
      new.nom || ' · réserve ' || reste_r::text || ' / mini ' || new.stock_minimal::text,
      '/app/stock',
      'haute',
      null,
      new.id,
      jsonb_build_object('catalogue_id', new.id, 'zone', 'reserve', 'reste', reste_r)
    );
  end if;
  if coalesce(new.stock_minimal_sacs, 0) > 0 and reste_s <= new.stock_minimal_sacs then
    perform public.notifier_evenement(
      'stock_bas',
      'Stock sous le seuil',
      new.nom || ' · sacs ' || reste_s::text || ' / mini ' || new.stock_minimal_sacs::text,
      '/app/stock',
      'haute',
      null,
      new.id,
      jsonb_build_object('catalogue_id', new.id, 'zone', 'sacs', 'reste', reste_s)
    );
  end if;
  return new;
end
$$;
drop trigger if exists trg_stock_seuil_notif on public.stock_catalogue;
create trigger trg_stock_seuil_notif
  after insert or update of stock_minimal, stock_minimal_sacs
  on public.stock_catalogue
  for each row execute function public.trg_stock_seuil_notif();

create or replace function public.stock_export()
returns json language plpgsql stable security definer set search_path = public as $$
declare
  lieux json;
  articles json;
  unites json;
  fournisseurs json;
  commandes json;
  mouvements json;
begin
  if not public.peut_gerer_stock() then
    return json_build_object('ok', false, 'error', 'réservé à la logistique');
  end if;

  select coalesce(json_agg(json_build_object(
      'id', l.id, 'nom', l.nom, 'type', l.type, 'parent_id', l.parent_id,
      'qr', l.qr_token, 'actif', l.actif
    ) order by l.nom), '[]'::json)
    into lieux
  from public.stock_lieux l
  where l.actif;

  select coalesce(json_agg(json_build_object(
      'id', c.id, 'nom', c.nom, 'mode', c.mode, 'categorie', c.categorie,
      'unite', c.unite, 'qte_defaut', c.qte_defaut,
      'stock_minimal', c.stock_minimal, 'stock_minimal_sacs', c.stock_minimal_sacs,
      'volume_l', c.volume_l, 'ref_fournisseur', c.ref_fournisseur,
      'fournisseur', f.nom, 'fournisseur_id', c.fournisseur_id
    ) order by c.nom), '[]'::json)
    into articles
  from public.stock_catalogue c
  left join public.stock_fournisseurs f on f.id = c.fournisseur_id
  where c.actif;

  select coalesce(json_agg(json_build_object(
      'id', u.id, 'qr', u.qr_token, 'article', c.nom, 'catalogue_id', c.id,
      'mode', c.mode, 'unite', c.unite, 'lot', u.lot,
      'dlc', u.date_peremption, 'etat', u.etat,
      'qte_initiale', u.qte_initiale, 'qte_restante', u.qte_restante,
      'pression_bar', u.pression_bar, 'volume_l', coalesce(u.volume_l, c.volume_l),
      'lieu_id', u.lieu_id, 'lieu', l.nom, 'notes', u.notes
    ) order by c.nom, u.lot, u.created_at), '[]'::json)
    into unites
  from public.stock_unites u
  join public.stock_catalogue c on c.id = u.catalogue_id
  left join public.stock_lieux l on l.id = u.lieu_id;

  select coalesce(json_agg(json_build_object(
      'id', f.id, 'nom', f.nom, 'contact', f.contact, 'telephone', f.telephone,
      'email', f.email, 'adresse', f.adresse, 'notes', f.notes
    ) order by f.nom), '[]'::json)
    into fournisseurs
  from public.stock_fournisseurs f
  where f.actif;

  select coalesce(json_agg(json_build_object(
      'id', cmd.id, 'article', c.nom, 'fournisseur', f.nom,
      'quantite', cmd.quantite, 'statut', cmd.statut,
      'date_rappel', cmd.date_rappel, 'date_commande', cmd.date_commande,
      'notes', cmd.notes
    ) order by cmd.date_rappel nulls last, cmd.created_at), '[]'::json)
    into commandes
  from public.stock_commandes cmd
  join public.stock_catalogue c on c.id = cmd.catalogue_id
  left join public.stock_fournisseurs f on f.id = cmd.fournisseur_id;

  select coalesce(json_agg(json_build_object(
      'quand', m.created_at, 'type', m.type, 'article', c.nom,
      'quantite', m.quantite, 'motif', m.motif,
      'lieu', l.nom, 'lieu_origine', lo.nom,
      'lot', u.lot, 'par', nullif(trim(coalesce(p.prenom,'') || ' ' || coalesce(p.nom,'')), '')
    ) order by m.created_at desc), '[]'::json)
    into mouvements
  from (
    select * from public.stock_mouvements order by created_at desc limit 2000
  ) m
  left join public.stock_catalogue c on c.id = m.catalogue_id
  left join public.stock_lieux l on l.id = m.lieu_id
  left join public.stock_lieux lo on lo.id = m.lieu_origine_id
  left join public.stock_unites u on u.id = m.unite_id
  left join public.profiles p on p.id = m.par;

  return json_build_object(
    'ok', true,
    'lieux', lieux, 'articles', articles, 'unites', unites,
    'fournisseurs', fournisseurs, 'commandes', commandes, 'mouvements', mouvements
  );
end $$;
grant execute on function public.stock_export() to authenticated;

notify pgrst, 'reload schema';
