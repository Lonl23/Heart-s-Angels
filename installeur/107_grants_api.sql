-- Droits Data API — changement Supabase du 30 octobre 2026.
-- À partir de cette date, une table créée dans public n'est plus visible
-- par supabase-js, PostgREST ou GraphQL tant qu'un GRANT explicite n'est pas posé.
-- Les tables déjà en place gardent leurs droits : ce fichier les réécrit
-- tels qu'ils sont, pour qu'une réinstallation reste identique.
--
-- On ne suit pas l'exemple du message Supabase qui donne SELECT à anon
-- sur chaque table. anon est la clé publique du site. Il ne lit pas
-- les dossiers, le stock, ni les comptes.
--
-- anon, seulement :
--   lecture de app_fonds et app_fonds_pages (fonds de l'écran de connexion)
--   insertion dans demandes_souhaits (formulaire de demande externe)
--
-- Le navigateur connecté (authenticated) n'a pas accès :
--   aux tables de double authentification (mfa_*)
--   aux jetons de notification (notification_jetons)
--   à l'écriture des archives (lecture seule)
--   à l'UPDATE de toute la note de frais (quelques colonnes seulement)
--
-- Nouvelle table, dans le même fichier que le CREATE TABLE :
--   grant select, insert, update, delete on public.la_table to authenticated, service_role;
--   revoke all on public.la_table from anon;
-- Si la table est sensible, la retirer aussi de la boucle ci-dessous
-- et poser un REVOKE à la place du GRANT.

-- Futures tables créées par postgres : personnel connecté et service,
-- jamais le rôle anonyme. Le 30 octobre Supabase retire les droits
-- automatiques ; une réinstallation les repose ici, sans anon.
alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon;
alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon;
alter default privileges for role postgres in schema public
  grant usage, select on sequences to authenticated, service_role;

-- Tables du personnel. Le RLS continue de filtrer les lignes.
-- Exclues : 2FA, jetons, archives, notes de frais (droits plus étroits).
do $$
declare
  t text;
  hors text[] := array[
    'mfa_reglages',
    'mfa_email_codes',
    'mfa_email_ok',
    'notification_jetons',
    'archive_sessions',
    'archive_ouvertures',
    'notes_frais'
  ];
begin
  for t in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relname <> all (hors)
    order by c.relname
  loop
    execute format(
      'grant select, insert, update, delete on table public.%I to authenticated, service_role',
      t
    );
  end loop;
end $$;

-- Double authentification : le navigateur ne lit ni ne pose les codes.
revoke all on table public.mfa_reglages from public, anon, authenticated;
revoke all on table public.mfa_email_codes from public, anon, authenticated;
revoke all on table public.mfa_email_ok from public, anon, authenticated;
grant select, insert, update, delete on table
  public.mfa_reglages, public.mfa_email_codes, public.mfa_email_ok
  to service_role;

-- Jetons de montre : seul le service les écrit. La fonction security definer
-- les consomme.
revoke all on table public.notification_jetons from public, anon, authenticated;
grant select, insert, update, delete on table public.notification_jetons to service_role;

-- Archives : un compte connecté peut lire sa session, pas l'écrire via l'API.
revoke all on table public.archive_sessions from public, anon, authenticated;
revoke all on table public.archive_ouvertures from public, anon, authenticated;
grant select on table public.archive_sessions, public.archive_ouvertures to authenticated;
grant select, insert, update, delete on table
  public.archive_sessions, public.archive_ouvertures
  to service_role;

-- Notes de frais : le circuit (soumettre, vérifier, payer) passe par des fonctions.
-- Le compte connecté ne met à jour que le contenu de la note.
grant select, insert, delete on table public.notes_frais to authenticated;
grant select, insert, update, delete on table public.notes_frais to service_role;
revoke update on table public.notes_frais from authenticated;
grant update (
  iban, lignes_forfait, lignes_km, total_forfait, total_km, total
) on table public.notes_frais to authenticated;

-- PIN d'archive : mêmes retraits que 54_archive_souhaits.sql.
revoke select (archive_pin_hash) on table public.profiles from authenticated;
revoke update (
  archive_pin_hash, archive_pin_echecs, archive_pin_bloque_jusqua, archive_pin_at
) on table public.profiles from authenticated;

-- anon : rien, puis les deux accès publics voulus.
revoke select, insert, update, delete on all tables in schema public from anon;
grant select on table public.app_fonds, public.app_fonds_pages to anon;
grant insert on table public.demandes_souhaits to anon;

-- La séquence des communications structurées reste interne (fonctions seulement).
revoke all on sequence public.notes_frais_ogm_seq from public, anon, authenticated;

notify pgrst, 'reload schema';
