-- Fiches patients des préventifs (RescueTrack).
-- Table dédiée : aucun lien avec public.souhaits ni avec fiches_patient_dps.
-- Déjà appliquée sur le projet Heart's Angels. Les ordres sont réexécutables.

create or replace function public.province_depuis_cp(p_cp text)
returns text
language sql
immutable
as $$
  with n as (
    select substring(coalesce(p_cp, '') from '([0-9]{4})')::int as cp
  )
  select case
    when cp between 1000 and 1299 then 'Bruxelles'
    when cp between 1300 and 1499 then 'Brabant wallon'
    when cp between 1500 and 1999 or cp between 3000 and 3499 then 'Brabant flamand'
    when cp between 2000 and 2999 then 'Anvers'
    when cp between 3500 and 3999 then 'Limbourg'
    when cp between 4000 and 4999 then 'Liège'
    when cp between 5000 and 5999 then 'Namur'
    when cp between 6000 and 6599 or cp between 7000 and 7999 then 'Hainaut'
    when cp between 6600 and 6999 then 'Luxembourg'
    when cp between 8000 and 8999 then 'Flandre occidentale'
    when cp between 9000 and 9999 then 'Flandre orientale'
    else null
  end
  from n;
$$;

create or replace function public.rescuetrack_code_province(p_nom text)
returns text
language sql
immutable
as $$
  select case p_nom
    when 'Liège' then 'LIE'
    when 'Namur' then 'NAM'
    when 'Hainaut' then 'HAI'
    when 'Luxembourg' then 'LUX'
    when 'Bruxelles' then 'BRU'
    when 'Brabant wallon' then 'BWA'
    when 'Brabant flamand' then 'BFL'
    when 'Anvers' then 'ANV'
    when 'Limbourg' then 'LIM'
    when 'Flandre orientale' then 'FOR'
    when 'Flandre occidentale' then 'FOC'
    else 'XXX'
  end;
$$;

create or replace function public.activite_est_preventif(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.activites_secours a
    where a.id = p_id
      and (
        a.type = 'preventif'
        or a.dispositif is not null
        or cardinality(a.dispositifs) > 0
      )
  );
$$;

create table if not exists public.rescuetrack_fiches (
  id uuid primary key default gen_random_uuid(),
  preventif_id uuid not null references public.activites_secours(id) on delete cascade,
  numero_local integer not null check (numero_local >= 1 and numero_local <= 9999),
  code_patient text not null check (char_length(code_patient) between 4 and 24),
  nom text check (nom is null or char_length(nom) <= 120),
  prenom text check (prenom is null or char_length(prenom) <= 120),
  date_naissance date,
  sexe text check (sexe is null or sexe = any (array['Homme','Femme','Indéterminé / inconnu'])),
  triage_initial text check (triage_initial is null or triage_initial = any (array['U1','U2','U3H','U3NH','IMPLIQUE','DCD'])),
  triage_actuel text check (triage_actuel is null or triage_actuel = any (array['U1','U2','U3H','U3NH','IMPLIQUE','DCD'])),
  triage_sortie text check (triage_sortie is null or triage_sortie = any (array['U1','U2','U3H','U3NH','IMPLIQUE','DCD'])),
  heure_entree timestamptz not null default now(),
  heure_sortie timestamptz,
  destination text check (destination is null or char_length(destination) <= 80),
  fiche jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (preventif_id, numero_local),
  unique (code_patient),
  constraint rescuetrack_fiches_objet check (jsonb_typeof(fiche) = 'object'),
  constraint rescuetrack_fiches_taille check (octet_length(fiche::text) <= 12000),
  constraint rescuetrack_fiches_heures check (heure_sortie is null or heure_sortie >= heure_entree)
);

comment on table public.rescuetrack_fiches is
  'Fiches patients des préventifs, saisies dans RescueTrack. Distinct des dossiers de souhaits.';

create index if not exists rescuetrack_fiches_preventif_idx
  on public.rescuetrack_fiches (preventif_id, numero_local);

create table if not exists public.rescuetrack_logbook (
  id uuid primary key default gen_random_uuid(),
  preventif_id uuid not null references public.activites_secours(id) on delete cascade,
  dispositif text check (dispositif is null or char_length(dispositif) <= 80),
  texte text not null check (char_length(btrim(texte)) between 1 and 2000),
  created_by uuid references public.profiles(id) on delete set null,
  auteur text check (auteur is null or char_length(auteur) <= 160),
  created_at timestamptz not null default now()
);

comment on table public.rescuetrack_logbook is
  'Main courante d''un préventif. Distincte du suivi d''un souhait.';

create index if not exists rescuetrack_logbook_preventif_idx
  on public.rescuetrack_logbook (preventif_id, created_at desc);

create or replace function public.rescuetrack_fiche_garde()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not public.activite_est_preventif(new.preventif_id) then
    raise exception 'RescueTrack n''enregistre des patients que sur un préventif';
  end if;
  if tg_op = 'UPDATE' and new.preventif_id is distinct from old.preventif_id then
    raise exception 'Une fiche de préventif ne change pas de dispositif';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists rescuetrack_fiches_garde on public.rescuetrack_fiches;
create trigger rescuetrack_fiches_garde
  before insert or update on public.rescuetrack_fiches
  for each row execute function public.rescuetrack_fiche_garde();

create or replace function public.rescuetrack_enregistrer_fiche(
  p_id uuid,
  p_preventif uuid,
  p_fiche jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.rescuetrack_fiches;
  v_num integer;
  v_code text;
  v_prov text;
  v_evt integer;
  v_cp text;
  v_triage text;
  v_initial text;
  v_sortie text;
  v_sexe text;
  v_ddn date;
  v_entree timestamptz;
  v_sortie_h timestamptz;
  v_doc jsonb;
begin
  if not public.is_staff() then
    raise exception 'Accès refusé';
  end if;
  if p_preventif is null or not public.activite_est_preventif(p_preventif) then
    raise exception 'RescueTrack n''enregistre des patients que sur un préventif existant';
  end if;
  if p_fiche is null or jsonb_typeof(p_fiche) <> 'object' then
    raise exception 'Fiche invalide';
  end if;
  if octet_length(p_fiche::text) > 12000 then
    raise exception 'Fiche trop volumineuse';
  end if;

  v_triage := nullif(p_fiche->>'triageCurrent', '');
  v_initial := nullif(p_fiche->>'triageInitial', '');
  v_sortie := nullif(p_fiche->>'triageOut', '');
  v_sexe := nullif(p_fiche->>'sex', '');
  if v_triage is not null and v_triage not in ('U1','U2','U3H','U3NH','IMPLIQUE','DCD') then
    raise exception 'Triage inconnu';
  end if;
  if v_initial is not null and v_initial not in ('U1','U2','U3H','U3NH','IMPLIQUE','DCD') then
    raise exception 'Triage inconnu';
  end if;
  if v_sortie is not null and v_sortie not in ('U1','U2','U3H','U3NH','IMPLIQUE','DCD') then
    raise exception 'Triage inconnu';
  end if;
  if v_sexe is not null and v_sexe not in ('Homme','Femme','Indéterminé / inconnu') then
    raise exception 'Sexe inconnu';
  end if;
  if char_length(coalesce(p_fiche->>'lastName','')) > 120
     or char_length(coalesce(p_fiche->>'firstName','')) > 120
     or char_length(coalesce(p_fiche->>'nationalNumber','')) > 20
     or char_length(coalesce(p_fiche->>'chiefComplaint','')) > 2000
     or char_length(coalesce(p_fiche->>'clinicalNotes','')) > 4000 then
    raise exception 'Champ trop long';
  end if;

  begin
    v_ddn := nullif(p_fiche->>'birthDate', '')::date;
  exception when others then
    raise exception 'Date de naissance invalide';
  end;
  begin
    v_entree := nullif(p_fiche->>'timeIn', '')::timestamptz;
    v_sortie_h := nullif(p_fiche->>'timeOut', '')::timestamptz;
  exception when others then
    raise exception 'Heure invalide';
  end;

  if p_id is null then
    perform pg_advisory_xact_lock(hashtext('rescuetrack-fiche'), hashtext(p_preventif::text));
    select coalesce(max(numero_local), 0) + 1 into v_num
      from public.rescuetrack_fiches
      where preventif_id = p_preventif;
    select a.numero, a.adresse_cp into v_evt, v_cp
      from public.activites_secours a
      where a.id = p_preventif;
    v_prov := public.rescuetrack_code_province(public.province_depuis_cp(v_cp));
    v_code := to_char(now() at time zone 'Europe/Brussels', 'YY')
      || v_prov
      || lpad(coalesce(v_evt, 0)::text, 3, '0')
      || lpad(v_num::text, 3, '0');
    v_doc := p_fiche || jsonb_build_object(
      'patientCode', v_code,
      'patientSequence', v_num,
      'eventId', p_preventif,
      'triageInitial', coalesce(v_initial, v_triage),
      'triageCurrent', v_triage
    );
    insert into public.rescuetrack_fiches (
      preventif_id, numero_local, code_patient, nom, prenom, date_naissance, sexe,
      triage_initial, triage_actuel, triage_sortie, heure_entree, heure_sortie,
      destination, fiche, created_by
    ) values (
      p_preventif, v_num, v_code,
      nullif(btrim(p_fiche->>'lastName'), ''),
      nullif(btrim(p_fiche->>'firstName'), ''),
      v_ddn, v_sexe,
      coalesce(v_initial, v_triage), v_triage, v_sortie,
      coalesce(v_entree, now()), v_sortie_h,
      nullif(p_fiche->>'destination', ''),
      v_doc, auth.uid()
    ) returning * into r;
  else
    update public.rescuetrack_fiches set
      nom = nullif(btrim(p_fiche->>'lastName'), ''),
      prenom = nullif(btrim(p_fiche->>'firstName'), ''),
      date_naissance = v_ddn,
      sexe = v_sexe,
      triage_initial = coalesce(v_initial, triage_initial),
      triage_actuel = v_triage,
      triage_sortie = v_sortie,
      heure_sortie = v_sortie_h,
      destination = nullif(p_fiche->>'destination', ''),
      fiche = p_fiche || jsonb_build_object(
        'patientCode', code_patient,
        'patientSequence', numero_local,
        'eventId', preventif_id,
        'triageInitial', coalesce(v_initial, triage_initial),
        'triageCurrent', v_triage
      )
    where id = p_id and preventif_id = p_preventif
    returning * into r;
    if not found then
      raise exception 'Fiche introuvable';
    end if;
  end if;

  return jsonb_build_object(
    'id', r.id,
    'preventif_id', r.preventif_id,
    'numero_local', r.numero_local,
    'code_patient', r.code_patient,
    'nom', r.nom,
    'prenom', r.prenom,
    'date_naissance', r.date_naissance,
    'sexe', r.sexe,
    'triage_initial', r.triage_initial,
    'triage_actuel', r.triage_actuel,
    'triage_sortie', r.triage_sortie,
    'heure_entree', r.heure_entree,
    'heure_sortie', r.heure_sortie,
    'destination', r.destination,
    'fiche', r.fiche,
    'created_at', r.created_at
  );
end;
$$;

alter table public.rescuetrack_fiches enable row level security;
alter table public.rescuetrack_logbook enable row level security;

drop policy if exists rescuetrack_fiches_select on public.rescuetrack_fiches;
drop policy if exists rescuetrack_fiches_insert on public.rescuetrack_fiches;
drop policy if exists rescuetrack_fiches_update on public.rescuetrack_fiches;
drop policy if exists rescuetrack_fiches_delete on public.rescuetrack_fiches;
drop policy if exists rescuetrack_logbook_select on public.rescuetrack_logbook;
drop policy if exists rescuetrack_logbook_insert on public.rescuetrack_logbook;
drop policy if exists rescuetrack_logbook_delete on public.rescuetrack_logbook;

create policy rescuetrack_fiches_select on public.rescuetrack_fiches
  for select to authenticated using (public.is_staff());
create policy rescuetrack_fiches_insert on public.rescuetrack_fiches
  for insert to authenticated
  with check (public.is_staff() and created_by = auth.uid() and public.activite_est_preventif(preventif_id));
create policy rescuetrack_fiches_update on public.rescuetrack_fiches
  for update to authenticated
  using (public.is_staff() and public.activite_est_preventif(preventif_id))
  with check (public.is_staff() and public.activite_est_preventif(preventif_id));
create policy rescuetrack_fiches_delete on public.rescuetrack_fiches
  for delete to authenticated using (public.peut_creer_activite_secours());

create policy rescuetrack_logbook_select on public.rescuetrack_logbook
  for select to authenticated using (public.is_staff());
create policy rescuetrack_logbook_insert on public.rescuetrack_logbook
  for insert to authenticated
  with check (public.is_staff() and created_by = auth.uid() and public.activite_est_preventif(preventif_id));
create policy rescuetrack_logbook_delete on public.rescuetrack_logbook
  for delete to authenticated using (public.peut_creer_activite_secours());

revoke all on function public.province_depuis_cp(text) from public, anon;
revoke all on function public.rescuetrack_code_province(text) from public, anon;
revoke all on function public.activite_est_preventif(uuid) from public, anon;
revoke all on function public.rescuetrack_enregistrer_fiche(uuid, uuid, jsonb) from public, anon;
grant execute on function public.province_depuis_cp(text) to authenticated;
grant execute on function public.rescuetrack_code_province(text) to authenticated;
grant execute on function public.activite_est_preventif(uuid) to authenticated;
grant execute on function public.rescuetrack_enregistrer_fiche(uuid, uuid, jsonb) to authenticated;

revoke all on table public.rescuetrack_fiches from anon;
revoke all on table public.rescuetrack_logbook from anon;
grant select, insert, update, delete on table public.rescuetrack_fiches to authenticated;
grant select, insert, delete on table public.rescuetrack_logbook to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'rescuetrack_fiches'
  ) then
    alter publication supabase_realtime add table public.rescuetrack_fiches;
  end if;
end $$;
