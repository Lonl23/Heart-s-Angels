-- ════════════════════════════════════════════════════════════════════════════
--  Événements internes ASBL + qui encode les disponibilités pour autrui.
--  Idempotent. Après 77_role_utilisateur_asbl.sql.
--
--  Disponibilités : les équipes informatique, logistique, transport,
--  coordination bénévoles, récolteurs et présidence encodent UNIQUEMENT
--  leur propre calendrier. Les autres sièges ASBL (coordination médicale,
--  trésorerie, relations publiques, administrateur, …) + compte admin /
--  coordinateur encodent pour les volontaires de terrain.
--
--  Événements : lecture personnel ; création/édition = peut_gerer_app,
--  peut_gerer_fiches, ou tout siège ASBL (responsable / adjoint).
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.peut_gerer_dispos()
returns boolean language sql stable security definer set search_path = public as $$
  with me as (select role::text as role, fiche from public.profiles where id = auth.uid())
  select coalesce((
    select role in ('admin', 'coordinateur', 'tresorier')
        or coalesce(fiche->'roles_asbl' ?| array[
             'coord_medical', 'coord_medical_adjoint', 'coordinateur_medical',
             'tresorier', 'tresorier_adjoint',
             'relations_publiques', 'relations_publiques_adjoint',
             'administrateur_asbl'
           ], false)
    from me
  ), false)
$$;

create or replace function public.peut_voir_toutes_dispos()
returns boolean language sql stable security definer set search_path = public as $$
  with me as (select role::text as role, fiche from public.profiles where id = auth.uid())
  select coalesce((
    select role in ('admin', 'president', 'coordinateur', 'tresorier')
        or public.peut_gerer_dispos()
        or coalesce(fiche->'roles_asbl' ?| array[
             'president', 'vice_president',
             'coord_transport', 'coord_transport_adjoint',
             'recolteur_souhait',
             'coord_benevoles', 'coord_benevoles_adjoint',
             'resp_informatique', 'resp_informatique_adjoint', 'administrateur_asbl',
             'coord_medical', 'coord_medical_adjoint', 'coordinateur_medical',
             'tresorier', 'tresorier_adjoint',
             'relations_publiques', 'relations_publiques_adjoint'
           ], false)
    from me
  ), false)
$$;

grant execute on function public.peut_gerer_dispos() to authenticated;
grant execute on function public.peut_voir_toutes_dispos() to authenticated;

create table if not exists public.evenements_internes (
  id               uuid primary key default gen_random_uuid(),
  titre            text not null,
  date_debut       date not null,
  date_fin         date,
  description      text,
  inscription_url  text,
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint evenements_internes_dates check (date_fin is null or date_fin >= date_debut)
);

drop trigger if exists trg_evenements_internes_updated on public.evenements_internes;
create trigger trg_evenements_internes_updated before update on public.evenements_internes
  for each row execute function public.set_updated_at();

create index if not exists evenements_internes_dates_idx
  on public.evenements_internes (date_debut, date_fin);

comment on table public.evenements_internes is
  'Événements internes ASBL (réunions, assemblées) avec lien d’inscription. Pas les souhaits / missions patient.';

create or replace function public.peut_gerer_evenements_internes()
returns boolean language sql stable security definer set search_path = public as $$
  with me as (select role::text as role, fiche from public.profiles where id = auth.uid())
  select coalesce((
    select public.peut_gerer_app()
        or public.peut_gerer_fiches()
        or exists (
          select 1
          from jsonb_array_elements_text(coalesce(fiche->'roles_asbl', '[]'::jsonb)) r
          where r is not null and r <> '' and r <> 'simple_volontaire'
        )
    from me
  ), false)
$$;

grant execute on function public.peut_gerer_evenements_internes() to authenticated;
grant select, insert, update, delete on public.evenements_internes to authenticated;

alter table public.evenements_internes enable row level security;

drop policy if exists evenements_internes_select on public.evenements_internes;
drop policy if exists evenements_internes_insert on public.evenements_internes;
drop policy if exists evenements_internes_update on public.evenements_internes;
drop policy if exists evenements_internes_delete on public.evenements_internes;
drop policy if exists evenements_internes_staff_all on public.evenements_internes;

create policy evenements_internes_select on public.evenements_internes
  for select to authenticated
  using (public.is_staff());

create policy evenements_internes_insert on public.evenements_internes
  for insert to authenticated
  with check (public.peut_gerer_evenements_internes());

create policy evenements_internes_update on public.evenements_internes
  for update to authenticated
  using (public.peut_gerer_evenements_internes())
  with check (public.peut_gerer_evenements_internes());

create policy evenements_internes_delete on public.evenements_internes
  for delete to authenticated
  using (public.peut_gerer_evenements_internes());

do $$
declare c text;
begin
  select con.conname into c
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public' and rel.relname = 'app_fonds_pages'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%page%';
  if c is not null then
    execute format('alter table public.app_fonds_pages drop constraint %I', c);
  end if;
end $$;

do $$ begin
  alter table public.app_fonds_pages
    add constraint app_fonds_pages_page_check
    check (page in (
      'dashboard', 'disponibilites', 'evenements', 'defraiements',
      'profil', 'volontaires', 'login'
    ));
exception when duplicate_object then null;
end $$;

insert into public.app_fonds_pages (page) values ('evenements')
on conflict (page) do nothing;

notify pgrst, 'reload schema';
