-- ════════════════════════════════════════════════════════════════════════════
--  Heart's Angels ASBL — RECONSTRUCTION BASE INTERNE
--  Périmètre : app interne SANS site public, SANS ventes/événements, SANS compta.
--  Reconstruit depuis l'historique de développement. À exécuter en premier,
--  puis "acces_partenaire.sql". Idempotent autant que possible.
--  ⚠️ Si l'ancienne base existe encore, préférez un dump (voir README).
-- ════════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ════════════════════════════════ TYPES ÉNUMÉRÉS ═══════════════════════════════
do $$ begin
  create type role_utilisateur as enum (
    'admin','president','coordinateur','ambulancier_bleu','ambulancier_gris',
    'infirmier','medecin','volontaire_non_medical','tresorier','secretaire',
    'partenaire'   -- NOUVEAU : accès partenaire
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type statut_souhait as enum ('en_attente','planifie','en_cours','realise','annule','urgent');
exception when duplicate_object then null; end $$;

do $$ begin
  create type statut_defraiement as enum ('en_attente','approuve_n1','approuve_n2','refuse','paye');
exception when duplicate_object then null; end $$;

do $$ begin
  create type categorie_defraiement as enum (
    'transport_km','carburant','repas','materiel_medical','materiel_logistique',
    'billets_entrees','hebergement','communication','autre'
  );
exception when duplicate_object then null; end $$;

-- ════════════════════════════ DOMAINE : CŒUR & AUTH ═══════════════════════════
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text,
  prenom        text,
  nom           text,
  telephone     text,
  role          role_utilisateur not null default 'volontaire_non_medical',
  matricule     text unique,
  photo_url     text,
  partenaire_id uuid,            -- comptes partenaires (FK ajoutée dans acces_partenaire.sql)
  doit_changer_mdp boolean default false,  -- interne : forcer le changement à la 1re connexion
  actif         boolean default true,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, prenom, nom)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'prenom',''),
          coalesce(new.raw_user_meta_data->>'nom',''))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.generer_matricule()
returns text language plpgsql as $$
declare n int;
begin
  select count(*) + 1 into n from public.profiles where matricule is not null;
  return 'HA-' || extract(year from now())::int || '-' || lpad(n::text, 4, '0');
end $$;

-- Rôles ASBL (référentiel de permissions, utilisé par l'organigramme / droits)
create table if not exists public.roles_asbl (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  label       text not null,
  description text,
  couleur     text default '#1BB0CE',
  categorie   text not null default 'benevole',   -- direction|medical|benevole|soutien|administratif
  permissions jsonb default '[]',
  ordre       integer default 0,
  actif       boolean default true,
  created_at  timestamptz default now()
);

-- Qualifications d'un membre (visa, INAMI, brevets…)
create table if not exists public.qualifications (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references public.profiles(id) on delete cascade,
  type_qual     text not null,   -- atnup|amu|inami|visa_infirmier|brevet_bleu|brevet_gris|autre
  numero        text not null,
  libelle       text,
  date_expiration date,
  actif         boolean default true,
  notes         text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
drop trigger if exists trg_qualifications_updated on public.qualifications;
create trigger trg_qualifications_updated before update on public.qualifications
  for each row execute function public.set_updated_at();

-- Volontaires (fiche opérationnelle, distincte du profil de connexion)
create table if not exists public.volontaires (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid references public.profiles(id) on delete set null,
  prenom          text not null,
  nom             text not null,
  email           text,
  telephone       text,
  date_naissance  date,
  adresse         text,
  type            text not null check (type in ('medical','non_medical')),
  qualification   text,
  numero_inami    text,
  diplomes        text[],
  actif           boolean default true,
  date_inscription date default current_date,
  date_fin        date,
  notes           text,
  consentement_rgpd boolean default false,
  consentement_date timestamptz,
  created_by      uuid references public.profiles(id),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  deleted_at      timestamptz
);
drop trigger if exists trg_volontaires_updated on public.volontaires;
create trigger trg_volontaires_updated before update on public.volontaires
  for each row execute function public.set_updated_at();

-- ════════════════════════════ DOMAINE : SOUHAITS ══════════════════════════════
-- Demande de souhait (formulaire externe public — et bientôt encodée par un partenaire)
create table if not exists public.demandes_souhaits (
  id                  uuid primary key default gen_random_uuid(),
  -- Patient
  patient_prenom      text not null,
  patient_nom         text not null,
  patient_ddn         date,
  etablissement       text,
  medecin_referent    text,
  -- Contact
  contact_prenom      text not null,
  contact_nom         text not null,
  contact_relation    text,
  contact_email       text not null,
  contact_telephone   text,
  -- Souhait
  souhait_description text not null,
  souhait_date        date,
  souhait_lieu        text,
  -- Médical
  mobilite            text,
  equipement_medical  text,
  allergies           text,
  urgence             boolean default false,
  -- Consentements RGPD
  consent_patient     boolean not null default false,
  consent_rgpd        boolean not null default false,
  -- Traitement interne
  statut              text default 'nouvelle'
                      check (statut in ('nouvelle','en_cours','acceptee','refusee','realisee')),
  assignee_a          uuid references public.profiles(id),
  notes_internes      text,
  souhait_id          uuid,     -- lien vers le souhait créé (FK ajoutée après souhaits)
  langue              text default 'fr',
  ip_hash             text,
  created_at          timestamptz default now()
);

-- Souhait accepté (données de santé — accès restreint)
create table if not exists public.souhaits (
  id                  uuid primary key default gen_random_uuid(),
  beneficiaire_nom    text not null,
  beneficiaire_prenom text not null,
  beneficiaire_ddn    date,
  beneficiaire_contact text,
  description         text not null,
  localisation        text,
  notes_medicales     text,
  besoins_specifiques text,
  date_souhaitee      date,
  date_realisee       date,
  heure_depart        time,
  heure_retour        time,
  statut              statut_souhait not null default 'en_attente',
  priorite            smallint default 2 check (priorite between 1 and 5),
  coordinateur_id     uuid references public.profiles(id) on delete set null,
  budget_estime       decimal(10,2),
  budget_reel         decimal(10,2),
  created_by          uuid references public.profiles(id),
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);
drop trigger if exists trg_souhaits_updated on public.souhaits;
create trigger trg_souhaits_updated before update on public.souhaits
  for each row execute function public.set_updated_at();

-- FK de la demande vers le souhait créé
alter table public.demandes_souhaits drop constraint if exists demandes_souhait_fk;
alter table public.demandes_souhaits
  add constraint demandes_souhait_fk foreign key (souhait_id)
  references public.souhaits(id) on delete set null;

-- Dates proposées pour un souhait
create table if not exists public.souhait_dates (
  id                   uuid primary key default gen_random_uuid(),
  souhait_id           uuid references public.souhaits(id) on delete cascade,
  date_proposee        date,
  heure_depart         time,
  heure_retour_estimee time,
  note                 text,
  confirmee            boolean default false,
  created_at           timestamptz default now()
);

-- Affectation des volontaires à un souhait
create table if not exists public.souhait_personnel (
  id          uuid primary key default gen_random_uuid(),
  souhait_id  uuid not null references public.souhaits(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  role_mission text,
  confirme    boolean default false,
  created_at  timestamptz default now(),
  unique (souhait_id, user_id)
);

-- Suivi interne du souhait en cours (NON visible des partenaires)
create table if not exists public.souhait_suivi (
  id          uuid primary key default gen_random_uuid(),
  souhait_id  uuid not null references public.souhaits(id) on delete cascade,
  profile_id  uuid references public.profiles(id),
  date_contact timestamptz default now(),
  type_contact text not null,   -- appel|visite|rencontre_beneficiaire|validation|note|modification
  contenu     text not null,
  created_at  timestamptz default now()
);

-- Rapport(s) de fin de souhait (visible du partenaire une fois publié — voir acces_partenaire.sql)
create table if not exists public.souhait_rapports (
  id           uuid primary key default gen_random_uuid(),
  souhait_id   uuid references public.souhaits(id) on delete cascade,
  profile_id   uuid,
  auteur_nom   text,
  role_auteur  text,
  deroulement  text,
  etat_patient text,
  incidents    text,
  observations text,
  publie       boolean default false,   -- NOUVEAU : contrôle la visibilité partenaire
  publie_le    timestamptz,
  created_at   timestamptz default now()
);

-- ════════════════════════════ DOMAINE : DÉFRAIEMENTS ══════════════════════════
create table if not exists public.defraiements (
  id              uuid primary key default gen_random_uuid(),
  numero          text,
  volontaire_id   uuid references public.volontaires(id),
  user_id         uuid references public.profiles(id),
  date_frais      date not null,
  categorie       categorie_defraiement not null,
  description     text not null,
  montant         decimal(10,2) not null check (montant > 0),
  km              decimal(8,1),
  taux_km         decimal(4,3) default 0.4201,   -- taux officiel belge 2026 (€/km)
  montant_km      decimal(10,2) generated always as (
                    case when km is not null then km * taux_km else null end) stored,
  justificatif_url text,
  souhait_id      uuid references public.souhaits(id) on delete set null,
  statut          statut_defraiement default 'en_attente',
  valide_n1_par   uuid references public.profiles(id),
  valide_n1_a     timestamptz,
  note_n1         text,
  valide_n2_par   uuid references public.profiles(id),
  valide_n2_a     timestamptz,
  note_n2         text,
  paye_a          timestamptz,
  reference_paiement text,
  created_at      timestamptz default now()
);

-- Numérotation auto : MATRICULE-YYYYMMDD-NNN
create or replace function public.generer_numero_defraiement(p_user uuid, p_date date)
returns text language plpgsql as $$
declare
  v_matricule text;
  v_compteur  int;
  v_jour      text := to_char(p_date, 'YYYYMMDD');
begin
  select coalesce(matricule, 'V0000') into v_matricule from public.profiles where id = p_user;
  select count(*) into v_compteur from public.defraiements
    where user_id = p_user and numero like v_matricule || '-' || v_jour || '-%';
  return v_matricule || '-' || v_jour || '-' || lpad((v_compteur + 1)::text, 3, '0');
end $$;

create or replace function public.set_numero_defraiement()
returns trigger language plpgsql as $$
begin
  if new.numero is null and new.user_id is not null then
    new.numero := public.generer_numero_defraiement(new.user_id, new.date_frais);
  end if;
  return new;
end $$;
drop trigger if exists trg_numero_defraiement on public.defraiements;
create trigger trg_numero_defraiement before insert on public.defraiements
  for each row execute function public.set_numero_defraiement();

-- ════════════════════════════ DOMAINE : DISPONIBILITÉS ════════════════════════
create table if not exists public.disponibilites (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  date_debut    date not null,
  date_fin      date not null,
  qualification text not null,
  demi_journee  text default 'journee_complete'
                check (demi_journee in ('matin','apres_midi','journee_complete')),
  commentaire   text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  constraint dates_coherentes check (date_fin >= date_debut)
);
drop trigger if exists trg_disponibilites_updated on public.disponibilites;
create trigger trg_disponibilites_updated before update on public.disponibilites
  for each row execute function public.set_updated_at();

-- ════════════════════════════ DOMAINE : STOCK ═════════════════════════════════
create table if not exists public.stock_materiel (
  id              uuid primary key default gen_random_uuid(),
  nom             text not null,
  categorie       text,
  fournisseur     text,
  quantite        numeric default 0,
  stock_minimal   numeric default 0,
  unite           text default 'pièce',
  prix_unitaire   numeric default 0,
  prix_est_ht     boolean default true,
  tva_taux        numeric default 21,
  date_achat      date,
  date_peremption date,
  emplacement     text,
  notes           text,
  alerte_envoyee  boolean default false,
  actif           boolean default true,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
drop trigger if exists trg_stock_updated on public.stock_materiel;
create trigger trg_stock_updated before update on public.stock_materiel
  for each row execute function public.set_updated_at();

create table if not exists public.stock_mouvements (
  id          uuid primary key default gen_random_uuid(),
  materiel_id uuid references public.stock_materiel(id) on delete cascade,
  type        text not null,   -- entree|sortie|ajustement
  quantite    numeric not null,
  motif       text,
  par         uuid references public.profiles(id),
  created_at  timestamptz default now()
);

-- Fonction d'application d'un mouvement (à BRANCHER seulement si le module ne
-- met PAS déjà à jour stock_materiel.quantite lui-même — sinon double comptage).
create or replace function public.appliquer_mouvement_stock()
returns trigger language plpgsql as $$
begin
  if new.type = 'entree' then
    update public.stock_materiel set quantite = coalesce(quantite,0) + new.quantite, updated_at = now() where id = new.materiel_id;
  elsif new.type = 'sortie' then
    update public.stock_materiel set quantite = coalesce(quantite,0) - new.quantite, updated_at = now() where id = new.materiel_id;
  elsif new.type = 'ajustement' then
    update public.stock_materiel set quantite = new.quantite, updated_at = now() where id = new.materiel_id;
  end if;
  return new;
end $$;
-- create trigger trg_mouvement_stock after insert on public.stock_mouvements
--   for each row execute function public.appliquer_mouvement_stock();

-- ════════════════════════════ DOMAINE : ANNUAIRE MÉDICAL ══════════════════════
create table if not exists public.annuaire_institutions (
  id          uuid primary key default gen_random_uuid(),
  nom         text not null,
  type        text,           -- hôpital, MR/MRS, domicile, clinique…
  adresse     text,
  telephone   text,
  email       text,
  note        text,
  created_at  timestamptz default now(),
  created_by  uuid
);

create table if not exists public.annuaire_contacts (
  id              uuid primary key default gen_random_uuid(),
  categorie       text not null,   -- medecin|infirmier|beneficiaire|accompagnant|institution|autre
  prenom          text,
  nom             text,
  telephone       text,
  email           text,
  note            text,
  institution_id  uuid references public.annuaire_institutions(id) on delete set null,
  -- médecin
  specialite      text,
  inami           text,
  -- bénéficiaire (secret médical)
  date_naissance  date,
  adresse         text,
  pathologie      text,
  medecin_id      uuid references public.annuaire_contacts(id) on delete set null,
  infirmier_id    uuid references public.annuaire_contacts(id) on delete set null,
  -- accompagnant
  beneficiaire_id uuid references public.annuaire_contacts(id) on delete cascade,
  lien            text,
  created_at      timestamptz default now(),
  created_by      uuid
);

-- ════════════════════════════ DOMAINE : DIVERS ════════════════════════════════
create table if not exists public.notifications (
  id              uuid primary key default gen_random_uuid(),
  destinataire_id uuid references public.profiles(id) on delete cascade,
  expediteur_id   uuid references public.profiles(id) on delete set null,
  type            text default 'info',      -- defraiement|souhait|info|systeme
  titre           text not null,
  message         text,
  lien            text,
  priorite        text default 'normale',   -- haute|normale|basse
  lu              boolean default false,
  lu_a            timestamptz,
  created_at      timestamptz default now()
);

-- Configuration des formulaires (dont le formulaire de demande de souhait externe)
create table if not exists public.formulaires_config (
  cle             text primary key,   -- 'souhait' | 'contact' | 'benevole' …
  titre           text,
  champs          jsonb default '{}'::jsonb,
  champs_libres   jsonb default '[]'::jsonb,
  destinataires   text[] default '{}',
  updated_at      timestamptz default now()
);

-- ════════════════════════════ DROITS ══════════════════════════════════════════
-- Les utilisateurs internes sont TOUJOURS connectés → on donne les droits au
-- rôle "authenticated" (jamais "anon", qui est la clé publique du bundle).
-- Le RLS fin (dont l'isolation des partenaires et le seul accès anonyme —
-- l'insertion du formulaire de demande externe) est posé dans "acces_partenaire.sql".
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to authenticated, service_role;
grant all on all sequences in schema public to authenticated, service_role;
alter default privileges in schema public grant all on tables to authenticated, service_role;

notify pgrst, 'reload schema';
