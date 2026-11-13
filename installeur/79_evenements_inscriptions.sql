-- ════════════════════════════════════════════════════════════════════════════
--  Événements internes : page HTML + vignette (informatique), inscriptions
--  dans l’app, décompte pour les responsables. Idempotent. Après 78.
--
--  Édition HTML/vignette : resp_informatique (+ adjoint), admin, président.
--  Voir le nombre d’inscrits : responsables d’équipe ASBL (pas les adjoints).
--  Volontaires : lire, s’inscrire / se désinscrire soi-même.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.evenements_internes
  add column if not exists html_page text,
  add column if not exists html_vignette text,
  add column if not exists vignette_path text;

alter table public.evenements_internes alter column date_debut drop not null;

alter table public.evenements_internes drop constraint if exists evenements_internes_dates;
alter table public.evenements_internes add constraint evenements_internes_dates
  check (date_fin is null or date_debut is null or date_fin >= date_debut);

comment on table public.evenements_internes is
  'Événements internes ASBL : vignette du menu + HTML de la page d’inscription (composé par l’informatique).';
comment on column public.evenements_internes.html_page is
  'HTML de la page d’inscription (sous-ensemble sans script), éditable par l’informatique.';
comment on column public.evenements_internes.vignette_path is
  'Chemin de l’image de vignette dans le bucket evenements-vignettes.';

create or replace function public.peut_gerer_evenements_internes()
returns boolean language sql stable security definer set search_path = public as $$
  with me as (select role::text as role, fiche from public.profiles where id = auth.uid())
  select coalesce((
    select role in ('admin', 'president')
        or coalesce(fiche->'roles_asbl' ?| array[
             'president',
             'resp_informatique', 'resp_informatique_adjoint'
           ], false)
    from me
  ), false)
$$;

create or replace function public.est_responsable_asbl()
returns boolean language sql stable security definer set search_path = public as $$
  with me as (select role::text as role, fiche from public.profiles where id = auth.uid())
  select coalesce((
    select role in ('admin', 'president', 'coordinateur', 'tresorier')
        or coalesce(fiche->'roles_asbl' ?| array[
             'president',
             'coord_benevoles',
             'resp_logistique',
             'coord_transport',
             'coord_medical', 'coordinateur_medical',
             'tresorier',
             'resp_informatique',
             'relations_publiques',
             'recolteur_souhait',
             'administrateur_asbl'
           ], false)
    from me
  ), false)
$$;

grant execute on function public.peut_gerer_evenements_internes() to authenticated;
grant execute on function public.est_responsable_asbl() to authenticated;

create table if not exists public.evenements_internes_inscrits (
  id            uuid primary key default gen_random_uuid(),
  evenement_id  uuid not null references public.evenements_internes(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  created_at    timestamptz not null default now(),
  unique (evenement_id, user_id)
);

create index if not exists evenements_internes_inscrits_evt_idx
  on public.evenements_internes_inscrits (evenement_id);
create index if not exists evenements_internes_inscrits_user_idx
  on public.evenements_internes_inscrits (user_id);

comment on table public.evenements_internes_inscrits is
  'Inscriptions des volontaires aux événements internes. Chacun pose / retire sa propre ligne.';

grant select, insert, delete on public.evenements_internes_inscrits to authenticated;

alter table public.evenements_internes_inscrits enable row level security;

drop policy if exists evenements_inscrits_select on public.evenements_internes_inscrits;
drop policy if exists evenements_inscrits_insert on public.evenements_internes_inscrits;
drop policy if exists evenements_inscrits_delete on public.evenements_internes_inscrits;

create policy evenements_inscrits_select on public.evenements_internes_inscrits
  for select to authenticated
  using (
    public.is_staff()
    and (
      user_id = auth.uid()
      or public.est_responsable_asbl()
      or public.peut_gerer_evenements_internes()
    )
  );

create policy evenements_inscrits_insert on public.evenements_internes_inscrits
  for insert to authenticated
  with check (
    public.is_staff()
    and user_id = auth.uid()
    and exists (select 1 from public.evenements_internes e where e.id = evenement_id)
  );

create policy evenements_inscrits_delete on public.evenements_internes_inscrits
  for delete to authenticated
  using (public.is_staff() and user_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'evenements-vignettes',
  'evenements-vignettes',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists evenements_vignettes_select on storage.objects;
drop policy if exists evenements_vignettes_insert on storage.objects;
drop policy if exists evenements_vignettes_update on storage.objects;
drop policy if exists evenements_vignettes_delete on storage.objects;

create policy evenements_vignettes_select on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'evenements-vignettes');

create policy evenements_vignettes_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'evenements-vignettes' and public.peut_gerer_evenements_internes());

create policy evenements_vignettes_update on storage.objects
  for update to authenticated
  using (bucket_id = 'evenements-vignettes' and public.peut_gerer_evenements_internes());

create policy evenements_vignettes_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'evenements-vignettes' and public.peut_gerer_evenements_internes());

notify pgrst, 'reload schema';
