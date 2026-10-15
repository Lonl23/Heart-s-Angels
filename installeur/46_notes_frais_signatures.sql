-- ════════════════════════════════════════════════════════════════════════════
--  Signatures électroniques sur la note de frais (volontaire + ASBL).
--  Idempotent. Après 45_notes_frais.sql.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.notes_frais
  add column if not exists signature_volontaire text,
  add column if not exists signature_volontaire_at timestamptz,
  add column if not exists signature_volontaire_nom text,
  add column if not exists signature_asbl text,
  add column if not exists signature_asbl_at timestamptz,
  add column if not exists signature_asbl_nom text,
  add column if not exists signature_asbl_fonction text;

comment on column public.notes_frais.signature_volontaire is
  'Image PNG (data URL) de la signature du volontaire.';
comment on column public.notes_frais.signature_asbl is
  'Image PNG (data URL) de la signature pour l’ASBL.';

notify pgrst, 'reload schema';
