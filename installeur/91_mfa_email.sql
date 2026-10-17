-- Double authentification par e-mail.
-- Le code à 6 chiffres n’est écrit que par le service (edge function).
-- Le navigateur ne peut ni le poser, ni lire les tables.
-- L’application d’authentification (TOTP) est gérée par Supabase Auth, pas ici.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.mfa_reglages (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email_actif boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.mfa_email_codes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code_hash text not null,
  expire_at timestamptz not null,
  essais int not null default 0,
  envoye_le timestamptz not null default now()
);

create table if not exists public.mfa_email_ok (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preuve text not null,
  valide_jusqua timestamptz not null
);

alter table public.mfa_reglages enable row level security;
alter table public.mfa_email_codes enable row level security;
alter table public.mfa_email_ok enable row level security;

revoke all on table public.mfa_reglages from public, anon, authenticated;
revoke all on table public.mfa_email_codes from public, anon, authenticated;
revoke all on table public.mfa_email_ok from public, anon, authenticated;

create or replace function public.mfa_email_hash(p_user uuid, p_code text)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select encode(extensions.digest(convert_to(p_code || p_user::text, 'utf8'), 'sha256'), 'hex');
$$;

revoke all on function public.mfa_email_hash(uuid, text) from public, anon, authenticated;

create or replace function public.poser_code_email_2fa(p_user uuid, p_code text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  dernier timestamptz;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    return json_build_object('ok', false, 'erreur', 'Interdit.');
  end if;
  if p_user is null or p_code !~ '^[0-9]{6}$' then
    return json_build_object('ok', false, 'erreur', 'Code invalide.');
  end if;
  select envoye_le into dernier from public.mfa_email_codes where user_id = p_user;
  if dernier is not null and dernier > now() - interval '45 seconds' then
    return json_build_object(
      'ok', false,
      'erreur', 'Un code vient d’être envoyé. Patientez avant d’en demander un autre.',
      'attente', greatest(1, ceil(extract(epoch from (dernier + interval '45 seconds' - now()))))::int
    );
  end if;
  insert into public.mfa_email_codes (user_id, code_hash, expire_at, essais, envoye_le)
  values (
    p_user,
    public.mfa_email_hash(p_user, p_code),
    now() + interval '10 minutes',
    0,
    now()
  )
  on conflict (user_id) do update
    set code_hash = excluded.code_hash,
        expire_at = excluded.expire_at,
        essais = 0,
        envoye_le = excluded.envoye_le;
  return json_build_object('ok', true);
end
$$;

revoke all on function public.poser_code_email_2fa(uuid, text) from public, anon, authenticated;
grant execute on function public.poser_code_email_2fa(uuid, text) to service_role;

create or replace function public.verifier_code_email_2fa(p_code text, p_activer boolean default false)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  uid uuid := auth.uid();
  ligne public.mfa_email_codes%rowtype;
  actif boolean;
  preuve text;
begin
  if uid is null then
    return json_build_object('ok', false, 'erreur', 'Non authentifié.');
  end if;
  if coalesce(p_code, '') !~ '^[0-9]{6}$' then
    return json_build_object('ok', false, 'erreur', 'Code incorrect.');
  end if;
  select email_actif into actif from public.mfa_reglages where user_id = uid;
  if coalesce(actif, false) = false and coalesce(p_activer, false) = false then
    return json_build_object('ok', false, 'erreur', 'Le code par e-mail n’est pas activé.');
  end if;
  select * into ligne from public.mfa_email_codes where user_id = uid for update;
  if not found or ligne.expire_at < now() or ligne.essais >= 5 then
    delete from public.mfa_email_codes where user_id = uid;
    return json_build_object('ok', false, 'erreur', 'Ce code n’est plus valable. Demandez-en un nouveau.');
  end if;
  if ligne.code_hash is distinct from public.mfa_email_hash(uid, p_code) then
    update public.mfa_email_codes set essais = essais + 1 where user_id = uid;
    if ligne.essais + 1 >= 5 then
      delete from public.mfa_email_codes where user_id = uid;
      return json_build_object('ok', false, 'erreur', 'Trop d’essais. Demandez un nouveau code.');
    end if;
    return json_build_object('ok', false, 'erreur', 'Code incorrect.');
  end if;
  delete from public.mfa_email_codes where user_id = uid;
  preuve := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.mfa_email_ok (user_id, preuve, valide_jusqua)
  values (uid, preuve, now() + interval '12 hours')
  on conflict (user_id) do update
    set preuve = excluded.preuve,
        valide_jusqua = excluded.valide_jusqua;
  if coalesce(p_activer, false) then
    insert into public.mfa_reglages (user_id, email_actif, updated_at)
    values (uid, true, now())
    on conflict (user_id) do update
      set email_actif = true,
          updated_at = now();
  end if;
  return json_build_object('ok', true, 'preuve', preuve);
end
$$;

revoke all on function public.verifier_code_email_2fa(text, boolean) from public, anon;
grant execute on function public.verifier_code_email_2fa(text, boolean) to authenticated;

create or replace function public.desactiver_email_2fa()
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
  insert into public.mfa_reglages (user_id, email_actif, updated_at)
  values (uid, false, now())
  on conflict (user_id) do update
    set email_actif = false,
        updated_at = now();
  delete from public.mfa_email_codes where user_id = uid;
  delete from public.mfa_email_ok where user_id = uid;
  return json_build_object('ok', true);
end
$$;

revoke all on function public.desactiver_email_2fa() from public, anon;
grant execute on function public.desactiver_email_2fa() to authenticated;

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
    ), false)
  );
$$;

revoke all on function public.etat_email_2fa() from public, anon;
grant execute on function public.etat_email_2fa() to authenticated;

create or replace function public.email_2fa_valide(p_preuve text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.uid() is not null and length(coalesce(p_preuve, '')) >= 32 and exists (
    select 1
    from public.mfa_email_ok o
    join public.mfa_reglages r on r.user_id = o.user_id
    where o.user_id = auth.uid()
      and r.email_actif
      and o.valide_jusqua > now()
      and o.preuve = p_preuve
  ), false);
$$;

revoke all on function public.email_2fa_valide(text) from public, anon;
grant execute on function public.email_2fa_valide(text) to authenticated;
