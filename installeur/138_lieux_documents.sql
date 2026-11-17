-- Documents / plans attachés aux lieux connus (destinations, institutions).
-- Idempotent.

alter table public.destinations_frequentes
  add column if not exists documents jsonb not null default '[]'::jsonb,
  add column if not exists annuaire_id uuid references public.annuaire(id) on delete set null;

alter table public.referentiel_institutions
  add column if not exists documents jsonb not null default '[]'::jsonb;

create index if not exists destinations_frequentes_annuaire_idx
  on public.destinations_frequentes (annuaire_id)
  where annuaire_id is not null;
