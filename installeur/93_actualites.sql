-- Actualités de l'ASBL.
-- Lecture : personnel, articles publiés. Brouillons : équipe qui publie.
-- Publication : présidence, informatique, relations publiques.

create or replace function public.peut_publier_actualites()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with me as (select role::text as role, fiche from public.profiles where id = auth.uid())
  select coalesce((
    select public.peut_gerer_app()
        or role = 'admin'
        or coalesce(fiche->'roles_asbl' ?| array[
             'president', 'vice_president',
             'resp_informatique', 'resp_informatique_adjoint',
             'relations_publiques', 'relations_publiques_adjoint'
           ], false)
    from me
  ), false)
$$;

grant execute on function public.peut_publier_actualites() to authenticated;

create table if not exists public.actualites (
  id             uuid primary key default gen_random_uuid(),
  titre          text not null,
  chapo          text,
  vignette_path  text,
  blocs          jsonb not null default '[]'::jsonb,
  statut         text not null default 'brouillon',
  publie_le      timestamptz,
  created_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint actualites_statut_check check (statut in ('brouillon', 'publie'))
);

drop trigger if exists trg_actualites_updated on public.actualites;
create trigger trg_actualites_updated before update on public.actualites
  for each row execute function public.set_updated_at();

create index if not exists actualites_publie_idx
  on public.actualites (publie_le desc nulls last, created_at desc);

comment on table public.actualites is
  'Nouvelles de l’ASBL. Le corps est une suite de blocs (texte, intertitre, photo, citation), pas du HTML libre.';

grant select, insert, update, delete on public.actualites to authenticated;

alter table public.actualites enable row level security;

drop policy if exists actualites_select on public.actualites;
drop policy if exists actualites_insert on public.actualites;
drop policy if exists actualites_update on public.actualites;
drop policy if exists actualites_delete on public.actualites;

create policy actualites_select on public.actualites
  for select to authenticated
  using (
    public.is_staff()
    and (statut = 'publie' or public.peut_publier_actualites())
  );

create policy actualites_insert on public.actualites
  for insert to authenticated
  with check (public.peut_publier_actualites());

create policy actualites_update on public.actualites
  for update to authenticated
  using (public.peut_publier_actualites())
  with check (public.peut_publier_actualites());

create policy actualites_delete on public.actualites
  for delete to authenticated
  using (public.peut_publier_actualites());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'actualites-images',
  'actualites-images',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists actualites_images_select on storage.objects;
drop policy if exists actualites_images_insert on storage.objects;
drop policy if exists actualites_images_update on storage.objects;
drop policy if exists actualites_images_delete on storage.objects;

create policy actualites_images_select on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'actualites-images');

create policy actualites_images_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'actualites-images' and public.peut_publier_actualites());

create policy actualites_images_update on storage.objects
  for update to authenticated
  using (bucket_id = 'actualites-images' and public.peut_publier_actualites());

create policy actualites_images_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'actualites-images' and public.peut_publier_actualites());

notify pgrst, 'reload schema';
