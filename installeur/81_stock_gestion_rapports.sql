-- ════════════════════════════════════════════════════════════════════════════
--  Gestion articles (lots / DLC / seuil), rapports de sortie (déclassement
--  + utilisation mission), alertes J-15 et bouteilles O2.
--  Idempotent. Ne touche pas aux données stock. Après 80_evenements_relais_seraing.sql.
-- ════════════════════════════════════════════════════════════════════════════

create index if not exists stock_mouvements_souhait_idx
  on public.stock_mouvements (souhait_id)
  where souhait_id is not null;

-- Chemin d’emplacement dans le JSON unité (pour les alertes)
create or replace function public._stock_unite_json(
  u public.stock_unites, c public.stock_catalogue, l public.stock_lieux
)
returns json language sql stable as $$
  select json_build_object(
    'id', u.id, 'qr_token', u.qr_token, 'lot', u.lot,
    'date_peremption', u.date_peremption,
    'qte_initiale', u.qte_initiale, 'qte_restante', u.qte_restante,
    'etat', u.etat, 'lieu_id', u.lieu_id,
    'nom', c.nom, 'mode', c.mode, 'unite', c.unite, 'categorie', c.categorie,
    'catalogue_id', c.id, 'photo_path', c.photo_path,
    'fournisseur_id', c.fournisseur_id,
    'lieu_nom', l.nom,
    'lieu_chemin', coalesce(public.stock_lieu_chemin(u.lieu_id), l.nom),
    'volume_l', coalesce(u.volume_l, c.volume_l),
    'pression_bar', u.pression_bar,
    'pression_pleine', coalesce(u.pression_pleine, 200),
    'capacite_l', round(coalesce(u.volume_l, c.volume_l, 0) * coalesce(u.pression_bar, 0), 1)
  )
$$;

-- Mettre à jour n° de lot et DLC pour toutes les unités d’un lot
create or replace function public.stock_lot_mettre_a_jour(
  p_catalogue uuid,
  p_lot text,
  p_nouveau_lot text default null,
  p_dlc date default null
)
returns json language plpgsql security definer set search_path = public as $$
declare
  lot_act text := nullif(btrim(coalesce(p_lot, '')), '');
  lot_new text := nullif(btrim(coalesce(p_nouveau_lot, '')), '');
  n int := 0;
begin
  if not public.peut_gerer_stock() then
    return json_build_object('ok', false, 'error', 'réservé à la logistique');
  end if;
  if p_catalogue is null then
    return json_build_object('ok', false, 'error', 'article manquant');
  end if;
  if p_dlc is null and lot_new is null then
    return json_build_object('ok', false, 'error', 'rien à modifier');
  end if;
  update public.stock_unites
    set lot = coalesce(lot_new, lot),
        date_peremption = coalesce(p_dlc, date_peremption)
  where catalogue_id = p_catalogue
    and nullif(btrim(coalesce(lot, '')), '') is not distinct from lot_act;
  get diagnostics n = row_count;
  return json_build_object('ok', true, 'nb', n);
end $$;
grant execute on function public.stock_lot_mettre_a_jour(uuid, text, text, date) to authenticated;

-- Journal : nom du souhait pour lier emport / conso à la mission
create or replace function public.stock_journal(
  p_limite int default 250,
  p_type text default null,
  p_catalogue uuid default null
)
returns json language plpgsql stable security definer set search_path = public as $$
declare
  items json;
  n int := least(greatest(coalesce(p_limite, 250), 1), 800);
begin
  if not public.peut_gerer_stock() then
    return json_build_object('ok', false, 'error', 'réservé à la logistique');
  end if;
  select coalesce(json_agg(row_to_json(x) order by x.created_at desc), '[]'::json) into items
  from (
    select m.id, m.type, m.quantite, m.motif, m.created_at,
           m.unite_id, m.lieu_id, m.lieu_origine_id, m.catalogue_id, m.souhait_id,
           m.fournisseur_id,
           c.nom as article, c.photo_path, c.mode, c.unite,
           l.nom as lieu_nom, lo.nom as lieu_origine_nom,
           f.nom as fournisseur_nom,
           nullif(trim(coalesce(p.prenom,'') || ' ' || coalesce(p.nom,'')), '') as par_nom,
           u.lot, u.qr_token,
           nullif(trim(coalesce(s.beneficiaire_prenom,'') || ' ' || coalesce(s.beneficiaire_nom,'')), '') as souhait_titre,
           s.date_souhaitee, s.statut as souhait_statut
    from public.stock_mouvements m
    left join public.stock_catalogue c on c.id = m.catalogue_id
    left join public.stock_lieux l on l.id = m.lieu_id
    left join public.stock_lieux lo on lo.id = m.lieu_origine_id
    left join public.stock_fournisseurs f on f.id = m.fournisseur_id
    left join public.profiles p on p.id = m.par
    left join public.stock_unites u on u.id = m.unite_id
    left join public.souhaits s on s.id = m.souhait_id
    where (p_type is null or m.type = p_type)
      and (p_catalogue is null or m.catalogue_id = p_catalogue)
    order by m.created_at desc
    limit n
  ) x;
  return json_build_object('ok', true, 'items', items);
end $$;
grant execute on function public.stock_journal(int, text, uuid) to authenticated;

-- Missions où du matériel a réellement bougé (pas de rapport vide)
create or replace function public.stock_rapports_mission()
returns json language plpgsql stable security definer set search_path = public as $$
declare
  items json;
begin
  if not public.peut_gerer_stock() then
    return json_build_object('ok', false, 'error', 'réservé à la logistique');
  end if;
  select coalesce(json_agg(row_to_json(x) order by x.derniere desc), '[]'::json) into items
  from (
    select
      s.id as souhait_id,
      nullif(trim(coalesce(s.beneficiaire_prenom,'') || ' ' || coalesce(s.beneficiaire_nom,'')), '') as titre,
      s.date_souhaitee, s.date_fin, s.dates_possibles, s.statut,
      count(*) filter (where m.type = 'emport')::int as nb_emport,
      count(*) filter (where m.type in ('sortie','usage','releve_o2'))::int as nb_conso,
      count(*)::int as nb_mouv,
      max(m.created_at) as derniere
    from public.stock_mouvements m
    join public.souhaits s on s.id = m.souhait_id
    where m.souhait_id is not null
      and m.type in ('emport','sortie','usage','releve_o2')
    group by s.id
    having count(*) > 0
  ) x;
  return json_build_object('ok', true, 'missions', items);
end $$;
grant execute on function public.stock_rapports_mission() to authenticated;

create or replace function public.stock_rapport_souhait(p_souhait uuid)
returns json language plpgsql stable security definer set search_path = public as $$
declare
  items json;
  s public.souhaits;
begin
  if not public.peut_gerer_stock() then
    return json_build_object('ok', false, 'error', 'réservé à la logistique');
  end if;
  if p_souhait is null then
    return json_build_object('ok', false, 'error', 'mission manquante');
  end if;
  select * into s from public.souhaits where id = p_souhait;
  if not found then
    return json_build_object('ok', false, 'error', 'souhait introuvable');
  end if;
  select coalesce(json_agg(row_to_json(x) order by x.created_at desc), '[]'::json) into items
  from (
    select m.id, m.type, m.quantite, m.motif, m.created_at,
           c.nom as article, c.photo_path, c.mode,
           l.nom as lieu_nom, u.lot,
           nullif(trim(coalesce(p.prenom,'') || ' ' || coalesce(p.nom,'')), '') as par_nom
    from public.stock_mouvements m
    left join public.stock_catalogue c on c.id = m.catalogue_id
    left join public.stock_lieux l on l.id = m.lieu_id
    left join public.stock_unites u on u.id = m.unite_id
    left join public.profiles p on p.id = m.par
    where m.souhait_id = p_souhait
      and m.type in ('emport','sortie','usage','releve_o2')
  ) x;
  if items is null or items::text = '[]' then
    return json_build_object('ok', true, 'vide', true, 'items', '[]'::json);
  end if;
  return json_build_object(
    'ok', true,
    'souhait_id', s.id,
    'titre', nullif(trim(coalesce(s.beneficiaire_prenom,'') || ' ' || coalesce(s.beneficiaire_nom,'')), ''),
    'date_souhaitee', s.date_souhaitee,
    'date_fin', s.date_fin,
    'dates_possibles', s.dates_possibles,
    'statut', s.statut,
    'items', items
  );
end $$;
grant execute on function public.stock_rapport_souhait(uuid) to authenticated;

-- Alertes : J-15 + toutes les bouteilles O2 (niveau), en plus du reste
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
  select coalesce(json_agg(json_build_object(
      'id', s.id, 'nom', s.nom, 'mode', s.mode, 'reste', s.reste,
      'stock_minimal', s.stock_minimal, 'photo_path', s.photo_path,
      'fournisseur_id', s.fournisseur_id, 'fournisseur_nom', s.fournisseur_nom,
      'ref_fournisseur', s.ref_fournisseur
    )), '[]'::json) into bas
  from (
    select c.id, c.nom, c.mode, c.stock_minimal, c.photo_path, c.fournisseur_id,
           c.ref_fournisseur, f.nom as fournisseur_nom,
           coalesce(sum(u.qte_restante) filter (where u.etat = 'dispo'), 0) as reste
    from public.stock_catalogue c
    left join public.stock_unites u on u.catalogue_id = c.id
    left join public.stock_fournisseurs f on f.id = c.fournisseur_id
    where c.actif and c.stock_minimal > 0 and c.mode <> 'oxygene'
    group by c.id, f.nom
    having coalesce(sum(u.qte_restante) filter (where u.etat = 'dispo'), 0) <= c.stock_minimal
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

-- Notification stock mini (même destinataires que péremption)
create or replace function public.destinataires_notification(p_type text, p_cibles uuid[] default null)
returns table (id uuid)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return query
  select p.id
  from public.profiles p
  where coalesce(p.actif, true)
    and p.role::text is distinct from 'partenaire'
    and p.id is distinct from auth.uid()
    and (
      case p_type
        when 'assignation_souhait' then
          (p_cibles is not null and p.id = any (p_cibles)
            and (not public.est_pilote_notifications(p.role::text, p.fiche)
                 or public.pref_notification(p.fiche, p_type)))
          or (public.est_pilote_notifications(p.role::text, p.fiche)
              and public.pref_notification(p.fiche, p_type))
        when 'souhait_agenda' then
          not public.est_pilote_notifications(p.role::text, p.fiche)
          or public.pref_notification(p.fiche, p_type)
        when 'demande_souhait' then
          (coalesce(p.fiche->'roles_asbl' ? 'recolteur_souhait', false)
            and not public.est_pilote_notifications(p.role::text, p.fiche))
          or (public.est_pilote_notifications(p.role::text, p.fiche)
              and public.pref_notification(p.fiche, p_type))
        when 'rapport_materiel' then
          ((p.role::text in ('admin', 'president', 'coordinateur')
              or coalesce(p.fiche->'roles_asbl' ?| array['resp_logistique', 'resp_logistique_adjoint'], false))
            and not public.est_pilote_notifications(p.role::text, p.fiche))
          or (public.est_pilote_notifications(p.role::text, p.fiche)
              and public.pref_notification(p.fiche, p_type))
        when 'peremption_stock' then
          ((p.role::text in ('admin', 'president', 'coordinateur')
              or coalesce(p.fiche->'roles_asbl' ?| array['resp_logistique', 'resp_logistique_adjoint'], false))
            and not public.est_pilote_notifications(p.role::text, p.fiche))
          or (public.est_pilote_notifications(p.role::text, p.fiche)
              and public.pref_notification(p.fiche, p_type))
        when 'stock_bas' then
          ((p.role::text in ('admin', 'president', 'coordinateur')
              or coalesce(p.fiche->'roles_asbl' ?| array['resp_logistique', 'resp_logistique_adjoint'], false))
            and not public.est_pilote_notifications(p.role::text, p.fiche))
          or (public.est_pilote_notifications(p.role::text, p.fiche)
              and public.pref_notification(p.fiche, p_type))
        else false
      end
    );
end
$$;

create or replace function public.trg_stock_bas_notif()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cat public.stock_catalogue;
  reste numeric;
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
  if not found or coalesce(cat.stock_minimal, 0) <= 0 or cat.mode = 'oxygene' then
    return coalesce(new, old);
  end if;
  select coalesce(sum(qte_restante) filter (where etat = 'dispo'), 0) into reste
  from public.stock_unites where catalogue_id = cid;
  if reste > cat.stock_minimal then return coalesce(new, old); end if;
  perform public.notifier_evenement(
    'stock_bas',
    'Stock sous le seuil',
    cat.nom || ' · reste ' || reste::text || ' / mini ' || cat.stock_minimal::text,
    '/app/stock',
    'haute',
    null,
    cat.id,
    jsonb_build_object('catalogue_id', cat.id, 'reste', reste)
  );
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
  reste numeric;
begin
  if coalesce(new.stock_minimal, 0) <= 0 or new.mode = 'oxygene' then return new; end if;
  if tg_op = 'UPDATE' and old.stock_minimal is not distinct from new.stock_minimal then return new; end if;
  select coalesce(sum(qte_restante) filter (where etat = 'dispo'), 0) into reste
  from public.stock_unites where catalogue_id = new.id;
  if reste > new.stock_minimal then return new; end if;
  perform public.notifier_evenement(
    'stock_bas',
    'Stock sous le seuil',
    new.nom || ' · reste ' || reste::text || ' / mini ' || new.stock_minimal::text,
    '/app/stock',
    'haute',
    null,
    new.id,
    jsonb_build_object('catalogue_id', new.id, 'reste', reste)
  );
  return new;
end
$$;
drop trigger if exists trg_stock_seuil_notif on public.stock_catalogue;
create trigger trg_stock_seuil_notif
  after insert or update of stock_minimal
  on public.stock_catalogue
  for each row execute function public.trg_stock_seuil_notif();

-- Digest quotidien : J-15 en tête
create or replace function public.notifier_peremptions_stock()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  n_perimes int;
  n_j15 int;
  n_proches int;
  lignes text;
begin
  select count(*) into n_perimes
  from public.stock_unites u
  where u.etat = 'dispo' and coalesce(u.qte_restante, 0) > 0
    and u.date_peremption is not null and u.date_peremption < current_date;
  select count(*) into n_j15
  from public.stock_unites u
  where u.etat = 'dispo' and coalesce(u.qte_restante, 0) > 0
    and u.date_peremption is not null
    and u.date_peremption >= current_date
    and u.date_peremption <= current_date + 15;
  select count(*) into n_proches
  from public.stock_unites u
  where u.etat = 'dispo' and coalesce(u.qte_restante, 0) > 0
    and u.date_peremption is not null
    and u.date_peremption > current_date + 15
    and u.date_peremption <= current_date + 90;
  if coalesce(n_perimes, 0) = 0 and coalesce(n_j15, 0) = 0 and coalesce(n_proches, 0) = 0 then
    return json_build_object('ok', true, 'rien', true);
  end if;
  select string_agg(x.ligne, E'\n')
    into lignes
  from (
    select c.nom || ' · ' || to_char(u.date_peremption, 'DD/MM/YYYY')
      || coalesce(' · ' || public.stock_lieu_chemin(u.lieu_id), '') as ligne
    from public.stock_unites u
    join public.stock_catalogue c on c.id = u.catalogue_id
    where u.etat = 'dispo' and coalesce(u.qte_restante, 0) > 0
      and u.date_peremption is not null
      and u.date_peremption <= current_date + 15
    order by u.date_peremption, c.nom
    limit 12
  ) x;
  perform public.notifier_evenement(
    'peremption_stock',
    'Alertes de péremption',
    trim(both E'\n' from
      case when n_perimes > 0 then n_perimes::text || ' lot(s) périmé(s). ' else '' end ||
      case when n_j15 > 0 then n_j15::text || ' lot(s) à ≤ 15 jours. ' else '' end ||
      case when n_proches > 0 then n_proches::text || ' lot(s) à ≤ 90 jours.' else '' end
    ) || coalesce(E'\n' || lignes, ''),
    '/app/stock',
    case when n_perimes > 0 or n_j15 > 0 then 'haute' else 'normale' end,
    null,
    null,
    jsonb_build_object('jour', current_date)
  );
  return json_build_object('ok', true, 'perimes', n_perimes, 'j15', n_j15, 'proches', n_proches);
end
$$;
grant execute on function public.notifier_peremptions_stock() to authenticated, service_role;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'stock_unites'
  ) then
    execute 'alter publication supabase_realtime add table public.stock_unites';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'stock_catalogue'
  ) then
    execute 'alter publication supabase_realtime add table public.stock_catalogue';
  end if;
exception when undefined_object then
  null;
end $$;

notify pgrst, 'reload schema';
