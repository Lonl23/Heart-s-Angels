-- ════════════════════════════════════════════════════════════════════════
--  Alertes stock par e-mail, uniquement responsable logistique et adjoint.
--    • mission réalisée : matériel utilisé
--    • oxygène ≤ 50 bar (dès que la pression passe sous le seuil, une fois)
--    • péremption à J-15, J-7 et le jour J
--  Idempotent. Après 21_statuts_terrain.sql.
--
--  L'envoi lui-même est fait par la fonction Edge alertes-stock (Resend).
--  Pour le courrier du matin sans ouvrir l'appli, enregistrer dans le Vault :
--    select vault.create_secret('https://xxxx.supabase.co', 'project_url');
--    select vault.create_secret('clé anon publique', 'anon_key');
--    select vault.create_secret('même valeur que le secret ALERTES_SECRET', 'alertes_secret');
--  Puis secrets de la fonction : RESEND_API_KEY, ALERTES_FROM, ALERTES_SECRET.
-- ════════════════════════════════════════════════════════════════════════

PLACEHOLDER_WILL_REPLACE
