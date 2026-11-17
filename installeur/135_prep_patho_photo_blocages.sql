-- ════════════════════════════════════════════════════════════════════════════
--  Référentiels activités / pathologies, rôle photographe, notif photo,
--  blocages utilisateur / appareil.
--  Idempotent. Après 134_formation_prep_hors_missions.sql.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.activites_souhait_referentiel (
  id uuid primary key default gen_random_uuid(),
  libelle text not null,
  ordre int not null default 0,
  actif boolean not null default true,
  unique (libelle)
);

create table if not exists public.pathologies_referentiel (
  id uuid primary key default gen_random_uuid(),
  libelle text not null,
  ordre int not null default 0,
  actif boolean not null default true,
  unique (libelle)
);

insert into public.activites_souhait_referentiel (libelle, ordre) values
  ('Mer', 10), ('Zoo', 20), ('Parc', 30), ('Concert', 40), ('Restaurant', 50),
  ('Rencontre', 60), ('Sport', 70), ('Voyage', 80), ('À domicile', 90), ('Cérémonie', 100)
on conflict (libelle) do nothing;

insert into public.pathologies_referentiel (libelle, ordre) values
  ('Glioblastome', 10),
  ('Sclérose latérale amyotrophique', 20),
  ('Sclérose en plaques', 30),
  ('Cancer du poumon', 40),
  ('Insuffisance cardiaque', 50),
  ('BPCO', 60),
  ('Parkinson', 70),
  ('Alzheimer', 80)
on conflict (libelle) do nothing;

alter table public.activites_souhait_referentiel enable row level security;
alter table public.pathologies_referentiel enable row level security;

drop policy if exists activites_souhait_ref_lecture on public.activites_souhait_referentiel;
create policy activites_souhait_ref_lecture on public.activites_souhait_referentiel
  for select to authenticated using (true);

drop policy if exists activites_souhait_ref_ecriture on public.activites_souhait_referentiel;
create policy activites_souhait_ref_ecriture on public.activites_souhait_referentiel
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists pathologies_ref_lecture on public.pathologies_referentiel;
create policy pathologies_ref_lecture on public.pathologies_referentiel
  for select to authenticated using (true);

drop policy if exists pathologies_ref_ecriture on public.pathologies_referentiel;
create policy pathologies_ref_ecriture on public.pathologies_referentiel
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- Blocages d’accès (compte et/ou appareil)
create table if not exists public.acces_blocages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  appareil_cle text,
  motif text not null default '',
  actif boolean not null default true,
  bloque_par uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  check (user_id is not null or coalesce(appareil_cle, '') <> '')
);

create index if not exists acces_blocages_user_idx on public.acces_blocages (user_id) where actif;
create index if not exists acces_blocages_appareil_idx on public.acces_blocages (appareil_cle) where actif and coalesce(appareil_cle,'') <> '';

alter table public.acces_blocages enable row level security;

create or replace function public.peut_bloquer_acces()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (
        p.role::text in ('admin', 'president', 'coordinateur')
        or coalesce(p.fiche->'roles_asbl' ?| array[
          'president','vice_president',
          'resp_informatique','resp_informatique_adjoint',
          'recolteur_souhait',
          'coord_transport','coord_transport_adjoint',
          'resp_logistique','resp_logistique_adjoint',
          'coord_medical','coord_medical_adjoint','coordinateur_medical'
        ], false)
      )
  );
$$;

revoke all on function public.peut_bloquer_acces() from public, anon;
grant execute on function public.peut_bloquer_acces() to authenticated;

drop policy if exists acces_blocages_lecture on public.acces_blocages;
create policy acces_blocages_lecture on public.acces_blocages
  for select to authenticated using (public.is_staff());

drop policy if exists acces_blocages_ecriture on public.acces_blocages;
create policy acces_blocages_ecriture on public.acces_blocages
  for all to authenticated
  using (public.peut_bloquer_acces())
  with check (public.peut_bloquer_acces());

create or replace function public.est_acces_bloque(p_user uuid default auth.uid(), p_appareil text default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.acces_blocages b
    where b.actif
      and (
        (p_user is not null and b.user_id = p_user)
        or (coalesce(p_appareil, '') <> '' and b.appareil_cle = p_appareil)
      )
  );
$$;

revoke all on function public.est_acces_bloque(uuid, text) from public, anon;
grant execute on function public.est_acces_bloque(uuid, text) to authenticated;

-- Photographes ASBL : notifiés quand date + équipage validés
create or replace function public.roles_equipe_notification(p_type text)
returns text[]
language sql
immutable
as $$
  select case p_type
    when 'demande_souhait' then array['recolteur_souhait']
    when 'equipage_incomplet' then array['coord_benevoles','coord_benevoles_adjoint','coord_transport','coord_transport_adjoint']
    when 'rapport_materiel' then array['resp_logistique','resp_logistique_adjoint']
    when 'peremption_stock' then array['resp_logistique','resp_logistique_adjoint']
    when 'stock_bas' then array['resp_logistique','resp_logistique_adjoint']
    when 'oxygene_basse' then array['resp_logistique','resp_logistique_adjoint']
    when 'entretien_materiel' then array['resp_logistique','resp_logistique_adjoint']
    when 'commande_rappel' then array['resp_logistique','resp_logistique_adjoint']
    when 'ticket_plein' then array['tresorier','tresorier_adjoint','president','vice_president']
    when 'protocole_detresse' then array['coord_medical','coord_medical_adjoint','coordinateur_medical']
    when 'helpdesk_nouveau' then array['resp_informatique','resp_informatique_adjoint']
    when 'dispo_retiree' then array['coord_benevoles','coord_benevoles_adjoint']
    when 'echeance_staff' then array['coord_benevoles','coord_benevoles_adjoint']
    when 'acces_preparation_souhait' then array['president','vice_president']
    when 'souhait_pret_photographe' then array['photographe']
    else null
  end
$$;

create or replace function public.notifier_photographes_souhait(p_souhait uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.souhaits%rowtype;
  lieu text;
  n int;
begin
  if p_souhait is null then return 0; end if;
  select * into s from public.souhaits where id = p_souhait;
  if not found then return 0; end if;
  if coalesce(s.fictif, false) then return 0; end if;
  if public.est_souhait_formation_preparation(p_souhait) then return 0; end if;

  lieu := coalesce(
    nullif(s.localisation, ''),
    s.mission->'dest_adresse'->>'localite',
    'lieu à confirmer'
  );

  n := public.notifier_evenement(
    'souhait_pret_photographe',
    'Souhait prêt — photographes',
    coalesce(s.beneficiaire_prenom, 'Patient') || ' · ' || public.fmt_dates_souhait(s) || ' · ' || lieu,
    '/app/souhaits/' || p_souhait::text,
    'normale',
    null,
    p_souhait,
    jsonb_build_object('souhait_id', p_souhait, 'sans_dedup', true)
  );
  return n;
end
$$;

revoke all on function public.notifier_photographes_souhait(uuid) from public, anon;
grant execute on function public.notifier_photographes_souhait(uuid) to authenticated;

notify pgrst, 'reload schema';
