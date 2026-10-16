-- ════════════════════════════════════════════════════════════════════════════
--  Module souhaits : référentiels IT, journal d’accès, contacts, plaque.
--  Idempotent. Après 88_organigramme_n1_volontaires.sql.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.souhaits add column if not exists beneficiaire_email text;
alter table public.souhaits add column if not exists beneficiaire_adresse_residence jsonb;
alter table public.souhaits add column if not exists contact_email text;
alter table public.souhaits add column if not exists contacts jsonb not null default '[]'::jsonb;

create table if not exists public.bases_depart (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  rue text,
  numero text,
  cp text,
  localite text,
  pays text default 'Belgique',
  protocole text not null default '',
  ordre int not null default 0,
  actif boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.referentiel_institutions (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  telephone text,
  email text,
  rue text,
  numero text,
  cp text,
  localite text,
  pays text default 'Belgique',
  ordre int not null default 0,
  actif boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.referentiel_services (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.referentiel_institutions(id) on delete cascade,
  nom text not null,
  telephone text,
  ordre int not null default 0,
  actif boolean not null default true
);

create table if not exists public.materiel_emporter (
  id uuid primary key default gen_random_uuid(),
  libelle text not null,
  ordre int not null default 0,
  actif boolean not null default true
);

create table if not exists public.plaques_vehicules (
  id uuid primary key default gen_random_uuid(),
  plaque text not null,
  libelle text,
  actif boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists plaques_vehicules_plaque_uq
  on public.plaques_vehicules (lower(plaque));

create table if not exists public.destinations_frequentes (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  rue text,
  numero text,
  cp text,
  localite text,
  pays text default 'Belgique',
  telephone text,
  notes text,
  actif boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.allergies_referentiel (
  id uuid primary key default gen_random_uuid(),
  libelle text not null,
  ordre int not null default 0,
  actif boolean not null default true
);

create unique index if not exists allergies_referentiel_libelle_uq
  on public.allergies_referentiel (lower(libelle));

create table if not exists public.souhait_journal (
  id uuid primary key default gen_random_uuid(),
  souhait_id uuid not null references public.souhaits(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  personne text,
  action text not null,
  detail jsonb,
  created_at timestamptz not null default now()
);

create index if not exists souhait_journal_souhait_idx
  on public.souhait_journal (souhait_id, created_at desc);

insert into public.bases_depart (nom, rue, numero, cp, localite, pays, protocole, ordre)
select 'Solumob Jemeppe-sur-Meuse', 'Rue sous les vignes', '8', '4101', 'Seraing', 'Belgique', '', 10
where not exists (select 1 from public.bases_depart where lower(nom) like '%jemeppe%');

insert into public.materiel_emporter (libelle, ordre)
select v.libelle, v.ordre
from (values
  ('Kit supplémentaire', 10),
  ('Sac intervention', 20),
  ('Sac paramédic', 30),
  ('Sac confort', 40),
  ('Chaise roulante', 50),
  ('Coussin demi-lune', 60),
  ('Baffle', 70),
  ('O2 B2', 80),
  ('O2 B5', 90),
  ('O2 B10', 100)
) as v(libelle, ordre)
where not exists (select 1 from public.materiel_emporter m where lower(m.libelle) = lower(v.libelle));

insert into public.allergies_referentiel (libelle, ordre)
select v.libelle, v.ordre
from (values
  ('Aucune connue', 10),
  ('Pénicilline', 20),
  ('Latex', 30),
  ('Iode', 40),
  ('Produits de contraste', 50),
  ('Morphine', 60),
  ('AINS', 70),
  ('Arachide', 80),
  ('Fruits à coque', 90),
  ('Œuf', 100),
  ('Lait', 110),
  ('Gluten', 120),
  ('Soja', 130),
  ('Pollen', 140),
  ('Acariens', 150),
  ('Venin d''hyménoptères', 160)
) as v(libelle, ordre)
where not exists (select 1 from public.allergies_referentiel a where lower(a.libelle) = lower(v.libelle));

-- Le coordinateur logistique prépare aussi les souhaits (déjà dans la liste, rappel idempotent).
create or replace function public.peut_voir_souhaits()
returns boolean language sql stable security definer set search_path = public as $$
  with me as (select role::text as role, fiche from public.profiles where id = auth.uid())
  select coalesce((
    select role in ('admin','president','coordinateur','medecin','infirmier','ambulancier_bleu','ambulancier_gris')
        or (fiche->>'type_benevole') = 'medical'
        or coalesce(fiche->'roles_asbl' ?| array[
             'president','vice_president','administrateur_asbl','recolteur_souhait',
             'coord_transport','coord_transport_adjoint','coord_benevoles','coord_benevoles_adjoint',
             'resp_informatique','resp_informatique_adjoint',
             'coord_medical','coord_medical_adjoint','coordinateur_medical',
             'resp_logistique','resp_logistique_adjoint'], false)
    from me
  ), false)
$$;

create or replace function public.maj_plaque_vecteur(p_souhait uuid, p_vecteur text, p_plaque text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  m jsonb;
  vs jsonb;
  i int;
  plaque text := trim(coalesce(p_plaque, ''));
begin
  if p_souhait is null or p_vecteur is null or p_vecteur = '' then
    return json_build_object('ok', false, 'error', 'vecteur manquant');
  end if;
  if not (public.suis_affecte(p_souhait) or public.peut_voir_souhaits()) then
    return json_build_object('ok', false, 'error', 'non autorisé');
  end if;
  select coalesce(mission, '{}'::jsonb) into m from public.souhaits where id = p_souhait for update;
  if not found then
    return json_build_object('ok', false, 'error', 'souhait introuvable');
  end if;
  vs := coalesce(m->'vecteurs', '[]'::jsonb);
  if jsonb_typeof(vs) <> 'array' then
    vs := '[]'::jsonb;
  end if;
  for i in 0 .. coalesce(jsonb_array_length(vs), 0) - 1 loop
    if vs->i->>'id' = p_vecteur then
      vs := jsonb_set(vs, array[i::text, 'plaque'], to_jsonb(plaque), true);
    end if;
  end loop;
  m := jsonb_set(m, '{vecteurs}', vs, true);
  update public.souhaits set mission = m where id = p_souhait;
  if plaque <> '' and not exists (
    select 1 from public.plaques_vehicules pv where lower(pv.plaque) = lower(plaque)
  ) then
    begin
      insert into public.plaques_vehicules (plaque) values (plaque);
    exception when unique_violation then
      null;
    end;
  end if;
  return json_build_object('ok', true, 'plaque', plaque);
end $$;

grant execute on function public.peut_voir_souhaits() to authenticated;
grant execute on function public.maj_plaque_vecteur(uuid, text, text) to authenticated;

alter table public.bases_depart enable row level security;
alter table public.referentiel_institutions enable row level security;
alter table public.referentiel_services enable row level security;
alter table public.materiel_emporter enable row level security;
alter table public.plaques_vehicules enable row level security;
alter table public.destinations_frequentes enable row level security;
alter table public.allergies_referentiel enable row level security;
alter table public.souhait_journal enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'bases_depart','referentiel_institutions','referentiel_services',
    'materiel_emporter','plaques_vehicules','destinations_frequentes','allergies_referentiel'
  ]
  loop
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format('create policy %I_select on public.%I for select to authenticated using (public.is_staff())', t, t);
    execute format('drop policy if exists %I_write on public.%I', t, t);
    execute format('create policy %I_write on public.%I for all to authenticated using (public.peut_gerer_app()) with check (public.peut_gerer_app())', t, t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;

-- L’équipage peut mémoriser une plaque pendant le souhait (fonction security definer).
drop policy if exists destinations_frequentes_insert_staff on public.destinations_frequentes;
create policy destinations_frequentes_insert_staff on public.destinations_frequentes
  for insert to authenticated
  with check (public.is_staff());

drop policy if exists plaques_vehicules_insert_staff on public.plaques_vehicules;
create policy plaques_vehicules_insert_staff on public.plaques_vehicules
  for insert to authenticated
  with check (public.is_staff());

drop policy if exists souhait_journal_select on public.souhait_journal;
create policy souhait_journal_select on public.souhait_journal
  for select to authenticated
  using (public.peut_voir_souhaits());

drop policy if exists souhait_journal_insert on public.souhait_journal;
create policy souhait_journal_insert on public.souhait_journal
  for insert to authenticated
  with check (
    public.peut_voir_souhaits()
    and profile_id = auth.uid()
    and action in ('entree', 'sortie', 'modification')
  );

grant select, insert on public.souhait_journal to authenticated;
grant all on public.souhait_journal to service_role;

notify pgrst, 'reload schema';
