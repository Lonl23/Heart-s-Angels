-- Antécédents configurables (préparation médicale).
-- Idempotent.

create table if not exists public.antecedents_referentiel (
  id uuid primary key default gen_random_uuid(),
  libelle text not null,
  ordre int not null default 0,
  actif boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists antecedents_referentiel_libelle_uq
  on public.antecedents_referentiel (lower(libelle));

alter table public.antecedents_referentiel enable row level security;

drop policy if exists antecedents_referentiel_select on public.antecedents_referentiel;
create policy antecedents_referentiel_select on public.antecedents_referentiel
  for select to authenticated using (true);

drop policy if exists antecedents_referentiel_write on public.antecedents_referentiel;
create policy antecedents_referentiel_write on public.antecedents_referentiel
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

insert into public.antecedents_referentiel (libelle, ordre)
select v.libelle, v.ordre from (values
  ('Hypertension', 10),
  ('Diabète', 20),
  ('Insuffisance cardiaque', 30),
  ('AVC / AIT', 40),
  ('BPCO', 50),
  ('Insuffisance rénale', 60),
  ('Cancer', 70),
  ('Épilepsie', 80)
) as v(libelle, ordre)
where not exists (
  select 1 from public.antecedents_referentiel a where lower(a.libelle) = lower(v.libelle)
);
