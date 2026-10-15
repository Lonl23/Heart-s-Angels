-- ════════════════════════════════════════════════════════════════════════════
--  Fonds d’écran : le responsable informatique pose une image sur le tableau
--  de bord et les pages peu chargées (pas Souhaits, Stock, Missions…).
--  Idempotent. Après 74_demo_colonnes_libres.sql.
-- ════════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'fonds-app',
  'fonds-app',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.app_fonds (
  id          uuid primary key default gen_random_uuid(),
  path        text not null unique,
  nom         text,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table if not exists public.app_fonds_pages (
  page       text primary key
             check (page in (
               'dashboard', 'disponibilites', 'defraiements',
               'profil', 'volontaires', 'login'
             )),
  fond_id    uuid references public.app_fonds(id) on delete set null,
  intensite  smallint not null default 22
             check (intensite between 8 and 80),
  updated_at timestamptz not null default now()
);

insert into public.app_fonds_pages (page) values
  ('dashboard'), ('disponibilites'), ('defraiements'),
  ('profil'), ('volontaires'), ('login')
on conflict (page) do nothing;

comment on table public.app_fonds is
  'Images de fond posées par l’informatique (décoratives, pas de données de santé).';
comment on table public.app_fonds_pages is
  'Quelle image s’affiche sur quelle page légère, avec un voile pour garder le texte lisible.';

alter table public.app_fonds enable row level security;
alter table public.app_fonds_pages enable row level security;

drop policy if exists app_fonds_select on public.app_fonds;
create policy app_fonds_select on public.app_fonds
  for select to anon, authenticated
  using (true);

drop policy if exists app_fonds_write on public.app_fonds;
create policy app_fonds_write on public.app_fonds
  for all to authenticated
  using (public.peut_gerer_app())
  with check (public.peut_gerer_app());

drop policy if exists app_fonds_pages_select on public.app_fonds_pages;
create policy app_fonds_pages_select on public.app_fonds_pages
  for select to anon, authenticated
  using (true);

drop policy if exists app_fonds_pages_write on public.app_fonds_pages;
create policy app_fonds_pages_write on public.app_fonds_pages
  for all to authenticated
  using (public.peut_gerer_app())
  with check (public.peut_gerer_app());

grant select on public.app_fonds, public.app_fonds_pages to anon, authenticated;
grant insert, update, delete on public.app_fonds, public.app_fonds_pages to authenticated, service_role;

drop policy if exists fonds_app_select on storage.objects;
create policy fonds_app_select on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'fonds-app');

drop policy if exists fonds_app_insert on storage.objects;
create policy fonds_app_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'fonds-app' and public.peut_gerer_app());

drop policy if exists fonds_app_update on storage.objects;
create policy fonds_app_update on storage.objects
  for update to authenticated
  using (bucket_id = 'fonds-app' and public.peut_gerer_app());

drop policy if exists fonds_app_delete on storage.objects;
create policy fonds_app_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'fonds-app' and public.peut_gerer_app());

notify pgrst, 'reload schema';
