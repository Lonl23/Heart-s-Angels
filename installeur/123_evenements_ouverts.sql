-- Liens d’inscription publics (Facebook, WhatsApp…) pour soirées d’info,
-- portes ouvertes, etc. Les inscrits (nom, prénom, DDN…) sont repris en RH.

create table if not exists public.evenements_ouverts (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  date_debut date,
  heure_debut text,
  lieu text,
  description text,
  token text not null unique,
  actif boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists evenements_ouverts_actif_idx
  on public.evenements_ouverts (actif, date_debut);

comment on table public.evenements_ouverts is
  'Événements avec lien public d’inscription (estimation de présence, reprise RH).';

create table if not exists public.evenements_ouverts_inscrits (
  id uuid primary key default gen_random_uuid(),
  evenement_id uuid not null references public.evenements_ouverts(id) on delete cascade,
  prenom text not null,
  nom text not null,
  date_naissance date,
  email text,
  telephone text,
  notes text,
  invitation_code text,
  profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists evenements_ouverts_inscrits_evt_idx
  on public.evenements_ouverts_inscrits (evenement_id, created_at);

comment on table public.evenements_ouverts_inscrits is
  'Inscriptions via lien public ; invitation_code / profile_id une fois repris en RH.';

drop trigger if exists trg_evenements_ouverts_updated on public.evenements_ouverts;
create trigger trg_evenements_ouverts_updated before update on public.evenements_ouverts
  for each row execute function public.set_updated_at();

alter table public.evenements_ouverts enable row level security;
alter table public.evenements_ouverts_inscrits enable row level security;

drop policy if exists evenements_ouverts_select on public.evenements_ouverts;
drop policy if exists evenements_ouverts_write on public.evenements_ouverts;
drop policy if exists evenements_ouverts_inscrits_select on public.evenements_ouverts_inscrits;
drop policy if exists evenements_ouverts_inscrits_write on public.evenements_ouverts_inscrits;

create policy evenements_ouverts_select on public.evenements_ouverts
  for select to authenticated
  using (public.is_staff());

create policy evenements_ouverts_write on public.evenements_ouverts
  for all to authenticated
  using (public.peut_gerer_evenements_internes())
  with check (public.peut_gerer_evenements_internes());

create policy evenements_ouverts_inscrits_select on public.evenements_ouverts_inscrits
  for select to authenticated
  using (public.is_staff());

create policy evenements_ouverts_inscrits_write on public.evenements_ouverts_inscrits
  for all to authenticated
  using (public.peut_gerer_evenements_internes() or public.peut_gerer_fiches())
  with check (public.peut_gerer_evenements_internes() or public.peut_gerer_fiches());

grant select, insert, update, delete on public.evenements_ouverts to authenticated;
grant select, insert, update, delete on public.evenements_ouverts_inscrits to authenticated;

-- Lecture publique (meta événement)
create or replace function public.evenement_ouvert_lire(p_token text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  e public.evenements_ouverts;
  n int;
begin
  select * into e
  from public.evenements_ouverts
  where lower(btrim(token)) = lower(btrim(coalesce(p_token, '')))
    and actif;
  if not found then
    return json_build_object('ok', false, 'error', 'Lien invalide ou inscription fermée.');
  end if;
  select count(*)::int into n from public.evenements_ouverts_inscrits where evenement_id = e.id;
  return json_build_object(
    'ok', true,
    'evenement', json_build_object(
      'id', e.id,
      'titre', e.titre,
      'date_debut', e.date_debut,
      'heure_debut', e.heure_debut,
      'lieu', e.lieu,
      'description', e.description
    ),
    'nb_inscrits', n
  );
end;
$$;

-- Inscription anonyme
create or replace function public.evenement_ouvert_inscrire(
  p_token text,
  p_prenom text,
  p_nom text,
  p_date_naissance date default null,
  p_email text default null,
  p_telephone text default null,
  p_notes text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  e public.evenements_ouverts;
  prenom_txt text := nullif(btrim(coalesce(p_prenom, '')), '');
  nom_txt text := nullif(btrim(coalesce(p_nom, '')), '');
  email_txt text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  tel_txt text := nullif(btrim(coalesce(p_telephone, '')), '');
  row_id uuid;
  n int;
begin
  if prenom_txt is null or nom_txt is null then
    return json_build_object('ok', false, 'error', 'Indiquez votre prénom et votre nom.');
  end if;

  select * into e
  from public.evenements_ouverts
  where lower(btrim(token)) = lower(btrim(coalesce(p_token, '')))
    and actif;
  if not found then
    return json_build_object('ok', false, 'error', 'Lien invalide ou inscription fermée.');
  end if;

  -- Évite les doublons grossiers (même e-mail sur le même événement)
  if email_txt is not null then
    if exists (
      select 1 from public.evenements_ouverts_inscrits
      where evenement_id = e.id and lower(btrim(coalesce(email, ''))) = email_txt
    ) then
      return json_build_object('ok', false, 'error', 'Cette adresse e-mail est déjà inscrite pour cet événement.');
    end if;
  end if;

  insert into public.evenements_ouverts_inscrits (
    evenement_id, prenom, nom, date_naissance, email, telephone, notes
  ) values (
    e.id, prenom_txt, nom_txt, p_date_naissance, email_txt, tel_txt,
    nullif(btrim(coalesce(p_notes, '')), '')
  )
  returning id into row_id;

  select count(*)::int into n from public.evenements_ouverts_inscrits where evenement_id = e.id;

  return json_build_object('ok', true, 'id', row_id, 'nb_inscrits', n);
end;
$$;

revoke all on function public.evenement_ouvert_lire(text) from public;
revoke all on function public.evenement_ouvert_inscrire(text, text, text, date, text, text, text) from public;
grant execute on function public.evenement_ouvert_lire(text) to anon, authenticated, service_role;
grant execute on function public.evenement_ouvert_inscrire(text, text, text, date, text, text, text) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
