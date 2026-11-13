-- Stockage du dimensionnement DPS (P2 / E1 / E2) sur l’activité.

alter table public.activites_secours
  add column if not exists dps_dimensionnement jsonb not null default '{}'::jsonb;

comment on column public.activites_secours.dps_dimensionnement is
  'Dimensionnement DPS : public, acteurs, indicateurs P2/E1/E2 (aide à la décision).';

notify pgrst, 'reload schema';
