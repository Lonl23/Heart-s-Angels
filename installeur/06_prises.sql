-- ════════════════════════════════════════════════════════════════════════════
--  Suivi d'administration des médicaments : chaque prise (heure prévue → donnée
--  à telle heure réelle) est mémorisée dans souhait_medicaments.prises (JSONB).
--  Idempotent.
-- ════════════════════════════════════════════════════════════════════════════
alter table public.souhait_medicaments
  add column if not exists prises jsonb default '[]'::jsonb;

notify pgrst, 'reload schema';
