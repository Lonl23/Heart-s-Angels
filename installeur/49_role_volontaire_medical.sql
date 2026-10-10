-- ════════════════════════════════════════════════════════════════════════════
--  Rôle profil « volontaire médical » (en vis-à-vis de volontaire_non_medical).
--  L’invitation d’un membre ne propose plus les fonctions ASBL / grades.
--  Fichier séparé : ADD VALUE ne peut pas être utilisé dans la même
--  transaction. Après 48_notes_frais_circuit.sql. Puis 50.
-- ════════════════════════════════════════════════════════════════════════════

alter type public.role_utilisateur add value if not exists 'volontaire_medical';
