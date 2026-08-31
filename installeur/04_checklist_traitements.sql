-- ════════════════════════════════════════════════════════════════════════════
--  Checklist de mission (modèle réutilisable + éléments libres par souhait)
--  et traitements internes rattachés au souhait.
--  À exécuter après rebuild_interne + acces_partenaire.  Idempotent.
-- ════════════════════════════════════════════════════════════════════════════

-- Modèle de checklist : les points standards, réappliqués à chaque souhait
create table if not exists public.checklist_modele (
  id         uuid primary key default gen_random_uuid(),
  libelle    text not null,
  categorie  text default 'materiel',   -- materiel | autorisation | logistique | medical | autre
  ordre      int default 0,
  actif      boolean default true,
  created_at timestamptz default now()
);

-- Checklist propre à un souhait (issue du modèle + ajouts libres)
create table if not exists public.souhait_checklist (
  id         uuid primary key default gen_random_uuid(),
  souhait_id uuid not null references public.souhaits(id) on delete cascade,
  libelle    text not null,
  categorie  text default 'materiel',
  coche      boolean default false,
  coche_par  uuid references public.profiles(id),
  coche_le   timestamptz,
  source     text default 'libre',      -- modele | libre
  ordre      int default 0,
  created_at timestamptz default now()
);
create index if not exists souhait_checklist_souhait_idx on public.souhait_checklist(souhait_id);

-- Traitements internes : rattacher aussi un traitement directement au souhait
alter table public.souhait_medicaments
  add column if not exists souhait_id uuid references public.souhaits(id) on delete cascade;
-- la demande n'est plus obligatoire (un traitement peut venir du souhait interne)
alter table public.souhait_medicaments alter column demande_id drop not null;

-- RLS : réservé au personnel (les partenaires n'ont pas accès aux souhaits)
alter table public.checklist_modele  enable row level security;
alter table public.souhait_checklist enable row level security;
drop policy if exists cm_staff on public.checklist_modele;
create policy cm_staff on public.checklist_modele for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
drop policy if exists sc_staff on public.souhait_checklist;
create policy sc_staff on public.souhait_checklist for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

grant select, insert, update, delete on public.checklist_modele, public.souhait_checklist
  to authenticated, service_role;

notify pgrst, 'reload schema';
