-- © 2026 Heart's Angels ASBL & Laurent Noulin — Tous droits réservés.
-- Vault + RPC pour la clé Gemini (analyse docs médicaux / stups).
-- Idempotent. Après 146_stupefiants_mission.sql.
--
-- Créer / mettre à jour le secret (une fois, hors git) :
--   select vault.create_secret('<CLE>', 'ha_gemini_api_key', 'Gemini Developer API');
-- ou si le nom existe déjà :
--   select vault.update_secret(id, '<CLE>', 'ha_gemini_api_key', 'Gemini Developer API')
--     from vault.secrets where name = 'ha_gemini_api_key';

create or replace function public.gemini_api_config()
returns jsonb
language plpgsql
security definer
set search_path = vault, public
as $$
declare
  k text;
begin
  if auth.role() is distinct from 'service_role' and current_user not in ('postgres', 'supabase_admin') then
    raise exception 'forbidden';
  end if;
  select decrypted_secret into k
    from vault.decrypted_secrets
   where name = 'ha_gemini_api_key'
   limit 1;
  if k is null or length(btrim(k)) = 0 then
    return jsonb_build_object('ok', false);
  end if;
  return jsonb_build_object('ok', true, 'key', btrim(k));
end;
$$;

revoke all on function public.gemini_api_config() from public, anon, authenticated;
grant execute on function public.gemini_api_config() to service_role;

comment on function public.gemini_api_config() is
  'Clé Gemini (service_role uniquement). Lue depuis Vault ha_gemini_api_key.';
