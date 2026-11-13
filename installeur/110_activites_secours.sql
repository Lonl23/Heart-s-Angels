-- Activités du département secours.
-- Distinct des événements internes (Gestion RH) : ici, gardes, exercices
-- et autres activités de secours, visibles par tout le personnel.
-- Lecture : personnel connecté. Inscription : chacun pour soi.
-- Création : administrateur ou présidence (rôle de compte ou siège ASBL).
-- Aucun accès anonyme. Aucune activité de démonstration.

create table if not exists public.activites_secours (
  id           uuid primary key default gen_random_uuid(),
  numero       integer generated always as identity,
  titre        text not null,
  lieu         text,
  debut        timestamptz not null,
  fin          timestamptz,
  places       integer not null,
  competences  text[] not null default '{}',
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint activites_secours_titre check (char_length(btrim(titre)) between 1 and 180),
  constraint activites_secours_lieu check (lieu is null or char_length(lieu) <= 240),
  constraint activites_secours_places check (places between 1 and 500),
  constraint activites_secours_dates check (fin is null or fin >= debut),
  constraint activites_secours_nb_comp check (cardinality(competences) <= 12),
  constraint activites_secours_competences_connues check (
    competences <@ array[
      'ambulancier', 'infirmier', 'medecin', 'kine', 'psychologue',
      'secouriste', 'chauffeur', 'autre', 'medical', 'non_medical'
    ]::text[]
  )
);

create index if not exists activites_secours_debut_idx
  on public.activites_secours (debut);

comment on table public.activites_secours is
  'Activités du département secours. Pas les événements internes de la Gestion RH.';
comment on column public.activites_secours.competences is
  'Clés de la fiche : qualifications (ambulancier, secouriste…) ou type (medical, non_medical).';

drop trigger if exists trg_activites_secours_updated on public.activites_secours;
create trigger trg_activites_secours_updated
  before update on public.activites_secours
  for each row execute function public.set_updated_at();

create table if not exists public.activites_secours_inscrits (
  id           uuid primary key default gen_random_uuid(),
  activite_id  uuid not null references public.activites_secours(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  unique (activite_id, user_id)
);

create index if not exists activites_secours_inscrits_act_idx
  on public.activites_secours_inscrits (activite_id);
create index if not exists activites_secours_inscrits_user_idx
  on public.activites_secours_inscrits (user_id);

comment on table public.activites_secours_inscrits is
  'Inscription d’un membre du personnel à une activité secours. Chacun pose et retire sa propre ligne.';

-- Présidence déjà portée par le rôle de compte ou par fiche.roles_asbl.
-- Pas de nouveau rôle : il n’existe pas de siège « secours » dans roles_asbl.
create or replace function public.peut_creer_activite_secours()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select role::text as role, fiche
    from public.profiles
    where id = auth.uid()
  )
  select coalesce((
    select role in ('admin', 'president')
        or coalesce(fiche->'roles_asbl' ?| array['president', 'vice_president'], false)
    from me
  ), false)
$$;

revoke all on function public.peut_creer_activite_secours() from public, anon;
grant execute on function public.peut_creer_activite_secours() to authenticated, service_role;

create or replace function public.activites_secours_verrou_place()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  n int;
  maxp int;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.activite_id::text, 0));
  select a.places into maxp
  from public.activites_secours a
  where a.id = new.activite_id;
  if maxp is null then
    raise exception 'Activité introuvable';
  end if;
  select count(*)::int into n
  from public.activites_secours_inscrits i
  where i.activite_id = new.activite_id;
  if n >= maxp then
    raise exception 'Plus de place pour cette activité';
  end if;
  return new;
end
$$;

revoke all on function public.activites_secours_verrou_place() from public, anon;
grant execute on function public.activites_secours_verrou_place() to authenticated, service_role;

drop trigger if exists trg_activites_secours_place on public.activites_secours_inscrits;
create trigger trg_activites_secours_place
  before insert on public.activites_secours_inscrits
  for each row execute function public.activites_secours_verrou_place();

grant select, insert, update, delete on table public.activites_secours to authenticated, service_role;
grant select, insert, delete on table public.activites_secours_inscrits to authenticated, service_role;
revoke all on table public.activites_secours from anon, public;
revoke all on table public.activites_secours_inscrits from anon, public;

do $$
declare seq text;
begin
  select pg_get_serial_sequence('public.activites_secours', 'numero') into seq;
  if seq is not null then
    execute format('revoke all on sequence %s from anon, public', seq);
    execute format('grant usage, select on sequence %s to authenticated, service_role', seq);
  end if;
end $$;

alter table public.activites_secours enable row level security;
alter table public.activites_secours_inscrits enable row level security;

drop policy if exists activites_secours_select on public.activites_secours;
drop policy if exists activites_secours_insert on public.activites_secours;
drop policy if exists activites_secours_update on public.activites_secours;
drop policy if exists activites_secours_delete on public.activites_secours;

create policy activites_secours_select on public.activites_secours
  for select to authenticated
  using (public.is_staff());

create policy activites_secours_insert on public.activites_secours
  for insert to authenticated
  with check (
    public.peut_creer_activite_secours()
    and (created_by is null or created_by = auth.uid())
  );

create policy activites_secours_update on public.activites_secours
  for update to authenticated
  using (public.peut_creer_activite_secours())
  with check (public.peut_creer_activite_secours());

create policy activites_secours_delete on public.activites_secours
  for delete to authenticated
  using (public.peut_creer_activite_secours());

drop policy if exists activites_secours_inscrits_select on public.activites_secours_inscrits;
drop policy if exists activites_secours_inscrits_insert on public.activites_secours_inscrits;
drop policy if exists activites_secours_inscrits_delete on public.activites_secours_inscrits;

create policy activites_secours_inscrits_select on public.activites_secours_inscrits
  for select to authenticated
  using (public.is_staff());

create policy activites_secours_inscrits_insert on public.activites_secours_inscrits
  for insert to authenticated
  with check (
    public.is_staff()
    and user_id = auth.uid()
  );

create policy activites_secours_inscrits_delete on public.activites_secours_inscrits
  for delete to authenticated
  using (
    public.is_staff()
    and user_id = auth.uid()
  );

notify pgrst, 'reload schema';
