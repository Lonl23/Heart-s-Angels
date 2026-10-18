-- Entretien du matériel physique (batterie de défibrillateur, brancard…).
-- Un consommable n'a pas de dates d'entretien.

alter table public.stock_catalogue
  add column if not exists entretien_mois int;

alter table public.stock_catalogue drop constraint if exists stock_catalogue_entretien_mois_chk;
alter table public.stock_catalogue
  add constraint stock_catalogue_entretien_mois_chk
  check (entretien_mois is null or entretien_mois > 0);

comment on column public.stock_catalogue.entretien_mois is
  'Rythme conseillé, en mois. Vide : pas de rythme. Réservé au matériel.';

alter table public.stock_unites
  add column if not exists numero_serie text,
  add column if not exists mise_en_service date;

create table if not exists public.stock_unite_entretiens (
  id              uuid primary key default gen_random_uuid(),
  unite_id        uuid not null references public.stock_unites(id) on delete cascade,
  date_fait       date not null,
  date_prochain   date,
  type            text not null default 'controle',
  notes           text,
  document_nom    text,
  document_path   text,
  document_mime   text,
  par             uuid references public.profiles(id) on delete set null,
  created_at      timestamptz default now(),
  constraint stock_unite_entretiens_type_chk
    check (type in ('controle', 'remplacement', 'revision', 'etalonnage', 'mise_en_service', 'autre'))
);

create index if not exists stock_unite_entretiens_u_idx
  on public.stock_unite_entretiens (unite_id, date_fait desc);

create or replace function public.stock_entretien_reserve_materiel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  nat text;
  mode text;
begin
  select c.nature, c.mode into nat, mode
  from public.stock_unites u
  join public.stock_catalogue c on c.id = u.catalogue_id
  where u.id = new.unite_id;
  if nat is null and mode in ('durable', 'oxygene') then
    nat := 'materiel';
  end if;
  if nat is distinct from 'materiel' then
    raise exception 'entretien réservé au matériel';
  end if;
  return new;
end $$;

revoke all on function public.stock_entretien_reserve_materiel() from public, anon;

drop trigger if exists stock_unite_entretiens_materiel on public.stock_unite_entretiens;
create trigger stock_unite_entretiens_materiel
  before insert or update of unite_id on public.stock_unite_entretiens
  for each row execute function public.stock_entretien_reserve_materiel();

alter table public.stock_unite_entretiens enable row level security;

drop policy if exists stock_entretiens_read on public.stock_unite_entretiens;
drop policy if exists stock_entretiens_write on public.stock_unite_entretiens;
create policy stock_entretiens_read on public.stock_unite_entretiens
  for select to authenticated using (public.is_staff());
create policy stock_entretiens_write on public.stock_unite_entretiens
  for all to authenticated
  using (public.is_staff() and public.peut_gerer_stock())
  with check (public.is_staff() and public.peut_gerer_stock());

-- Alertes : prochain entretien dans les 30 jours, ou déjà passé.
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
  entretiens json;
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
  select coalesce(json_agg(json_build_object(
      'id', u.id, 'nom', c.nom, 'lot', u.lot, 'numero_serie', u.numero_serie,
      'photo_path', c.photo_path,
      'lieu_nom', l.nom,
      'lieu_chemin', coalesce(public.stock_lieu_chemin(u.lieu_id), l.nom),
      'date_fait', e.date_fait,
      'date_prochain', e.date_prochain,
      'type', e.type,
      'en_retard', e.date_prochain < current_date
    ) order by e.date_prochain, c.nom), '[]'::json) into entretiens
  from public.stock_unites u
  join public.stock_catalogue c on c.id = u.catalogue_id
  left join public.stock_lieux l on l.id = u.lieu_id
  join lateral (
    select date_fait, date_prochain, type
    from public.stock_unite_entretiens
    where unite_id = u.id
    order by date_fait desc, created_at desc
    limit 1
  ) e on true
  where u.etat = 'dispo'
    and e.date_prochain is not null
    and e.date_prochain <= current_date + 30
    and (c.nature = 'materiel' or (c.nature is null and c.mode in ('durable', 'oxygene')));
  return json_build_object('ok', true, 'perimes', perimes, 'proches_j15', proches_j15,
    'proches', proches, 'vides', vides, 'bas', bas, 'o2_basse', o2,
    'o2_bouteilles', o2_bouteilles, 'commandes', commandes, 'entretiens', entretiens);
end $$;

revoke all on function public.stock_alertes() from public, anon;
grant execute on function public.stock_alertes() to authenticated;

create or replace function public.stock_export()
returns json language plpgsql stable security definer set search_path = public as $$
declare
  lieux json;
  articles json;
  unites json;
  fournisseurs json;
  commandes json;
  mouvements json;
  entretiens json;
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
      'id', c.id, 'nom', c.nom, 'mode', c.mode, 'nature', c.nature, 'categorie', c.categorie,
      'unite', c.unite, 'qte_defaut', c.qte_defaut,
      'stock_minimal', c.stock_minimal, 'stock_minimal_sacs', c.stock_minimal_sacs,
      'volume_l', c.volume_l, 'ref_fournisseur', c.ref_fournisseur,
      'fournisseur', f.nom, 'fournisseur_id', c.fournisseur_id,
      'entretien_mois', c.entretien_mois
    ) order by c.nom), '[]'::json)
    into articles
  from public.stock_catalogue c
  left join public.stock_fournisseurs f on f.id = c.fournisseur_id
  where c.actif;

  select coalesce(json_agg(json_build_object(
      'id', u.id, 'qr', u.qr_token, 'article', c.nom, 'catalogue_id', c.id,
      'mode', c.mode, 'nature', c.nature, 'unite', c.unite, 'lot', u.lot,
      'dlc', u.date_peremption, 'etat', u.etat,
      'qte_initiale', u.qte_initiale, 'qte_restante', u.qte_restante,
      'pression_bar', u.pression_bar, 'volume_l', coalesce(u.volume_l, c.volume_l),
      'lieu_id', u.lieu_id, 'lieu', l.nom, 'notes', u.notes,
      'numero_serie', u.numero_serie, 'mise_en_service', u.mise_en_service,
      'entretien_dernier', (
        select max(e.date_fait) from public.stock_unite_entretiens e where e.unite_id = u.id
      ),
      'entretien_prochain', (
        select e.date_prochain from public.stock_unite_entretiens e
        where e.unite_id = u.id
        order by e.date_fait desc, e.created_at desc
        limit 1
      )
    ) order by c.nom, u.lot, u.created_at), '[]'::json)
    into unites
  from public.stock_unites u
  join public.stock_catalogue c on c.id = u.catalogue_id
  left join public.stock_lieux l on l.id = u.lieu_id;

  select coalesce(json_agg(json_build_object(
      'id', f.id, 'nom', f.nom, 'contact', f.contact, 'telephone', f.telephone,
      'email', f.email, 'adresse', f.adresse, 'notes', f.notes,
      'contacts', (
        select string_agg(
          trim(both ' · ' from concat_ws(' · ',
            nullif(trim(concat_ws(' ', ct.prenom, ct.nom)), ''),
            nullif(trim(ct.telephone), ''),
            nullif(trim(ct.email), '')
          )),
          ' | ' order by ct.ordre, ct.created_at
        )
        from public.stock_fournisseur_contacts ct
        where ct.fournisseur_id = f.id
      )
    ) order by f.nom), '[]'::json)
    into fournisseurs
  from public.stock_fournisseurs f
  where f.actif;

  select coalesce(json_agg(json_build_object(
      'id', cmd.id, 'article', c.nom, 'fournisseur', f.nom,
      'quantite', cmd.quantite, 'statut', cmd.statut,
      'date_rappel', cmd.date_rappel, 'date_commande', cmd.date_commande,
      'notes', cmd.notes,
      'garantie_debut', cmd.garantie_debut,
      'garantie_fin', cmd.garantie_fin,
      'garantie_notes', cmd.garantie_notes
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

  select coalesce(json_agg(json_build_object(
      'article', c.nom, 'numero_serie', u.numero_serie, 'lot', u.lot,
      'date_fait', e.date_fait, 'date_prochain', e.date_prochain,
      'type', e.type, 'notes', e.notes, 'document', e.document_nom
    ) order by e.date_fait desc, c.nom), '[]'::json)
    into entretiens
  from public.stock_unite_entretiens e
  join public.stock_unites u on u.id = e.unite_id
  join public.stock_catalogue c on c.id = u.catalogue_id;

  return json_build_object(
    'ok', true,
    'lieux', lieux, 'articles', articles, 'unites', unites,
    'fournisseurs', fournisseurs, 'commandes', commandes, 'mouvements', mouvements,
    'entretiens', entretiens
  );
end $$;

revoke all on function public.stock_export() from public, anon;
grant execute on function public.stock_export() to authenticated;

notify pgrst, 'reload schema';
