-- ════════════════════════════════════════════════════════════════════════════
--  Annuaire bénéficiaires : NISS, genre, GSM / fixe, contacts rattachés.
--  Idempotent. Après 27_stock_excel.sql.
--  Table vive : public.annuaire (utilisée par l’app). Colonnes miroir sur
--  public.annuaire_contacts (schéma d’origine) pour les installs fraîches.
--  Personnel uniquement (is_staff). Pas de NISS côté partenaire / anon.
-- ════════════════════════════════════════════════════════════════════════════

-- Table utilisée par l’interface (absente de 01_rebuild_interne.sql).
create table if not exists public.annuaire (
  id              uuid primary key default gen_random_uuid(),
  categorie       text not null,
  nom             text,
  prenom          text,
  beneficiaire_id uuid references public.annuaire(id) on delete cascade,
  institution_id  uuid references public.annuaire(id) on delete set null,
  data            jsonb default '{}'::jsonb,
  created_at      timestamptz default now(),
  created_by      uuid references public.profiles(id)
);
create index if not exists annuaire_cat_idx on public.annuaire (categorie);
create index if not exists annuaire_benef_idx on public.annuaire (beneficiaire_id);

alter table public.annuaire
  add column if not exists niss            text,
  add column if not exists tel_gsm         text,
  add column if not exists tel_fixe        text,
  add column if not exists genre           text,
  add column if not exists date_naissance  date,
  add column if not exists telephone       text,
  add column if not exists lien            text;

alter table public.annuaire_contacts
  add column if not exists niss            text,
  add column if not exists tel_gsm         text,
  add column if not exists tel_fixe        text,
  add column if not exists genre           text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'annuaire_genre_chk') then
    alter table public.annuaire
      add constraint annuaire_genre_chk
      check (genre is null or genre in ('homme','femme','autre'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'annuaire_contacts_genre_chk') then
    alter table public.annuaire_contacts
      add constraint annuaire_contacts_genre_chk
      check (genre is null or genre in ('homme','femme','autre'));
  end if;
end $$;

-- NISS unique parmi les bénéficiaires (chiffres déjà normalisés côté app).
create unique index if not exists annuaire_benef_niss_uidx
  on public.annuaire (niss)
  where categorie = 'beneficiaire' and niss is not null and length(btrim(niss)) > 0;

create index if not exists annuaire_benef_identite_idx
  on public.annuaire (categorie, lower(nom), lower(prenom), date_naissance)
  where categorie = 'beneficiaire';

-- Souhait : lien vers la fiche annuaire + champs d’identité (personnel).
alter table public.souhaits
  add column if not exists beneficiaire_annuaire_id uuid references public.annuaire(id) on delete set null,
  add column if not exists beneficiaire_niss        text,
  add column if not exists beneficiaire_genre       text,
  add column if not exists beneficiaire_tel_gsm     text,
  add column if not exists beneficiaire_tel_fixe    text,
  add column if not exists beneficiaire_adresse     jsonb;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'souhaits_beneficiaire_genre_chk') then
    alter table public.souhaits
      add constraint souhaits_beneficiaire_genre_chk
      check (beneficiaire_genre is null or beneficiaire_genre in ('homme','femme','autre'));
  end if;
end $$;

create index if not exists souhaits_annuaire_idx
  on public.souhaits (beneficiaire_annuaire_id);

-- Demandes (partenaire / public) : identité sans numéro national.
alter table public.demandes_souhaits
  add column if not exists patient_genre     text,
  add column if not exists patient_tel_gsm   text,
  add column if not exists patient_tel_fixe  text,
  add column if not exists patient_adresse   jsonb,
  add column if not exists contact_tel_fixe  text,
  add column if not exists contact_ddn       date,
  add column if not exists contact_adresse   jsonb;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'demandes_patient_genre_chk') then
    alter table public.demandes_souhaits
      add constraint demandes_patient_genre_chk
      check (patient_genre is null or patient_genre in ('homme','femme','autre'));
  end if;
end $$;

alter table public.annuaire enable row level security;
drop policy if exists annuaire_staff on public.annuaire;
create policy annuaire_staff on public.annuaire
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

alter table public.annuaire_contacts enable row level security;
drop policy if exists annuaire_contacts_staff_all on public.annuaire_contacts;
create policy annuaire_contacts_staff_all on public.annuaire_contacts
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

grant select, insert, update, delete on public.annuaire to authenticated, service_role;

notify pgrst, 'reload schema';
