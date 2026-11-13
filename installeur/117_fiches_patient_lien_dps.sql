-- Fiches patient pour l’appli liée (patient-registry), rattachées à un DPS.
-- Pas de dossier médical lourd ici : identité + lien mission + métadonnées minimales.
-- L’UI complète vit dans patient-registry/ ; cette table est la jointure ERP ↔ patient.

create table if not exists public.fiches_patient_dps (
  id uuid primary key default gen_random_uuid(),
  activite_id uuid not null references public.activites_secours(id) on delete cascade,
  numero_local integer,
  nom text,
  prenom text,
  date_naissance date,
  sexe text,
  motifs text,
  heure_prise_en_charge timestamptz,
  heure_fin timestamptz,
  orientation text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fiches_patient_dps_sexe check (sexe is null or sexe in ('F', 'M', 'X', 'inconnu')),
  constraint fiches_patient_dps_nom check (nom is null or char_length(nom) <= 120),
  constraint fiches_patient_dps_prenom check (prenom is null or char_length(prenom) <= 120)
);

create index if not exists fiches_patient_dps_activite_idx
  on public.fiches_patient_dps (activite_id);

drop trigger if exists trg_fiches_patient_dps_updated on public.fiches_patient_dps;
create trigger trg_fiches_patient_dps_updated
  before update on public.fiches_patient_dps
  for each row execute function public.set_updated_at();

alter table public.fiches_patient_dps enable row level security;

drop policy if exists fiches_patient_dps_select on public.fiches_patient_dps;
drop policy if exists fiches_patient_dps_write on public.fiches_patient_dps;
drop policy if exists fiches_patient_dps_update on public.fiches_patient_dps;
drop policy if exists fiches_patient_dps_delete on public.fiches_patient_dps;

-- Lecture / écriture : staff + responsables DPS (création activité = même gate pour commencer).
create policy fiches_patient_dps_select on public.fiches_patient_dps
  for select to authenticated
  using (public.is_staff());

create policy fiches_patient_dps_insert on public.fiches_patient_dps
  for insert to authenticated
  with check (public.is_staff() and (created_by is null or created_by = auth.uid()));

create policy fiches_patient_dps_update on public.fiches_patient_dps
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy fiches_patient_dps_delete on public.fiches_patient_dps
  for delete to authenticated
  using (public.peut_creer_activite_secours());

grant select, insert, update, delete on table public.fiches_patient_dps to authenticated, service_role;
revoke all on table public.fiches_patient_dps from anon, public;

comment on table public.fiches_patient_dps is
  'Fiches patient liées à un DPS. UI dédiée dans patient-registry/ ; ERP Heart’s Angels lit le lien.';

notify pgrst, 'reload schema';
