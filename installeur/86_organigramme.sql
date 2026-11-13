-- ════════════════════════════════════════════════════════════════════════════
--  Organigramme composé dans IT : chaque personne placée a un N+1.
--  Le N+2 est le N+1 de ce N+1. Les rôles restent sur la fiche.
--  Lecture : personnel. Écriture : peut_gerer_app (IT).
--  Idempotent. Après 85_smtp_from_app.sql.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.organigramme (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  n1_id      uuid references public.profiles(id) on delete set null,
  ordre      int not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.organigramme drop constraint if exists organigramme_pas_soi;
alter table public.organigramme
  add constraint organigramme_pas_soi check (n1_id is distinct from profile_id);

create index if not exists organigramme_n1_idx on public.organigramme (n1_id);

comment on table public.organigramme is
  'Personnes affichées dans l’organigramme. n1_id est leur N+1, choisi dans IT.';

create or replace function public.organigramme_verifier()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  cur uuid;
  garde int := 0;
begin
  if new.n1_id is null then
    return new;
  end if;
  if not exists (select 1 from public.organigramme o where o.profile_id = new.n1_id) then
    raise exception 'Le N+1 doit déjà figurer sur l’organigramme.';
  end if;
  cur := new.n1_id;
  while cur is not null and garde < 40 loop
    if cur = new.profile_id then
      raise exception 'Cette chaîne reboucle : choisissez un autre N+1.';
    end if;
    select o.n1_id into cur from public.organigramme o where o.profile_id = cur;
    garde := garde + 1;
  end loop;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.organigramme_retirer()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update public.organigramme
     set n1_id = old.n1_id,
         updated_at = now()
   where n1_id = old.profile_id;
  return old;
end;
$$;

drop trigger if exists organigramme_verifier on public.organigramme;
create trigger organigramme_verifier
  before insert or update on public.organigramme
  for each row execute function public.organigramme_verifier();

drop trigger if exists organigramme_retirer on public.organigramme;
create trigger organigramme_retirer
  before delete on public.organigramme
  for each row execute function public.organigramme_retirer();

revoke all on function public.organigramme_verifier() from public, anon;
revoke all on function public.organigramme_retirer() from public, anon;
grant execute on function public.organigramme_verifier() to authenticated;
grant execute on function public.organigramme_retirer() to authenticated;

alter table public.organigramme enable row level security;

drop policy if exists organigramme_select on public.organigramme;
create policy organigramme_select on public.organigramme
  for select to authenticated
  using (public.is_staff());

drop policy if exists organigramme_write on public.organigramme;
create policy organigramme_write on public.organigramme
  for all to authenticated
  using (public.peut_gerer_app())
  with check (public.peut_gerer_app());

grant select, insert, update, delete on public.organigramme to authenticated;
grant all on public.organigramme to service_role;

notify pgrst, 'reload schema';
