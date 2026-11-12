-- Fix création activité : compétences élargies (ATNUP/AMU/SIAMU/urgentiste).
-- DPS : adresse exacte + organisateur.
-- Accès responsables DPS.
-- Conventions DPS (montant + engagements).

-- ── Compétences autorisées ─────────────────────────────────────────
alter table public.activites_secours
  drop constraint if exists activites_secours_competences_connues;

alter table public.activites_secours
  drop constraint if exists activites_secours_nb_comp;

alter table public.activites_secours
  add constraint activites_secours_nb_comp check (cardinality(competences) <= 24);

alter table public.activites_secours
  add constraint activites_secours_competences_connues check (
    competences <@ array[
      'ambulancier', 'ambulancier_atnup', 'ambulancier_amu',
      'infirmier', 'infirmier_siamu',
      'medecin', 'medecin_urgentiste',
      'kine', 'psychologue', 'secouriste', 'chauffeur', 'autre',
      'medical', 'non_medical'
    ]::text[]
  );

-- ── Champs DPS sur l’activité ──────────────────────────────────────
alter table public.activites_secours
  add column if not exists adresse text;

alter table public.activites_secours
  add column if not exists organisateur_nom text;

alter table public.activites_secours
  add column if not exists organisateur_contact text;

alter table public.activites_secours
  drop constraint if exists activites_secours_adresse;

alter table public.activites_secours
  add constraint activites_secours_adresse
  check (adresse is null or char_length(adresse) <= 400);

alter table public.activites_secours
  drop constraint if exists activites_secours_orga_nom;

alter table public.activites_secours
  add constraint activites_secours_orga_nom
  check (organisateur_nom is null or char_length(btrim(organisateur_nom)) between 1 and 180);

alter table public.activites_secours
  drop constraint if exists activites_secours_orga_contact;

alter table public.activites_secours
  add constraint activites_secours_orga_contact
  check (organisateur_contact is null or char_length(organisateur_contact) <= 240);

comment on column public.activites_secours.adresse is
  'Adresse exacte du site DPS (pas seulement le libellé lieu).';
comment on column public.activites_secours.organisateur_nom is
  'Nom de l’organisateur / bénéficiaire de la convention DPS.';
comment on column public.activites_secours.organisateur_contact is
  'Contact organisateur (téléphone ou e-mail).';

-- ── Conventions DPS ────────────────────────────────────────────────
create table if not exists public.conventions_dps (
  id uuid primary key default gen_random_uuid(),
  numero integer generated always as identity,
  titre text not null,
  activite_id uuid references public.activites_secours(id) on delete set null,
  organisateur_nom text not null,
  organisateur_representant text,
  organisateur_adresse text,
  organisateur_contact text,
  manifestation_lieu text,
  manifestation_adresse text,
  manifestation_debut timestamptz,
  manifestation_fin timestamptz,
  type_dispositifs text[] not null default '{}'::text[],
  montant_eur numeric(12,2),
  devise text not null default 'EUR',
  engagements_asbl text,
  engagements_organisateur text,
  engagements_communs text,
  litiges text,
  statut text not null default 'brouillon',
  signe_le date,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conventions_dps_titre check (char_length(btrim(titre)) between 1 and 200),
  constraint conventions_dps_montant check (montant_eur is null or montant_eur >= 0),
  constraint conventions_dps_statut check (statut in ('brouillon', 'proposee', 'signee', 'annulee')),
  constraint conventions_dps_dispositifs check (
    type_dispositifs <@ array[
      'paps', 'ps', 'echo', 'pma_cat2', 'pma_cat1', 'pma_cat0', 'ambu_112', 'ambu'
    ]::text[]
  )
);

create index if not exists conventions_dps_activite_idx on public.conventions_dps (activite_id);
create index if not exists conventions_dps_statut_idx on public.conventions_dps (statut);

drop trigger if exists trg_conventions_dps_updated on public.conventions_dps;
create trigger trg_conventions_dps_updated
  before update on public.conventions_dps
  for each row execute function public.set_updated_at();

alter table public.activites_secours
  add column if not exists convention_id uuid references public.conventions_dps(id) on delete set null;

comment on table public.conventions_dps is
  'Conventions DPS : parties, prestations, montant, engagements ASBL / organisateur (réf. RN-DPS).';

-- ── Accès : responsables DPS ───────────────────────────────────────
create or replace function public.peut_creer_activite_secours()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select role::text as role, fiche
    from public.profiles
    where id = auth.uid()
  )
  select coalesce((
    select role in ('admin', 'president')
        or coalesce(
          fiche->'roles_asbl' ?| array[
            'president', 'vice_president',
            'resp_dps', 'resp_dps_adjoint'
          ],
          false
        )
    from me
  ), false)
$$;

revoke all on function public.peut_creer_activite_secours() from public, anon;
grant execute on function public.peut_creer_activite_secours() to authenticated, service_role;

alter table public.conventions_dps enable row level security;

drop policy if exists conventions_dps_select on public.conventions_dps;
drop policy if exists conventions_dps_insert on public.conventions_dps;
drop policy if exists conventions_dps_update on public.conventions_dps;
drop policy if exists conventions_dps_delete on public.conventions_dps;

create policy conventions_dps_select on public.conventions_dps
  for select to authenticated
  using (public.is_staff());

create policy conventions_dps_insert on public.conventions_dps
  for insert to authenticated
  with check (
    public.peut_creer_activite_secours()
    and (created_by is null or created_by = auth.uid())
  );

create policy conventions_dps_update on public.conventions_dps
  for update to authenticated
  using (public.peut_creer_activite_secours())
  with check (public.peut_creer_activite_secours());

create policy conventions_dps_delete on public.conventions_dps
  for delete to authenticated
  using (public.peut_creer_activite_secours());

grant select, insert, update, delete on table public.conventions_dps to authenticated, service_role;
revoke all on table public.conventions_dps from anon, public;

do $$
declare seq text;
begin
  select pg_get_serial_sequence('public.conventions_dps', 'numero') into seq;
  if seq is not null then
    execute format('revoke all on sequence %s from anon, public', seq);
    execute format('grant usage, select on sequence %s to authenticated, service_role', seq);
  end if;
end $$;

notify pgrst, 'reload schema';
