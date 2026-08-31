-- ════════════════════════════════════════════════════════════════════════════
--  Fiche volontaire complète, stockée dans profiles.fiche (JSONB) :
--  qualifications, rôles ASBL, permis, visas, spécialisations, contacts d'urgence.
--  Idempotent.
-- ════════════════════════════════════════════════════════════════════════════
alter table public.profiles
  add column if not exists fiche jsonb default '{}'::jsonb;

notify pgrst, 'reload schema';