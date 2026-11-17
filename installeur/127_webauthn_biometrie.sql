-- ════════════════════════════════════════════════════════════════════════════
--  Biométrie (WebAuthn) : remplace le défi 2FA sur cet appareil.
--  Mot de passe inchangé ; Face ID / empreinte / Windows Hello après login.
--  Idempotent. Après 126_aligner_role_type_benevole.sql.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.mfa_reglages
  add column if not exists webauthn_actif boolean not null default false;

create table if not exists public.mfa_webauthn_credentials (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  credential_id   text not null,
  public_key      text not null,
  counter         bigint not null default 0,
  device_name     text,
  transports      text[] not null default '{}',
  created_at      timestamptz not null default now(),
  last_used_at    timestamptz,
  unique (user_id, credential_id)
);

create index if not exists mfa_webauthn_credentials_user_idx
  on public.mfa_webauthn_credentials (user_id);

create table if not exists public.mfa_webauthn_challenges (
  user_id     uuid primary key references public.profiles(id) on delete cascade,
  challenge   text not null,
  kind        text not null check (kind in ('register', 'authenticate')),
  expire_at   timestamptz not null
);

create table if not exists public.mfa_webauthn_ok (
  user_id       uuid primary key references public.profiles(id) on delete cascade,
  preuve        text not null,
  valide_jusqua timestamptz not null
);

alter table public.mfa_webauthn_credentials enable row level security;
alter table public.mfa_webauthn_challenges enable row level security;
alter table public.mfa_webauthn_ok enable row level security;

revoke all on table public.mfa_webauthn_credentials from public, anon, authenticated;
revoke all on table public.mfa_webauthn_challenges from public, anon, authenticated;
revoke all on table public.mfa_webauthn_ok from public, anon, authenticated;

grant all on table public.mfa_webauthn_credentials to service_role;
grant all on table public.mfa_webauthn_challenges to service_role;
grant all on table public.mfa_webauthn_ok to service_role;

create or replace function public.etat_webauthn_2fa()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'webauthn_actif',
    coalesce((
      select r.webauthn_actif
        and exists (
          select 1 from public.mfa_webauthn_credentials c where c.user_id = auth.uid()
        )
      from public.mfa_reglages r
      where r.user_id = auth.uid()
    ), false),
    'appareils',
    coalesce((
      select json_agg(json_build_object(
        'id', c.id,
        'device_name', c.device_name,
        'created_at', c.created_at,
        'last_used_at', c.last_used_at
      ) order by c.created_at desc)
      from public.mfa_webauthn_credentials c
      where c.user_id = auth.uid()
    ), '[]'::json)
  );
$$;

revoke all on function public.etat_webauthn_2fa() from public, anon;
grant execute on function public.etat_webauthn_2fa() to authenticated;

create or replace function public.webauthn_2fa_valide(p_preuve text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.uid() is not null and length(coalesce(p_preuve, '')) >= 32 and exists (
    select 1
    from public.mfa_webauthn_ok o
    join public.mfa_reglages r on r.user_id = o.user_id
    where o.user_id = auth.uid()
      and r.webauthn_actif
      and o.valide_jusqua > now()
      and o.preuve = p_preuve
      and exists (
        select 1 from public.mfa_webauthn_credentials c where c.user_id = o.user_id
      )
  ), false);
$$;

revoke all on function public.webauthn_2fa_valide(text) from public, anon;
grant execute on function public.webauthn_2fa_valide(text) to authenticated;

create or replace function public.desactiver_webauthn_2fa()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    return json_build_object('ok', false, 'erreur', 'Non authentifié.');
  end if;
  delete from public.mfa_webauthn_credentials where user_id = uid;
  delete from public.mfa_webauthn_challenges where user_id = uid;
  delete from public.mfa_webauthn_ok where user_id = uid;
  insert into public.mfa_reglages (user_id, email_actif, webauthn_actif, updated_at)
  values (
    uid,
    coalesce((select email_actif from public.mfa_reglages where user_id = uid), false),
    false,
    now()
  )
  on conflict (user_id) do update
    set webauthn_actif = false,
        updated_at = now();
  return json_build_object('ok', true);
end
$$;

revoke all on function public.desactiver_webauthn_2fa() from public, anon;
grant execute on function public.desactiver_webauthn_2fa() to authenticated;

-- État e-mail : inclure webauthn pour un seul appel client.
create or replace function public.etat_email_2fa()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'email_actif',
    coalesce((
      select email_actif from public.mfa_reglages where user_id = auth.uid()
    ), false),
    'webauthn_actif',
    coalesce((
      select r.webauthn_actif
        and exists (
          select 1 from public.mfa_webauthn_credentials c where c.user_id = auth.uid()
        )
      from public.mfa_reglages r
      where r.user_id = auth.uid()
    ), false)
  );
$$;

notify pgrst, 'reload schema';
