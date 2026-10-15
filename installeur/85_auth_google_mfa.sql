-- ════════════════════════════════════════════════════════════════════════════
--  Connexion Google + double authentification (TOTP).
--  Un login Google ne crée jamais une fiche volontaire vide : l’e-mail doit
--  déjà exister dans profiles. TOTP reste optionnel (réglage admin plus tard).
--  Idempotent. Après 84_suivi_interne_journal.sql.
-- ════════════════════════════════════════════════════════════════════════════

-- Pas de fiche automatique pour un utilisateur créé par Google.
-- L’inscription par invitation (e-mail + mot de passe) continue de créer la fiche.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.raw_app_meta_data->>'provider', '') = 'google' then
    return new;
  end if;
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

-- Vérifie qu’un login Google correspond à une fiche ASBL (même e-mail).
-- Sinon refuse et supprime le compte Auth orphelin (pas d’accès, pas de doublon).
create or replace function public.valider_connexion_google()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_me public.profiles;
  v_autre public.profiles;
  v_a_compte boolean;
  v_google boolean;
  v_email_id boolean;
  v_err text;
begin
  if v_uid is null then
    return json_build_object('ok', false, 'error', 'Non authentifié.');
  end if;

  select exists (
    select 1 from auth.identities i where i.user_id = v_uid and i.provider = 'google'
  ) into v_google;
  select exists (
    select 1 from auth.identities i where i.user_id = v_uid and i.provider = 'email'
  ) into v_email_id;

  select lower(btrim(coalesce(email, ''))) into v_email from auth.users where id = v_uid;
  if coalesce(v_email, '') = '' then
    v_err := 'Aucun compte Heart''s Angels pour cette adresse';
  else
    select * into v_me from public.profiles where id = v_uid;
    if found then
      if v_me.actif = false then
        v_err := 'Ce compte n''est plus actif.';
      elsif v_me.role::text = 'partenaire' then
        v_err := 'Utilisez l’accès partenaire (nom de l’institution + e-mail + mot de passe).';
      else
        return json_build_object('ok', true);
      end if;
    else
      select * into v_autre
      from public.profiles
      where lower(btrim(coalesce(email, ''))) = v_email
      order by case when exists (select 1 from auth.users u where u.id = profiles.id) then 0 else 1 end
      limit 1;

      if not found then
        v_err := 'Aucun compte Heart''s Angels pour cette adresse';
      elsif v_autre.role::text = 'partenaire' then
        v_err := 'Utilisez l’accès partenaire (nom de l’institution + e-mail + mot de passe).';
      elsif v_autre.actif = false then
        v_err := 'Ce compte n''est plus actif.';
      else
        select exists (select 1 from auth.users u where u.id = v_autre.id) into v_a_compte;
        if v_a_compte then
          -- Compte e-mail déjà existant : le rattachement automatique n’a pas eu lieu.
          -- On ne fusionne pas (deux uid). L’utilisateur passe par e-mail + mot de passe.
          v_err := 'Cette adresse a déjà un compte. Connectez-vous par e-mail et mot de passe.';
        else
          insert into public.profiles (id, email, prenom, nom, role, actif, fiche)
          values (
            v_uid,
            v_email,
            coalesce(v_autre.prenom, ''),
            coalesce(v_autre.nom, ''),
            v_autre.role,
            true,
            coalesce(v_autre.fiche, '{}'::jsonb)
          )
          on conflict (id) do nothing;
          perform set_config('app.role_guard_off', 'on', true);
          perform public.fusionner_profil_stub(v_autre.id, v_uid);
          return json_build_object('ok', true, 'fusion', true);
        end if;
      end if;
    end if;
  end if;

  -- Compte Google sans fiche ASBL : on le retire pour ne pas bloquer une invitation ultérieure.
  if v_google and not v_email_id and not exists (select 1 from public.profiles p where p.id = v_uid) then
    begin
      delete from auth.users where id = v_uid;
    exception when others then
      null;
    end;
  end if;

  return json_build_object('ok', false, 'error', coalesce(v_err, 'Aucun compte Heart''s Angels pour cette adresse'));
end $$;

revoke all on function public.valider_connexion_google() from public, anon;
grant execute on function public.valider_connexion_google() to authenticated;

comment on function public.valider_connexion_google() is
  'Login Google : n’ouvre l’app que si l’e-mail correspond à une fiche Heart''s Angels.';

-- Réglage admin : exiger la 2FA pour le personnel (désactivé par défaut).
create table if not exists public.app_reglages (
  cle         text primary key,
  valeur      jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

alter table public.app_reglages enable row level security;

insert into public.app_reglages (cle, valeur)
values ('mfa', jsonb_build_object('obligatoire', false))
on conflict (cle) do nothing;

comment on table public.app_reglages is
  'Réglages d’application (ex. 2FA obligatoire). Pas de données de santé.';

drop policy if exists app_reglages_select on public.app_reglages;
create policy app_reglages_select on public.app_reglages
  for select to authenticated
  using (true);

drop policy if exists app_reglages_write on public.app_reglages;
create policy app_reglages_write on public.app_reglages
  for all to authenticated
  using (public.peut_gerer_app())
  with check (public.peut_gerer_app());

grant select on public.app_reglages to authenticated;
grant insert, update, delete on public.app_reglages to authenticated, service_role;

notify pgrst, 'reload schema';
