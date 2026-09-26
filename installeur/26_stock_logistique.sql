-- ════════════════════════════════════════════════════════════════════════════
--  Stock logistique complet : photo article, fournisseurs, journal des
--  mouvements, transferts, péremption, rappels de commande.
--  Idempotent. Après 25_statut_base_personnel.sql.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Colonnes catalogue ─────────────────────────────────────────────────────
alter table public.stock_catalogue
  add column if not exists photo_path text,
  add column if not exists fournisseur_id uuid,
  add column if not exists ref_fournisseur text,
  add column if not exists delai_reappro int;

alter table public.stock_mouvements
  add column if not exists lieu_origine_id uuid references public.stock_lieux(id) on delete set null,
  add column if not exists fournisseur_id uuid;

create index if not exists stock_mouvements_created_idx on public.stock_mouvements(created_at desc);
create index if not exists stock_mouvements_type_idx on public.stock_mouvements(type);

-- ── Fournisseurs ───────────────────────────────────────────────────────────
create table if not exists public.stock_fournisseurs (
  id          uuid primary key default gen_random_uuid(),
  nom         text not null,
  contact     text,
  telephone   text,
  email       text,
  adresse     text,
  notes       text,
  actif       boolean default true,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
drop trigger if exists trg_stock_fournisseurs_updated on public.stock_fournisseurs;
create trigger trg_stock_fournisseurs_updated before update on public.stock_fournisseurs
  for each row execute function public.set_updated_at();

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'stock_catalogue_fournisseur_fk'
  ) then
    alter table public.stock_catalogue
      add constraint stock_catalogue_fournisseur_fk
      foreign key (fournisseur_id) references public.stock_fournisseurs(id) on delete set null;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'stock_mouvements_fournisseur_fk'
  ) then
    alter table public.stock_mouvements
      add constraint stock_mouvements_fournisseur_fk
      foreign key (fournisseur_id) references public.stock_fournisseurs(id) on delete set null;
  end if;
end $$;

-- ── Commandes / rappels ────────────────────────────────────────────────────
create table if not exists public.stock_commandes (
  id              uuid primary key default gen_random_uuid(),
  catalogue_id    uuid not null references public.stock_catalogue(id) on delete restrict,
  fournisseur_id  uuid references public.stock_fournisseurs(id) on delete set null,
  quantite        numeric not null default 1,
  statut          text not null default 'a_commander',
  -- a_commander | commandee | recue | annulee
  date_rappel     date,
  date_commande   date,
  notes           text,
  par             uuid references public.profiles(id) on delete set null,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
create index if not exists stock_commandes_statut_idx on public.stock_commandes(statut);
create index if not exists stock_commandes_rappel_idx on public.stock_commandes(date_rappel)
  where statut = 'a_commander';
drop trigger if exists trg_stock_commandes_updated on public.stock_commandes;
create trigger trg_stock_commandes_updated before update on public.stock_commandes
  for each row execute function public.set_updated_at();

alter table public.stock_fournisseurs enable row level security;
alter table public.stock_commandes enable row level security;

drop policy if exists stock_fournisseurs_write on public.stock_fournisseurs;
create policy stock_fournisseurs_write on public.stock_fournisseurs for all to authenticated
  using (public.is_staff() and public.peut_gerer_stock())
  with check (public.is_staff() and public.peut_gerer_stock());
drop policy if exists stock_fournisseurs_read on public.stock_fournisseurs;
create policy stock_fournisseurs_read on public.stock_fournisseurs for select to authenticated
  using (public.is_staff());

drop policy if exists stock_commandes_write on public.stock_commandes;
create policy stock_commandes_write on public.stock_commandes for all to authenticated
  using (public.is_staff() and public.peut_gerer_stock())
  with check (public.is_staff() and public.peut_gerer_stock());
drop policy if exists stock_commandes_read on public.stock_commandes;
create policy stock_commandes_read on public.stock_commandes for select to authenticated
  using (public.is_staff());

-- ── Photos articles (bucket privé) ─────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'stock-photos',
  'stock-photos',
  false,
  5242880,
  array['image/jpeg','image/png','image/webp','image/heic','image/heif']
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists stock_photos_select on storage.objects;
drop policy if exists stock_photos_insert on storage.objects;
drop policy if exists stock_photos_update on storage.objects;
drop policy if exists stock_photos_delete on storage.objects;

create policy stock_photos_select on storage.objects for select to authenticated
  using (bucket_id = 'stock-photos' and public.is_staff());
create policy stock_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'stock-photos' and public.peut_gerer_stock());
create policy stock_photos_update on storage.objects for update to authenticated
  using (bucket_id = 'stock-photos' and public.peut_gerer_stock());
create policy stock_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'stock-photos' and public.peut_gerer_stock());

-- ── JSON unité : photo du type ─────────────────────────────────────────────
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
    'volume_l', coalesce(u.volume_l, c.volume_l),
    'pression_bar', u.pression_bar,
    'pression_pleine', coalesce(u.pression_pleine, 200),
    'capacite_l', round(coalesce(u.volume_l, c.volume_l, 0) * coalesce(u.pression_bar, 0), 1)
  )
$$;

-- ── Journal des mouvements ─────────────────────────────────────────────────
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
           u.lot, u.qr_token
    from public.stock_mouvements m
    left join public.stock_catalogue c on c.id = m.catalogue_id
    left join public.stock_lieux l on l.id = m.lieu_id
    left join public.stock_lieux lo on lo.id = m.lieu_origine_id
    left join public.stock_fournisseurs f on f.id = m.fournisseur_id
    left join public.profiles p on p.id = m.par
    left join public.stock_unites u on u.id = m.unite_id
    where (p_type is null or m.type = p_type)
      and (p_catalogue is null or m.catalogue_id = p_catalogue)
    order by m.created_at desc
    limit n
  ) x;
  return json_build_object('ok', true, 'items', items);
end $$;
grant execute on function public.stock_journal(int, text, uuid) to authenticated;

-- ── Transfert d'une unité ──────────────────────────────────────────────────
create or replace function public.stock_transfert(
  p_unite uuid,
  p_lieu uuid,
  p_motif text default null
)
returns json language plpgsql security definer set search_path = public as $$
declare
  u public.stock_unites;
  c public.stock_catalogue;
  l public.stock_lieux;
  orig uuid;
begin
  if not public.peut_gerer_stock() then
    return json_build_object('ok', false, 'error', 'réservé à la logistique');
  end if;
  select * into u from public.stock_unites where id = p_unite;
  if not found then return json_build_object('ok', false, 'error', 'article inconnu'); end if;
  if p_lieu is not null then
    select * into l from public.stock_lieux where id = p_lieu and actif;
    if not found then return json_build_object('ok', false, 'error', 'lieu inconnu'); end if;
  else
    l := null;
  end if;
  orig := u.lieu_id;
  if orig is not distinct from p_lieu then
    return json_build_object('ok', false, 'error', 'déjà à cet emplacement');
  end if;
  update public.stock_unites set lieu_id = p_lieu where id = u.id;
  insert into public.stock_mouvements(type, quantite, motif, par, unite_id, lieu_id, lieu_origine_id, catalogue_id)
    values ('transfert', u.qte_restante, coalesce(nullif(trim(p_motif), ''), 'transfert de stock'),
            auth.uid(), u.id, p_lieu, orig, u.catalogue_id);
  select * into u from public.stock_unites where id = u.id;
  select * into c from public.stock_catalogue where id = u.catalogue_id;
  select * into l from public.stock_lieux where id = u.lieu_id;
  return json_build_object('ok', true, 'unite', public._stock_unite_json(u, c, l));
end $$;
grant execute on function public.stock_transfert(uuid, uuid, text) to authenticated;

-- ── Sortie manuelle (perte, casse, don, destruction) ───────────────────────
create or replace function public.stock_sortie_manuelle(
  p_unite uuid,
  p_qte numeric,
  p_motif text default null
)
returns json language plpgsql security definer set search_path = public as $$
declare
  u public.stock_unites;
  c public.stock_catalogue;
  l public.stock_lieux;
  q numeric;
  reste numeric;
begin
  if not public.peut_gerer_stock() then
    return json_build_object('ok', false, 'error', 'réservé à la logistique');
  end if;
  select * into u from public.stock_unites where id = p_unite;
  if not found then return json_build_object('ok', false, 'error', 'article inconnu'); end if;
  select * into c from public.stock_catalogue where id = u.catalogue_id;
  if u.etat in ('vide','consomme','perdu','perime') then
    return json_build_object('ok', false, 'error', 'article déjà sorti du stock disponible');
  end if;
  q := greatest(coalesce(p_qte, 1), 0);
  if q <= 0 then return json_build_object('ok', false, 'error', 'quantité invalide'); end if;
  if c.mode in ('piece','durable','oxygene') then q := u.qte_restante; end if;
  if q > u.qte_restante then q := u.qte_restante; end if;
  reste := u.qte_restante - q;
  update public.stock_unites
    set qte_restante = reste,
        etat = case
          when reste <= 0 then (case when c.mode = 'boite' then 'vide' else 'consomme' end)
          else 'dispo' end
    where id = u.id;
  insert into public.stock_mouvements(type, quantite, motif, par, unite_id, lieu_id, catalogue_id)
    values ('sortie', q, coalesce(nullif(trim(p_motif), ''), 'sortie manuelle'),
            auth.uid(), u.id, u.lieu_id, c.id);
  select * into u from public.stock_unites where id = u.id;
  select * into l from public.stock_lieux where id = u.lieu_id;
  return json_build_object('ok', true, 'unite', public._stock_unite_json(u, c, l));
end $$;
grant execute on function public.stock_sortie_manuelle(uuid, numeric, text) to authenticated;

-- ── Mise en péremption ─────────────────────────────────────────────────────
create or replace function public.stock_marquer_perime(
  p_unite uuid,
  p_motif text default null
)
returns json language plpgsql security definer set search_path = public as $$
declare
  u public.stock_unites;
  c public.stock_catalogue;
  l public.stock_lieux;
begin
  if not public.peut_gerer_stock() then
    return json_build_object('ok', false, 'error', 'réservé à la logistique');
  end if;
  select * into u from public.stock_unites where id = p_unite;
  if not found then return json_build_object('ok', false, 'error', 'article inconnu'); end if;
  if u.etat = 'perime' then
    return json_build_object('ok', false, 'error', 'déjà marqué périmé');
  end if;
  select * into c from public.stock_catalogue where id = u.catalogue_id;
  update public.stock_unites set etat = 'perime' where id = u.id;
  insert into public.stock_mouvements(type, quantite, motif, par, unite_id, lieu_id, catalogue_id)
    values ('peremption', u.qte_restante,
            coalesce(nullif(trim(p_motif), ''), 'mise en péremption'),
            auth.uid(), u.id, u.lieu_id, c.id);
  select * into u from public.stock_unites where id = u.id;
  select * into l from public.stock_lieux where id = u.lieu_id;
  return json_build_object('ok', true, 'unite', public._stock_unite_json(u, c, l));
end $$;
grant execute on function public.stock_marquer_perime(uuid, text) to authenticated;

-- ── Alertes + rappels de commande ──────────────────────────────────────────
create or replace function public.stock_alertes()
returns json language plpgsql stable security definer set search_path = public as $$
declare
  perimes json;
  proches json;
  vides json;
  bas json;
  o2 json;
  commandes json;
begin
  if not public.peut_gerer_stock() then
    return json_build_object('ok', false, 'error', 'réservé à la logistique');
  end if;
  select coalesce(json_agg(public._stock_unite_json(u, c, l)), '[]'::json) into perimes
  from public.stock_unites u
  join public.stock_catalogue c on c.id = u.catalogue_id
  left join public.stock_lieux l on l.id = u.lieu_id
  where u.etat = 'dispo'
    and u.date_peremption is not null and u.date_peremption < current_date;
  select coalesce(json_agg(public._stock_unite_json(u, c, l)), '[]'::json) into proches
  from public.stock_unites u
  join public.stock_catalogue c on c.id = u.catalogue_id
  left join public.stock_lieux l on l.id = u.lieu_id
  where u.etat = 'dispo'
    and u.date_peremption is not null
    and u.date_peremption >= current_date
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
  return json_build_object('ok', true, 'perimes', perimes, 'proches', proches,
    'vides', vides, 'bas', bas, 'o2_basse', o2, 'commandes', commandes);
end $$;
grant execute on function public.stock_alertes() to authenticated;

notify pgrst, 'reload schema';
