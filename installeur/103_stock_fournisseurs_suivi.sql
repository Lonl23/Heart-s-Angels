-- Fournisseurs : plusieurs contacts, sites de commande, articles liés.
-- Commandes : suivi, documents, garantie du matériel (pas des consommables).

alter table public.stock_catalogue
  add column if not exists nature text;

update public.stock_catalogue
set nature = case
  when mode in ('durable', 'oxygene') then 'materiel'
  else 'consommable'
end
where nature is null;

alter table public.stock_catalogue drop constraint if exists stock_catalogue_nature_chk;
alter table public.stock_catalogue
  add constraint stock_catalogue_nature_chk
  check (nature is null or nature in ('materiel', 'consommable'));

alter table public.stock_commandes
  add column if not exists garantie_debut date,
  add column if not exists garantie_fin date,
  add column if not exists garantie_notes text;

create table if not exists public.stock_fournisseur_contacts (
  id              uuid primary key default gen_random_uuid(),
  fournisseur_id  uuid not null references public.stock_fournisseurs(id) on delete cascade,
  prenom          text,
  nom             text,
  telephone       text,
  email           text,
  ordre           int default 0,
  created_at      timestamptz default now()
);

insert into public.stock_fournisseur_contacts (fournisseur_id, nom, telephone, email, ordre)
select f.id, nullif(trim(f.contact), ''), nullif(trim(f.telephone), ''), nullif(trim(f.email), ''), 0
from public.stock_fournisseurs f
where (coalesce(trim(f.contact), '') <> '' or coalesce(trim(f.telephone), '') <> '' or coalesce(trim(f.email), '') <> '')
  and not exists (
    select 1 from public.stock_fournisseur_contacts c where c.fournisseur_id = f.id
  );

create table if not exists public.stock_fournisseur_acces (
  id              uuid primary key default gen_random_uuid(),
  fournisseur_id  uuid not null references public.stock_fournisseurs(id) on delete cascade,
  libelle         text not null,
  url             text,
  identifiant     text,
  mot_de_passe    text,
  notes           text,
  created_at      timestamptz default now()
);

create table if not exists public.stock_commande_suivi (
  id            uuid primary key default gen_random_uuid(),
  commande_id   uuid not null references public.stock_commandes(id) on delete cascade,
  texte         text not null,
  par           uuid references public.profiles(id) on delete set null,
  created_at    timestamptz default now()
);

create table if not exists public.stock_commande_documents (
  id            uuid primary key default gen_random_uuid(),
  commande_id   uuid not null references public.stock_commandes(id) on delete cascade,
  type          text not null default 'autre',
  nom           text,
  path          text not null,
  mime          text,
  taille        int,
  ajoute_le     timestamptz default now(),
  constraint stock_commande_documents_type_chk
    check (type in ('bon', 'facture', 'livraison', 'garantie', 'autre'))
);

create index if not exists stock_fournisseur_contacts_f_idx on public.stock_fournisseur_contacts(fournisseur_id);
create index if not exists stock_fournisseur_acces_f_idx on public.stock_fournisseur_acces(fournisseur_id);
create index if not exists stock_commande_suivi_c_idx on public.stock_commande_suivi(commande_id, created_at);
create index if not exists stock_commande_documents_c_idx on public.stock_commande_documents(commande_id);

alter table public.stock_fournisseur_contacts enable row level security;
alter table public.stock_fournisseur_acces enable row level security;
alter table public.stock_commande_suivi enable row level security;
alter table public.stock_commande_documents enable row level security;

drop policy if exists stock_contacts_read on public.stock_fournisseur_contacts;
drop policy if exists stock_contacts_write on public.stock_fournisseur_contacts;
create policy stock_contacts_read on public.stock_fournisseur_contacts
  for select to authenticated using (public.is_staff());
create policy stock_contacts_write on public.stock_fournisseur_contacts
  for all to authenticated
  using (public.is_staff() and public.peut_gerer_stock())
  with check (public.is_staff() and public.peut_gerer_stock());

-- Identifiants des sites : équipe logistique seulement. Pas dans l’export Excel.
drop policy if exists stock_acces_all on public.stock_fournisseur_acces;
create policy stock_acces_all on public.stock_fournisseur_acces
  for all to authenticated
  using (public.is_staff() and public.peut_gerer_stock())
  with check (public.is_staff() and public.peut_gerer_stock());

drop policy if exists stock_suivi_all on public.stock_commande_suivi;
create policy stock_suivi_all on public.stock_commande_suivi
  for all to authenticated
  using (public.is_staff() and public.peut_gerer_stock())
  with check (public.is_staff() and public.peut_gerer_stock());

drop policy if exists stock_cmd_docs_all on public.stock_commande_documents;
create policy stock_cmd_docs_all on public.stock_commande_documents
  for all to authenticated
  using (public.is_staff() and public.peut_gerer_stock())
  with check (public.is_staff() and public.peut_gerer_stock());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'stock-commandes',
  'stock-commandes',
  false,
  15728640,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists stock_commandes_docs_select on storage.objects;
drop policy if exists stock_commandes_docs_insert on storage.objects;
drop policy if exists stock_commandes_docs_update on storage.objects;
drop policy if exists stock_commandes_docs_delete on storage.objects;

create policy stock_commandes_docs_select on storage.objects
  for select to authenticated
  using (bucket_id = 'stock-commandes' and public.is_staff() and public.peut_gerer_stock());

create policy stock_commandes_docs_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'stock-commandes' and public.is_staff() and public.peut_gerer_stock());

create policy stock_commandes_docs_update on storage.objects
  for update to authenticated
  using (bucket_id = 'stock-commandes' and public.is_staff() and public.peut_gerer_stock())
  with check (bucket_id = 'stock-commandes' and public.is_staff() and public.peut_gerer_stock());

create policy stock_commandes_docs_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'stock-commandes' and public.is_staff() and public.peut_gerer_stock());

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
      'id', c.id, 'nom', c.nom, 'mode', c.mode, 'nature', c.nature, 'categorie', c.categorie,
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

  return json_build_object(
    'ok', true,
    'lieux', lieux, 'articles', articles, 'unites', unites,
    'fournisseurs', fournisseurs, 'commandes', commandes, 'mouvements', mouvements
  );
end $$;

grant execute on function public.stock_export() to authenticated;

notify pgrst, 'reload schema';
