-- ════════════════════════════════════════════════════════════════════════════
--  Feuille de mission complète du souhait, stockée en JSONB (souhaits.mission),
--  et indicateur « donné » sur les traitements. Idempotent.
--  À exécuter après rebuild_interne + acces_partenaire + 04.
-- ════════════════════════════════════════════════════════════════════════════
alter table public.souhaits
  add column if not exists mission jsonb default '{}'::jsonb;

alter table public.souhait_medicaments
  add column if not exists donne boolean default false;

notify pgrst, 'reload schema';
