-- ════════════════════════════════════════════════════════════════════════════
--  Retrait de la connexion Google (ne fonctionne pas avec le Workspace ASBL).
--  Restaure handle_new_user (e-mail + mot de passe). La 2FA TOTP reste.
--  Idempotent. Après 85_auth_google_mfa.sql.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, prenom, nom)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'prenom', ''),
    coalesce(new.raw_user_meta_data->>'nom', '')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop function if exists public.valider_connexion_google();

notify pgrst, 'reload schema';
