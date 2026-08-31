-- ════════════════════════════════════════════════════════════════════════════
--  Heart's Angels ASBL — ACCÈS PARTENAIRE + SÉCURITÉ (RLS)
--  À exécuter APRÈS rebuild_interne.sql.
--  Ajoute : organisations partenaires, rattachement des comptes, encodage de
--  demandes + médicaments par un partenaire, et surtout l'ISOLATION par RLS :
--   • un partenaire ne voit QUE ses propres demandes,
--   • il NE voit PAS le souhait en cours ni le suivi,
--   • il voit le rapport final UNIQUEMENT une fois publié.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Organisations partenaires ────────────────────────────────────────────────
create table if not exists public.partenaires (
  id            uuid primary key default gen_random_uuid(),
  nom           text not null,
  type          text check (type in ('hopital','maison_repos','soins_palliatifs','domicile','institution','autre')),
  adresse       text,
  ville         text,
  contact_nom   text,
  contact_email text,
  contact_tel   text,
  actif         boolean default true,
  notes         text,          -- interne, non visible du partenaire
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
drop trigger if exists trg_partenaires_updated on public.partenaires;
create trigger trg_partenaires_updated before update on public.partenaires
  for each row execute function public.set_updated_at();

-- Rattachement compte ↔ organisation
alter table public.profiles drop constraint if exists profiles_partenaire_fk;
alter table public.profiles
  add constraint profiles_partenaire_fk foreign key (partenaire_id)
  references public.partenaires(id) on delete set null;

-- ── Colonnes ajoutées à la demande pour l'encodage partenaire ────────────────
alter table public.demandes_souhaits
  add column if not exists partenaire_id uuid references public.partenaires(id) on delete set null,
  add column if not exists cree_par      uuid references public.profiles(id),
  add column if not exists source        text default 'externe' check (source in ('externe','partenaire','interne'));

-- ── Programmation des médicaments (complétée par le partenaire) ───────────────
create table if not exists public.souhait_medicaments (
  id          uuid primary key default gen_random_uuid(),
  demande_id  uuid not null references public.demandes_souhaits(id) on delete cascade,
  medicament  text not null,
  dosage      text,
  voie        text,             -- orale / IV / sous-cutanée…
  frequence   text,             -- ex : « 3x/jour »
  horaires    jsonb,            -- ex : ["08:00","13:00","20:00"]
  a_prevoir   boolean default true,
  notes       text,
  ordre       int default 0,
  created_at  timestamptz default now()
);
create index if not exists souhait_medicaments_demande_idx on public.souhait_medicaments(demande_id);

-- ════════════════════════════ FONCTIONS DE SÉCURITÉ ═══════════════════════════
create or replace function public.is_staff()   -- tout rôle interne (≠ partenaire)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.profiles where id = auth.uid()) <> 'partenaire', false)
$$;

create or replace function public.is_partenaire()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.profiles where id = auth.uid()) = 'partenaire', false)
$$;

create or replace function public.my_partenaire_id()
returns uuid language sql stable security definer set search_path = public as $$
  select partenaire_id from public.profiles where id = auth.uid()
$$;

create or replace function public.demande_est_a_moi(d_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.demandes_souhaits
                 where id = d_id and partenaire_id = public.my_partenaire_id())
$$;

-- ════════════════════════════ RLS : TABLES INTERNES ═══════════════════════════
-- Toutes les tables internes : accès réservé au PERSONNEL. Un compte partenaire
-- (authentifié mais is_partenaire) n'a aucune policy ici ⇒ accès refusé.
do $$
declare t text;
begin
  foreach t in array array[
    'roles_asbl','qualifications','volontaires',
    'souhait_dates','souhait_personnel',
    'defraiements','disponibilites','stock_materiel','stock_mouvements',
    'annuaire_institutions','annuaire_contacts','notifications','formulaires_config'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t||'_staff_all', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.is_staff()) with check (public.is_staff())', t||'_staff_all', t);
  end loop;
end $$;

-- Profils : chacun lit/écrit le sien ; le personnel voit tout.
alter table public.profiles enable row level security;
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_staff())
  with check (id = auth.uid() or public.is_staff());
drop policy if exists profiles_insert_staff on public.profiles;
create policy profiles_insert_staff on public.profiles for insert to authenticated
  with check (public.is_staff());

-- Partenaires : personnel = tout ; un partenaire voit sa propre organisation.
alter table public.partenaires enable row level security;
drop policy if exists partenaires_staff_all on public.partenaires;
create policy partenaires_staff_all on public.partenaires for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
drop policy if exists partenaires_self_read on public.partenaires;
create policy partenaires_self_read on public.partenaires for select to authenticated
  using (public.is_partenaire() and id = public.my_partenaire_id());

-- ════════════════════════════ RLS : DOMAINE SOUHAITS ══════════════════════════
alter table public.demandes_souhaits  enable row level security;
alter table public.souhait_medicaments enable row level security;
alter table public.souhaits            enable row level security;
alter table public.souhait_suivi       enable row level security;
alter table public.souhait_rapports    enable row level security;

-- DEMANDES : personnel = tout ; formulaire externe (anon) = insertion seule ;
-- partenaire = voit/crée/complète SES demandes.
drop policy if exists demandes_staff_all on public.demandes_souhaits;
create policy demandes_staff_all on public.demandes_souhaits for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists demandes_insert_externe on public.demandes_souhaits;
create policy demandes_insert_externe on public.demandes_souhaits for insert to anon
  with check (coalesce(source,'externe') = 'externe' and partenaire_id is null);

drop policy if exists demandes_partenaire_select on public.demandes_souhaits;
create policy demandes_partenaire_select on public.demandes_souhaits for select to authenticated
  using (public.is_partenaire() and partenaire_id = public.my_partenaire_id());
drop policy if exists demandes_partenaire_insert on public.demandes_souhaits;
create policy demandes_partenaire_insert on public.demandes_souhaits for insert to authenticated
  with check (public.is_partenaire() and source = 'partenaire' and partenaire_id = public.my_partenaire_id());
drop policy if exists demandes_partenaire_update on public.demandes_souhaits;
create policy demandes_partenaire_update on public.demandes_souhaits for update to authenticated
  using (public.is_partenaire() and partenaire_id = public.my_partenaire_id())
  with check (public.is_partenaire() and partenaire_id = public.my_partenaire_id());

-- MÉDICAMENTS : personnel = tout ; partenaire = ceux de ses demandes.
drop policy if exists medicaments_staff_all on public.souhait_medicaments;
create policy medicaments_staff_all on public.souhait_medicaments for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
drop policy if exists medicaments_partenaire on public.souhait_medicaments;
create policy medicaments_partenaire on public.souhait_medicaments for all to authenticated
  using (public.is_partenaire() and public.demande_est_a_moi(demande_id))
  with check (public.is_partenaire() and public.demande_est_a_moi(demande_id));

-- SOUHAIT (accepté) & SUIVI : PERSONNEL UNIQUEMENT — invisibles du partenaire.
drop policy if exists souhaits_staff_all on public.souhaits;
create policy souhaits_staff_all on public.souhaits for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
drop policy if exists suivi_staff_all on public.souhait_suivi;
create policy suivi_staff_all on public.souhait_suivi for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- RAPPORT FINAL : personnel = tout ; partenaire = lecture SI publié ET c'est sa demande.
drop policy if exists rapports_staff_all on public.souhait_rapports;
create policy rapports_staff_all on public.souhait_rapports for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
drop policy if exists rapports_partenaire_read on public.souhait_rapports;
create policy rapports_partenaire_read on public.souhait_rapports for select to authenticated
  using (
    public.is_partenaire() and publie = true
    and souhait_id in (select souhait_id from public.demandes_souhaits
                       where partenaire_id = public.my_partenaire_id())
  );

-- ── Droits complémentaires ───────────────────────────────────────────────────
grant select, insert, update, delete on public.partenaires, public.souhait_medicaments
  to authenticated, service_role;
-- Le formulaire de demande externe (anonyme) peut UNIQUEMENT insérer une demande :
grant insert on public.demandes_souhaits to anon;

notify pgrst, 'reload schema';
