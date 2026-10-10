-- ════════════════════════════════════════════════════════════════════════════
--  Candidature partenaire + e-mail professionnel + contrôle du nom
--  d’institution à la connexion. Idempotent. Après 54_archive_souhaits.sql.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.partenaires
  add column if not exists email_pro_derogation boolean not null default false;

comment on column public.partenaires.email_pro_derogation is
  'IT : autorise un e-mail personnel (Gmail…) pour cette institution seulement.';

-- Nom saisi à la connexion, comparable sans accents / ponctuation.
create or replace function public.normaliser_nom_institution(p text)
returns text
language sql
immutable
as $$
  select nullif(
    trim(both ' ' from regexp_replace(
      translate(
        lower(replace(replace(coalesce(p, ''), 'œ', 'oe'), 'æ', 'ae')),
        'àáâäãåèéêëìíîïòóôöõùúûüýÿçñ',
        'aaaaaaeeeeiiiiooooouuuuyycn'
      ),
      '[^a-z0-9]+', ' ', 'g'
    )),
    ''
  );
$$;

create or replace function public.domaine_email(p_email text)
returns text
language sql
immutable
as $$
  select nullif(lower(split_part(trim(coalesce(p_email, '')), '@', 2)), '');
$$;

create or replace function public.email_est_professionnel(p_email text)
returns boolean
language sql
immutable
as $$
  select
    coalesce(p_email, '') ~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
    and public.domaine_email(p_email) is not null
    and public.domaine_email(p_email) not in (
      'gmail.com', 'googlemail.com',
      'outlook.com', 'outlook.fr', 'hotmail.com', 'hotmail.fr', 'hotmail.be',
      'live.com', 'live.fr', 'live.be', 'msn.com',
      'yahoo.com', 'yahoo.fr', 'yahoo.be', 'ymail.com',
      'icloud.com', 'me.com', 'mac.com',
      'proton.me', 'protonmail.com', 'protonmail.ch',
      'gmx.com', 'gmx.fr', 'gmx.net',
      'mail.com', 'aol.com',
      'skynet.be', 'telenet.be', 'scarlet.be', 'proximus.be', 'voo.be',
      'orange.fr', 'orange.be', 'wanadoo.fr', 'free.fr', 'laposte.net',
      'sfr.fr', 'bbox.fr'
    );
$$;

create or replace function public.email_partenaire_autorise(p_email text, p_partenaire_id uuid)
returns boolean
language plpgsql
stable
as $$
declare o public.partenaires;
begin
  if p_partenaire_id is not null then
    select * into o from public.partenaires where id = p_partenaire_id;
    if found and (coalesce(o.fictif, false) or coalesce(o.email_pro_derogation, false)) then
      return coalesce(p_email, '') ~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$';
    end if;
  end if;
  return public.email_est_professionnel(p_email);
end $$;

create or replace function public.gen_code_invitation()
returns text
language plpgsql
as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  a text;
  b text;
  i int;
  n int;
  code text;
begin
  for n in 1..40 loop
    a := ''; b := '';
    for i in 1..4 loop
      a := a || substr(alphabet, 1 + (floor(random() * length(alphabet)))::int, 1);
      b := b || substr(alphabet, 1 + (floor(random() * length(alphabet)))::int, 1);
    end loop;
    code := 'HA-' || a || '-' || b;
    if not exists (select 1 from public.invitations where invitations.code = code) then
      return code;
    end if;
  end loop;
  raise exception 'Impossible de générer un code d''invitation unique.';
end $$;

create table if not exists public.demandes_acces_partenaire (
  id              uuid primary key default gen_random_uuid(),
  nom_institution text not null,
  type            text,
  ville           text,
  email           text not null,
  tel             text,
  contact_nom     text not null,
  statut          text not null default 'en_attente'
                    check (statut in ('en_attente', 'acceptee', 'refusee')),
  motif_refus     text,
  partenaire_id   uuid references public.partenaires(id) on delete set null,
  invitation_code text,
  notes_internes  text,
  traite_par      uuid references public.profiles(id) on delete set null,
  traite_le       timestamptz,
  created_at      timestamptz not null default now()
);

alter table public.demandes_acces_partenaire drop constraint if exists demandes_acces_partenaire_type_chk;
alter table public.demandes_acces_partenaire add constraint demandes_acces_partenaire_type_chk
  check (type is null or type in ('hopital','maison_repos','soins_palliatifs','domicile','institution','autre'));

create unique index if not exists demandes_acces_partenaire_email_attente_uidx
  on public.demandes_acces_partenaire (lower(email))
  where statut = 'en_attente';

create index if not exists demandes_acces_partenaire_statut_idx
  on public.demandes_acces_partenaire (statut, created_at desc);

comment on table public.demandes_acces_partenaire is
  'Candidatures publiques. Pas de compte tant que l’ASBL n’a pas accepté.';

alter table public.demandes_acces_partenaire enable row level security;

drop policy if exists demandes_acces_partenaire_staff on public.demandes_acces_partenaire;
create policy demandes_acces_partenaire_staff on public.demandes_acces_partenaire
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

grant select, insert, update, delete on public.demandes_acces_partenaire to authenticated, service_role;

-- Candidature anonyme : pas de compte, e-mail pro obligatoire.
create or replace function public.demander_acces_partenaire(
  p_nom text,
  p_type text,
  p_ville text,
  p_email text,
  p_tel text,
  p_contact_nom text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nom text := trim(coalesce(p_nom, ''));
  v_email text := lower(trim(coalesce(p_email, '')));
  v_contact text := trim(coalesce(p_contact_nom, ''));
  v_type text := nullif(trim(coalesce(p_type, '')), '');
  v_ville text := nullif(trim(coalesce(p_ville, '')), '');
  v_tel text := nullif(trim(coalesce(p_tel, '')), '');
  v_match uuid;
begin
  if char_length(v_nom) < 3 then
    return json_build_object('ok', false, 'error', 'Indiquez le nom de l’institution.');
  end if;
  if char_length(v_contact) < 2 then
    return json_build_object('ok', false, 'error', 'Indiquez le nom de la personne de contact.');
  end if;
  if v_type is not null and v_type not in ('hopital','maison_repos','soins_palliatifs','domicile','institution','autre') then
    return json_build_object('ok', false, 'error', 'Type d’institution invalide.');
  end if;
  if not public.email_est_professionnel(v_email) then
    return json_build_object('ok', false, 'error', 'Utilisez l’e-mail professionnel de l’institution (pas Gmail, Outlook perso, etc.).');
  end if;
  if exists (
    select 1 from public.demandes_acces_partenaire
     where statut = 'en_attente' and lower(email) = v_email
  ) then
    return json_build_object('ok', false, 'error', 'Une demande avec cet e-mail est déjà en attente.');
  end if;
  if exists (
    select 1 from public.profiles
     where role = 'partenaire' and lower(email) = v_email and coalesce(actif, true)
  ) then
    return json_build_object('ok', false, 'error', 'Un accès existe déjà pour cet e-mail. Utilisez la page de connexion.');
  end if;

  select id into v_match
    from public.partenaires
   where lower(coalesce(email_general, contact_email, '')) = v_email
   limit 1;
  if v_match is null then
    select id into v_match
      from public.partenaires
     where public.normaliser_nom_institution(nom) = public.normaliser_nom_institution(v_nom)
     limit 1;
  end if;

  insert into public.demandes_acces_partenaire (
    nom_institution, type, ville, email, tel, contact_nom, partenaire_id
  ) values (
    v_nom, v_type, v_ville, v_email, v_tel, v_contact, v_match
  );

  return json_build_object('ok', true);
end $$;

grant execute on function public.demander_acces_partenaire(text, text, text, text, text, text)
  to anon, authenticated;

create or replace function public.accepter_demande_partenaire(p_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.demandes_acces_partenaire;
  o public.partenaires;
  v_pid uuid;
  v_code text;
  v_email text;
begin
  if not public.is_staff() then
    return json_build_object('ok', false, 'error', 'Non autorisé.');
  end if;
  select * into d from public.demandes_acces_partenaire where id = p_id;
  if not found then
    return json_build_object('ok', false, 'error', 'Demande introuvable.');
  end if;
  if d.statut <> 'en_attente' then
    return json_build_object('ok', false, 'error', 'Cette demande a déjà été traitée.');
  end if;

  v_email := lower(trim(d.email));
  v_pid := d.partenaire_id;

  if v_pid is null then
    select id into v_pid
      from public.partenaires
     where lower(coalesce(email_general, contact_email, '')) = v_email
     limit 1;
  end if;
  if v_pid is null then
    select id into v_pid
      from public.partenaires
     where public.normaliser_nom_institution(nom) = public.normaliser_nom_institution(d.nom_institution)
     limit 1;
  end if;

  if v_pid is not null then
    select * into o from public.partenaires where id = v_pid;
    if exists (
      select 1 from public.profiles
       where partenaire_id = v_pid and role = 'partenaire' and coalesce(actif, true)
    ) then
      return json_build_object('ok', false, 'error', 'Cette institution a déjà un compte actif.');
    end if;
    update public.partenaires set
      email_general = coalesce(nullif(email_general, ''), v_email),
      contact_email = coalesce(nullif(contact_email, ''), v_email),
      contact_nom   = coalesce(nullif(contact_nom, ''), d.contact_nom),
      tel_general   = coalesce(nullif(tel_general, ''), d.tel),
      contact_tel   = coalesce(nullif(contact_tel, ''), d.tel),
      ville         = coalesce(nullif(ville, ''), d.ville),
      type          = coalesce(type, d.type),
      actif         = true
    where id = v_pid;
  else
    insert into public.partenaires (
      nom, type, ville, contact_nom, contact_email, email_general,
      contact_tel, tel_general, actif, fictif
    ) values (
      d.nom_institution, d.type, d.ville, d.contact_nom, v_email, v_email,
      d.tel, d.tel, true, false
    ) returning id into v_pid;
  end if;

  delete from public.invitations
   where partenaire_id = v_pid and utilise = false;

  v_code := public.gen_code_invitation();
  insert into public.invitations (code, email, prenom, nom, role, partenaire_id, cree_par)
  values (
    v_code, v_email, d.contact_nom, d.nom_institution, 'partenaire', v_pid, auth.uid()
  );

  update public.demandes_acces_partenaire set
    statut = 'acceptee',
    partenaire_id = v_pid,
    invitation_code = v_code,
    traite_par = auth.uid(),
    traite_le = now()
  where id = p_id;

  select nom into d.nom_institution from public.partenaires where id = v_pid;

  return json_build_object(
    'ok', true,
    'code', v_code,
    'email', v_email,
    'partenaire_id', v_pid,
    'nom', d.nom_institution,
    'prenom', d.contact_nom
  );
end $$;

create or replace function public.refuser_demande_partenaire(p_id uuid, p_motif text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare d public.demandes_acces_partenaire;
begin
  if not public.is_staff() then
    return json_build_object('ok', false, 'error', 'Non autorisé.');
  end if;
  select * into d from public.demandes_acces_partenaire where id = p_id;
  if not found then
    return json_build_object('ok', false, 'error', 'Demande introuvable.');
  end if;
  if d.statut <> 'en_attente' then
    return json_build_object('ok', false, 'error', 'Cette demande a déjà été traitée.');
  end if;
  update public.demandes_acces_partenaire set
    statut = 'refusee',
    motif_refus = nullif(trim(coalesce(p_motif, '')), ''),
    traite_par = auth.uid(),
    traite_le = now()
  where id = p_id;
  return json_build_object('ok', true);
end $$;

grant execute on function public.accepter_demande_partenaire(uuid) to authenticated;
grant execute on function public.refuser_demande_partenaire(uuid, text) to authenticated;

-- Connexion espace partenaire : e-mail déjà prouvé par le mot de passe ;
-- le nom d’institution doit correspondre. Pas de détail d’erreur.
create or replace function public.confirmer_session_partenaire(p_nom_institution text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.profiles;
  o public.partenaires;
begin
  select * into p from public.profiles where id = auth.uid();
  if not found
     or p.role::text <> 'partenaire'
     or p.actif is not true
     or p.partenaire_id is null then
    return json_build_object('ok', false);
  end if;
  select * into o from public.partenaires where id = p.partenaire_id;
  if not found or coalesce(o.actif, true) is not true then
    return json_build_object('ok', false);
  end if;
  if public.normaliser_nom_institution(p_nom_institution)
     is distinct from public.normaliser_nom_institution(o.nom) then
    return json_build_object('ok', false);
  end if;
  return json_build_object('ok', true, 'nom', o.nom);
end $$;

grant execute on function public.confirmer_session_partenaire(text) to authenticated;

-- Invitation : renvoyer aussi le nom d’institution et le rôle (déjà présent).
create or replace function public.verifier_invitation(p_code text, p_email text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v public.invitations;
  v_nom text;
begin
  select * into v from public.invitations where code = p_code;
  if not found or v.utilise or v.expire_le < now() or lower(v.email) <> lower(p_email) then
    return json_build_object('ok', false);
  end if;
  if v.partenaire_id is not null then
    select nom into v_nom from public.partenaires where id = v.partenaire_id;
  end if;
  return json_build_object(
    'ok', true,
    'prenom', v.prenom,
    'nom', v.nom,
    'role', v.role,
    'partenaire', (v.partenaire_id is not null),
    'partenaire_nom', v_nom
  );
end $$;

grant execute on function public.verifier_invitation(text, text) to anon, authenticated;

notify pgrst, 'reload schema';
