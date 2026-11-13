-- ════════════════════════════════════════════════════════════════════════════
--  Export Excel du stock + import d'inventaire (quantités / pression comptées).
--  Idempotent. Après 26_stock_logistique.sql.
-- ════════════════════════════════════════════════════════════════════════════

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
      'unite', c.unite, 'qte_defaut', c.qte_defaut, 'stock_minimal', c.stock_minimal,
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

-- p_lignes : [{ id?, qr?, qte_comptee?, pression_comptee? }, ...]
create or replace function public.stock_inventaire_importer(p_lignes jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare
  e jsonb;
  tok text;
  uid uuid;
  u public.stock_unites;
  c public.stock_catalogue;
  qte numeric;
  pres numeric;
  appliques int := 0;
  ignores int := 0;
  erreurs json := '[]'::json;
  n int := 0;
  msg text;
begin
  if not public.peut_gerer_stock() then
    return json_build_object('ok', false, 'error', 'réservé à la logistique');
  end if;
  if p_lignes is null or jsonb_typeof(p_lignes) <> 'array' then
    return json_build_object('ok', false, 'error', 'fichier vide ou illisible');
  end if;

  for e in select value from jsonb_array_elements(p_lignes)
  loop
    n := n + 1;
    uid := null;
    tok := nullif(trim(coalesce(e->>'qr', e->>'qr_token', '')), '');
    begin
      if nullif(e->>'id', '') is not null then
        uid := (e->>'id')::uuid;
      end if;
    exception when others then
      uid := null;
    end;

    if uid is not null then
      select * into u from public.stock_unites where id = uid;
    elsif tok is not null then
      if tok not like 'ha:u:%' and tok not like 'ha:l:%' then
        tok := 'ha:u:' || tok;
      end if;
      select * into u from public.stock_unites where qr_token = tok;
    else
      u := null;
    end if;

    if u.id is null then
      erreurs := erreurs || jsonb_build_array(jsonb_build_object(
        'ligne', n, 'error', 'article introuvable', 'qr', e->>'qr', 'id', e->>'id'
      ));
      continue;
    end if;
    select * into c from public.stock_catalogue where id = u.catalogue_id;

    qte := null;
    pres := null;
    begin
      if e ? 'qte_comptee' and nullif(trim(e->>'qte_comptee'), '') is not null then
        qte := (e->>'qte_comptee')::numeric;
      end if;
    exception when others then
      erreurs := erreurs || jsonb_build_array(jsonb_build_object(
        'ligne', n, 'article', c.nom, 'error', 'quantité comptée invalide'
      ));
      continue;
    end;
    begin
      if e ? 'pression_comptee' and nullif(trim(e->>'pression_comptee'), '') is not null then
        pres := (e->>'pression_comptee')::numeric;
      end if;
    exception when others then
      erreurs := erreurs || jsonb_build_array(jsonb_build_object(
        'ligne', n, 'article', c.nom, 'error', 'pression comptée invalide'
      ));
      continue;
    end;

    if qte is null and pres is null then
      ignores := ignores + 1;
      continue;
    end if;

    if c.mode = 'oxygene' then
      if pres is null then
        ignores := ignores + 1;
        continue;
      end if;
      if pres < 0 or pres > coalesce(u.pression_pleine, 200) then
        erreurs := erreurs || jsonb_build_array(jsonb_build_object(
          'ligne', n, 'article', c.nom, 'error', 'pression hors limites (0–' || coalesce(u.pression_pleine, 200)::text || ' bar)'
        ));
        continue;
      end if;
      if pres is not distinct from u.pression_bar then
        ignores := ignores + 1;
        continue;
      end if;
      update public.stock_unites set pression_bar = pres where id = u.id;
      insert into public.stock_mouvements(type, quantite, motif, par, unite_id, lieu_id, catalogue_id)
        values ('ajustement', pres, 'inventaire Excel', auth.uid(), u.id, u.lieu_id, c.id);
      appliques := appliques + 1;
      continue;
    end if;

    if qte is null then
      ignores := ignores + 1;
      continue;
    end if;
    if qte < 0 then
      erreurs := erreurs || jsonb_build_array(jsonb_build_object(
        'ligne', n, 'article', c.nom, 'error', 'quantité négative'
      ));
      continue;
    end if;
    if qte is not distinct from u.qte_restante then
      ignores := ignores + 1;
      continue;
    end if;
    update public.stock_unites
      set qte_restante = qte,
          etat = case
            when qte <= 0 then (case when c.mode = 'boite' then 'vide' else 'consomme' end)
            else 'dispo' end
      where id = u.id;
    insert into public.stock_mouvements(type, quantite, motif, par, unite_id, lieu_id, catalogue_id)
      values ('ajustement', qte, 'inventaire Excel', auth.uid(), u.id, u.lieu_id, c.id);
    appliques := appliques + 1;
  end loop;

  msg := appliques::text || ' correction(s) enregistrée(s)';
  if ignores > 0 then msg := msg || ' · ' || ignores::text || ' ligne(s) inchangée(s) ou vide(s)'; end if;
  if jsonb_array_length(erreurs) > 0 then
    msg := msg || ' · ' || jsonb_array_length(erreurs)::text || ' erreur(s)';
  end if;

  return json_build_object(
    'ok', true, 'appliques', appliques, 'ignores', ignores,
    'erreurs', erreurs, 'message', msg
  );
end $$;
grant execute on function public.stock_inventaire_importer(jsonb) to authenticated;

notify pgrst, 'reload schema';
