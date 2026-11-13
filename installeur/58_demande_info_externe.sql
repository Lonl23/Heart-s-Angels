-- ════════════════════════════════════════════════════════════════════════════
--  Statut distinct « Demande d'informations externe » (Odoo : Demandes de
--  renseignements). Ce n’est pas une attente interne du pipeline.
--  Idempotent. Après 57_souhaits_verrouilles_tableau.sql.
-- ════════════════════════════════════════════════════════════════════════════

alter type public.statut_souhait add value if not exists 'demande_info_externe';
