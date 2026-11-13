-- ════════════════════════════════════════════════════════════════════════════
--  Expéditeur visible des mails d’app : no-reply-app@heartsangels.be
--  L’envoi SMTP reste authentifié avec laurent@heartsangels.be.
--  Reply-To : laurent@heartsangels.be (les réponses arrivent chez Laurent).
--  Idempotent. Après 63_smtp_vault.sql / 75_fonds_pages.sql.
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
    'from', 'Heart''s Angels <no-reply-app@heartsangels.be>',
    'reply_to', 'laurent@heartsangels.be'
  );
end;
$$;

revoke all on function public.smtp_mail_config() from public, anon, authenticated;
grant execute on function public.smtp_mail_config() to service_role;

comment on function public.smtp_mail_config() is
  'Identifiants SMTP (service_role). From no-reply-app@, Reply-To laurent@, mot de passe Vault.';
