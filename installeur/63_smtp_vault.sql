-- ════════════════════════════════════════════════════════════════════════════
--  Identifiants SMTP (Gmail Workspace) lus depuis Vault, pas depuis le code.
--  Le mot de passe d’application se pose une fois :
--    select vault.create_secret('xxxxxxxxxxxxxxxx', 'ha_smtp_pass', 'Gmail app password');
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.smtp_mail_config()
returns jsonb
language plpgsql
security definer
set search_path = vault, public
as $$
declare
  pass text;
begin
  if auth.role() is distinct from 'service_role' and current_user not in ('postgres', 'supabase_admin') then
    raise exception 'forbidden';
  end if;
  select decrypted_secret into pass
    from vault.decrypted_secrets
   where name = 'ha_smtp_pass'
   limit 1;
  if pass is null or length(btrim(pass)) = 0 then
    return jsonb_build_object('ok', false);
  end if;
  return jsonb_build_object(
    'ok', true,
    'user', 'laurent@heartsangels.be',
    'pass', btrim(pass),
    'from', 'Heart''s Angels <laurent@heartsangels.be>'
  );
end;
$$;

revoke all on function public.smtp_mail_config() from public, anon, authenticated;
grant execute on function public.smtp_mail_config() to service_role;

comment on function public.smtp_mail_config() is
  'Identifiants SMTP (service_role uniquement). Le mot de passe est dans Vault.';
