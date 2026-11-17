-- Interfaces O₂ configurables (lunettes, masques…) pour le dossier médical.
create table if not exists public.interfaces_o2_referentiel (
  id uuid primary key default gen_random_uuid(),
  libelle text not null,
  ordre int not null default 0,
  actif boolean not null default true
);

create unique index if not exists interfaces_o2_referentiel_libelle_uq
  on public.interfaces_o2_referentiel (lower(libelle));

insert into public.interfaces_o2_referentiel (libelle, ordre)
select v.libelle, v.ordre
from (values
  ('Lunettes', 10),
  ('Masque 60%', 20),
  ('Masque 100%', 30)
) as v(libelle, ordre)
where not exists (
  select 1 from public.interfaces_o2_referentiel r where lower(r.libelle) = lower(v.libelle)
);

alter table public.interfaces_o2_referentiel enable row level security;

drop policy if exists interfaces_o2_ref_lecture on public.interfaces_o2_referentiel;
create policy interfaces_o2_ref_lecture on public.interfaces_o2_referentiel
  for select to authenticated using (true);

drop policy if exists interfaces_o2_ref_ecriture on public.interfaces_o2_referentiel;
create policy interfaces_o2_ref_ecriture on public.interfaces_o2_referentiel
  for all to authenticated
  using (true)
  with check (true);
