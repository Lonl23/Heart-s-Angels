-- ════════════════════════════════════════════════════════════════════════════
--  Rapport partenaire : horaires patient (sans km / véhicule / base).
--  Idempotent. Après 43_vnm_vecteur_logistique.sql.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.souhait_rapports
  add column if not exists horaires jsonb;

comment on column public.souhait_rapports.horaires is
  'Horaires patient par vecteur (pec / dest / retour), sans données véhicule.';
