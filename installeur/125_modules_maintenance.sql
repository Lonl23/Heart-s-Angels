-- ════════════════════════════════════════════════════════════════════════════
--  Onglets en maintenance : l’informatique active / désactive un module.
--  Désactivé → les volontaires voient une page d’attente ; l’IT garde l’accès.
--  Idempotent. Après 124_formation_hors_preparation.sql.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.app_modules_maintenance (
  module_key  text primary key,
  actif       boolean not null default true,
  message     text,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles(id) on delete set null
);

comment on table public.app_modules_maintenance is
  'État des onglets de l’app : actif=false = maintenance pour les non-IT.';

insert into public.app_modules_maintenance (module_key, actif) values
  ('ma_fiche', true),
  ('fiches', true),
  ('defraiements', true),
  ('annuaire', true),
  ('organigramme', true),
  ('evenements', true),
  ('ouvertures', true),
  ('actualites', true),
  ('souhaits', true),
  ('missions', true),
  ('disponibilites', true),
  ('activites_secours', true),
  ('conventions_dps', true),
  ('helpdesk', true),
  ('personnalisation', true),
  ('admin', true),
  ('organigramme_edition', true),
  ('config_souhaits', true),
  ('actualites_edition', true),
  ('statistiques', true),
  ('stock', true),
  ('flotte', true),
  ('tresorerie', true),
  ('modules_menu', true)
on conflict (module_key) do nothing;

alter table public.app_modules_maintenance enable row level security;

drop policy if exists app_modules_maintenance_select on public.app_modules_maintenance;
create policy app_modules_maintenance_select on public.app_modules_maintenance
  for select to authenticated
  using (true);

drop policy if exists app_modules_maintenance_write on public.app_modules_maintenance;
create policy app_modules_maintenance_write on public.app_modules_maintenance
  for all to authenticated
  using (public.peut_gerer_helpdesk())
  with check (public.peut_gerer_helpdesk());

grant select on public.app_modules_maintenance to authenticated;
grant insert, update, delete on public.app_modules_maintenance to authenticated, service_role;

create or replace function public.trg_app_modules_maintenance_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end
$$;

drop trigger if exists trg_app_modules_maintenance_touch on public.app_modules_maintenance;
create trigger trg_app_modules_maintenance_touch
  before update on public.app_modules_maintenance
  for each row execute function public.trg_app_modules_maintenance_touch();

notify pgrst, 'reload schema';
