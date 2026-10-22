-- Check véhicule : un point signalé reste quand l’équipe change.
-- Photos des 4 côtés et checklists du souhait ne sont pas ici.

create table if not exists public.vehicule_suivi (
  vehicule_id uuid primary key references public.plaques_vehicules(id) on delete cascade,
  dernier_km integer,
  desinfection_le timestamptz,
  desinfection_par uuid,
  constraint vehicule_suivi_km check (
    dernier_km is null or dernier_km between 0 and 9999999
  )
);

create table if not exists public.vehicule_constats (
  id uuid primary key default gen_random_uuid(),
  vehicule_id uuid not null references public.plaques_vehicules(id) on delete cascade,
  categorie text not null,
  libelle text not null,
  ouvert boolean not null default true,
  auteur_id uuid not null,
  clos_le timestamptz,
  clos_par uuid,
  created_at timestamptz not null default now(),
  constraint vehicule_constats_categorie check (categorie in ('hygiene', 'materiel', 'mecanique')),
  constraint vehicule_constats_libelle check (char_length(btrim(libelle)) between 1 and 240)
);

create index if not exists vehicule_constats_vehicule_idx
  on public.vehicule_constats (vehicule_id, ouvert, categorie);

comment on table public.vehicule_constats is
  'Points ouverts sur un véhicule. Ils restent visibles pour l’équipe suivante.';
comment on column public.vehicule_suivi.desinfection_le is
  'Dernière désinfection enregistrée. Aucun délai n’est calculé.';

create or replace function public.vehicule_constats_garde()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.auteur_id := auth.uid();
    new.ouvert := true;
    new.clos_le := null;
    new.clos_par := null;
    new.libelle := btrim(new.libelle);
    return new;
  end if;
  new.vehicule_id := old.vehicule_id;
  new.categorie := old.categorie;
  new.libelle := old.libelle;
  new.auteur_id := old.auteur_id;
  new.created_at := old.created_at;
  if old.ouvert and new.ouvert = false then
    new.clos_le := now();
    new.clos_par := auth.uid();
  else
    new.ouvert := old.ouvert;
    new.clos_le := old.clos_le;
    new.clos_par := old.clos_par;
  end if;
  return new;
end $$;

revoke all on function public.vehicule_constats_garde() from public, anon;

drop trigger if exists trg_vehicule_constats_garde on public.vehicule_constats;
create trigger trg_vehicule_constats_garde
  before insert or update on public.vehicule_constats
  for each row execute function public.vehicule_constats_garde();

alter table public.vehicule_suivi enable row level security;
alter table public.vehicule_constats enable row level security;

drop policy if exists vehicule_suivi_select on public.vehicule_suivi;
create policy vehicule_suivi_select on public.vehicule_suivi
  for select to authenticated using (public.is_staff());
drop policy if exists vehicule_suivi_insert on public.vehicule_suivi;
create policy vehicule_suivi_insert on public.vehicule_suivi
  for insert to authenticated with check (public.is_staff());
drop policy if exists vehicule_suivi_update on public.vehicule_suivi;
create policy vehicule_suivi_update on public.vehicule_suivi
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists vehicule_constats_select on public.vehicule_constats;
create policy vehicule_constats_select on public.vehicule_constats
  for select to authenticated using (public.is_staff());
drop policy if exists vehicule_constats_insert on public.vehicule_constats;
create policy vehicule_constats_insert on public.vehicule_constats
  for insert to authenticated with check (public.is_staff() and auteur_id = auth.uid());
drop policy if exists vehicule_constats_update on public.vehicule_constats;
create policy vehicule_constats_update on public.vehicule_constats
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

revoke all on public.vehicule_suivi from anon, public;
revoke all on public.vehicule_constats from anon, public;
grant select, insert, update, delete on public.vehicule_suivi to authenticated, service_role;
grant select, insert, update, delete on public.vehicule_constats to authenticated, service_role;

notify pgrst, 'reload schema';
