-- Vérification d’un sac ou d’un appareil relié à une plaque.
-- Une fois validée, elle ne se réécrit pas. Aucun retard de routine n’est calculé.

alter table public.stock_lieux
  add column if not exists plaque_id uuid references public.plaques_vehicules(id) on delete set null;

create index if not exists stock_lieux_plaque_idx on public.stock_lieux (plaque_id);

comment on column public.stock_lieux.plaque_id is
  'Plaque à laquelle ce sac ou cet appareil est relié, pour le check.';

create table if not exists public.vehicule_verifications (
  id uuid primary key default gen_random_uuid(),
  vehicule_id uuid not null references public.plaques_vehicules(id) on delete cascade,
  lieu_id uuid not null references public.stock_lieux(id) on delete cascade,
  auteur_id uuid not null,
  ouverte boolean not null default true,
  commence_le timestamptz not null default now(),
  valide_le timestamptz,
  valide_par uuid,
  dates_verifiees boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists vehicule_verifications_ouverte_idx
  on public.vehicule_verifications (vehicule_id, lieu_id)
  where ouverte;

create index if not exists vehicule_verifications_vehicule_idx
  on public.vehicule_verifications (vehicule_id, commence_le desc);

create table if not exists public.vehicule_verification_lignes (
  id uuid primary key default gen_random_uuid(),
  verification_id uuid not null references public.vehicule_verifications(id) on delete cascade,
  catalogue_id uuid references public.stock_catalogue(id) on delete set null,
  categorie text,
  libelle text not null,
  qte numeric,
  coche boolean not null default false,
  date_peremption date,
  constraint vehicule_verification_lignes_libelle check (char_length(btrim(libelle)) between 1 and 240)
);

create unique index if not exists vehicule_verification_lignes_article_idx
  on public.vehicule_verification_lignes (verification_id, catalogue_id);

create or replace function public.vehicule_verifications_garde()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is null then
      raise exception 'connexion requise';
    end if;
    new.auteur_id := auth.uid();
    new.ouverte := true;
    new.valide_le := null;
    new.valide_par := null;
    new.dates_verifiees := false;
    if new.commence_le is null then
      new.commence_le := now();
    end if;
    return new;
  end if;

  if old.valide_le is not null then
    raise exception 'vérification déjà validée';
  end if;

  new.vehicule_id := old.vehicule_id;
  new.lieu_id := old.lieu_id;
  new.auteur_id := old.auteur_id;
  new.commence_le := old.commence_le;
  new.created_at := old.created_at;

  if new.valide_le is not null then
    new.ouverte := false;
    new.valide_par := auth.uid();
  else
    new.ouverte := true;
    new.valide_par := null;
  end if;
  return new;
end $$;

create or replace function public.vehicule_verification_lignes_garde()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v public.vehicule_verifications;
begin
  select * into v
  from public.vehicule_verifications
  where id = coalesce(new.verification_id, old.verification_id);

  if not found or v.valide_le is not null or not v.ouverte then
    raise exception 'vérification fermée';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  if tg_op = 'UPDATE' then
    new.verification_id := old.verification_id;
    new.catalogue_id := old.catalogue_id;
    new.libelle := old.libelle;
    new.categorie := old.categorie;
    new.qte := old.qte;
    new.date_peremption := old.date_peremption;
  end if;
  return new;
end $$;

revoke all on function public.vehicule_verifications_garde() from public, anon;
revoke all on function public.vehicule_verification_lignes_garde() from public, anon;

drop trigger if exists trg_vehicule_verifications_garde on public.vehicule_verifications;
create trigger trg_vehicule_verifications_garde
  before insert or update on public.vehicule_verifications
  for each row execute function public.vehicule_verifications_garde();

drop trigger if exists trg_vehicule_verification_lignes_garde on public.vehicule_verification_lignes;
create trigger trg_vehicule_verification_lignes_garde
  before insert or update or delete on public.vehicule_verification_lignes
  for each row execute function public.vehicule_verification_lignes_garde();

alter table public.vehicule_verifications enable row level security;
alter table public.vehicule_verification_lignes enable row level security;

drop policy if exists vehicule_verifications_select on public.vehicule_verifications;
create policy vehicule_verifications_select on public.vehicule_verifications
  for select to authenticated using (public.is_staff());
drop policy if exists vehicule_verifications_insert on public.vehicule_verifications;
create policy vehicule_verifications_insert on public.vehicule_verifications
  for insert to authenticated with check (public.is_staff() and auteur_id = auth.uid());
drop policy if exists vehicule_verifications_update on public.vehicule_verifications;
create policy vehicule_verifications_update on public.vehicule_verifications
  for update to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists vehicule_verifications_delete on public.vehicule_verifications;
create policy vehicule_verifications_delete on public.vehicule_verifications
  for delete to authenticated using (public.is_staff() and ouverte);

drop policy if exists vehicule_verification_lignes_select on public.vehicule_verification_lignes;
create policy vehicule_verification_lignes_select on public.vehicule_verification_lignes
  for select to authenticated using (public.is_staff());
drop policy if exists vehicule_verification_lignes_insert on public.vehicule_verification_lignes;
create policy vehicule_verification_lignes_insert on public.vehicule_verification_lignes
  for insert to authenticated with check (public.is_staff());
drop policy if exists vehicule_verification_lignes_update on public.vehicule_verification_lignes;
create policy vehicule_verification_lignes_update on public.vehicule_verification_lignes
  for update to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists vehicule_verification_lignes_delete on public.vehicule_verification_lignes;
create policy vehicule_verification_lignes_delete on public.vehicule_verification_lignes
  for delete to authenticated using (public.is_staff());

revoke all on public.vehicule_verifications from anon, public;
revoke all on public.vehicule_verification_lignes from anon, public;
grant select, insert, update, delete on public.vehicule_verifications to authenticated, service_role;
grant select, insert, update, delete on public.vehicule_verification_lignes to authenticated, service_role;

notify pgrst, 'reload schema';
