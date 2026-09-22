-- ════════════════════════════════════════════════════════════════════════════
--  Archives souhaits : verrou 1 mois calendrier après réalisation.
--  Ouverture PIN 5 chiffres : président, vice-président, resp. informatique
--  (pas l’adjoint). Le volontaire crée le PIN dans sa fiche.
--  La place de responsable informatique ne peut pas rester vacante.
--  Idempotent. Après 53_mes_missions_a_realiser.sql.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.profiles
  add column if not exists archive_pin_hash text,
  add column if not exists archive_pin_at timestamptz,
  add column if not exists archive_pin_echecs int not null default 0,
  add column if not exists archive_pin_bloque_jusqua timestamptz;

comment on column public.profiles.archive_pin_hash is
  'Hash bcrypt du PIN 5 chiffres (archives). Jamais le PIN en clair.';

revoke all on table public.profiles from anon;
grant select, insert, update, delete on public.profiles to authenticated, service_role;
revoke select (archive_pin_hash) on public.profiles from authenticated;
revoke update (archive_pin_hash, archive_pin_echecs, archive_pin_bloque_jusqua, archive_pin_at)
  on public.profiles from authenticated;

create table if not exists public.archive_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  souhait_id  uuid not null references public.souhaits(id) on delete cascade,
  opened_at   timestamptz not null default now(),
  expires_at  timestamptz not null,
  unique (user_id, souhait_id)
);

create table if not exists public.archive_ouvertures (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles(id) on delete set null,
  souhait_id  uuid not null references public.souhaits(id) on delete cascade,
  opened_at   timestamptz not null default now()
);

create index if not exists archive_sessions_exp_idx on public.archive_sessions (expires_at);
create index if not exists archive_ouvertures_souhait_idx on public.archive_ouvertures (souhait_id, opened_at desc);

alter table public.archive_sessions enable row level security;
alter table public.archive_ouvertures enable row level security;

drop policy if exists archive_sessions_own on public.archive_sessions;
create policy archive_sessions_own on public.archive_sessions
  for select to authenticated using (user_id = auth.uid());

drop policy if exists archive_ouvertures_own on public.archive_ouvertures;
create policy archive_ouvertures_own on public.archive_ouvertures
  for select to authenticated using (user_id = auth.uid());

revoke all on public.archive_sessions from anon, authenticated, public;
revoke all on public.archive_ouvertures from anon, authenticated, public;
grant select on public.archive_sessions, public.archive_ouvertures to authenticated;
grant all on public.archive_sessions, public.archive_ouvertures to service_role;

-- ── Rôles & informatique ─────────────────────────────────────────────────────

create or replace function public.profil_a_role_asbl(p_fiche jsonb, p_role text)
returns boolean
language sql immutable as $$
  select coalesce(p_fiche->'roles_asbl' ? p_role, false)
$$;

create or replace function public.nb_resp_informatique()
returns integer
language sql
stable
security definer
set search_path = public, extensions
as $$
  select count(*)::int from public.profiles
  where coalesce(actif, true)
    and public.profil_a_role_asbl(coalesce(fiche, '{}'::jsonb), 'resp_informatique')
$$;

create or replace function public.trg_informatique_non_vacante()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_autres int;
  v_reste boolean;
begin
  if tg_op = 'DELETE' then
    if coalesce(old.actif, true)
       and public.profil_a_role_asbl(coalesce(old.fiche, '{}'::jsonb), 'resp_informatique') then
      select count(*) into v_autres from public.profiles
      where id is distinct from old.id
        and coalesce(actif, true)
        and public.profil_a_role_asbl(coalesce(fiche, '{}'::jsonb), 'resp_informatique');
      if v_autres < 1 then
        raise exception 'La place de responsable informatique ne peut pas rester vacante. Attribuez d’abord le rôle à quelqu’un d’autre.';
      end if;
    end if;
    return old;
  end if;

  v_reste := coalesce(new.actif, true)
    and public.profil_a_role_asbl(coalesce(new.fiche, '{}'::jsonb), 'resp_informatique');
  if v_reste then
    return new;
  end if;
  if not (coalesce(old.actif, true)
          and public.profil_a_role_asbl(coalesce(old.fiche, '{}'::jsonb), 'resp_informatique')) then
    return new;
  end if;
  select count(*) into v_autres from public.profiles
  where id is distinct from new.id
    and coalesce(actif, true)
    and public.profil_a_role_asbl(coalesce(fiche, '{}'::jsonb), 'resp_informatique');
  if v_autres < 1 then
    raise exception 'La place de responsable informatique ne peut pas rester vacante. Attribuez d’abord le rôle à quelqu’un d’autre.';
  end if;
  return new;
end $$;

drop trigger if exists trg_informatique_non_vacante on public.profiles;
create trigger trg_informatique_non_vacante
  before update or delete on public.profiles
  for each row execute function public.trg_informatique_non_vacante();

-- ── PIN ──────────────────────────────────────────────────────────────────────

create or replace function public.pin_archive_invalide(p_pin text)
returns text
language plpgsql
immutable
as $$
declare
  p text;
  i int;
  d int;
  monoton int;
begin
  p := regexp_replace(coalesce(p_pin, ''), '\D', '', 'g');
  if length(p) <> 5 then
    return 'Le code doit contenir exactement 5 chiffres.';
  end if;
  for i in 2..5 loop
    if substr(p, i, 1) = substr(p, i - 1, 1) then
      return 'Deux chiffres identiques ne peuvent pas se suivre.';
    end if;
  end loop;
  if p = reverse(p) then
    return 'Le code ne peut pas être un nombre miroir.';
  end if;
  monoton := (substr(p, 2, 1)::int - substr(p, 1, 1)::int);
  if abs(monoton) = 1 then
    d := monoton;
    for i in 3..5 loop
      if (substr(p, i, 1)::int - substr(p, i - 1, 1)::int) is distinct from d then
        d := 99;
        exit;
      end if;
    end loop;
    if abs(d) = 1 then
      return 'Le code ne peut pas être une suite de chiffres.';
    end if;
  end if;
  return null;
end $$;

create or replace function public.peut_ouvrir_archives()
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select coalesce((
    select public.profil_a_role_asbl(coalesce(fiche, '{}'::jsonb), 'president')
        or public.profil_a_role_asbl(coalesce(fiche, '{}'::jsonb), 'vice_president')
        or public.profil_a_role_asbl(coalesce(fiche, '{}'::jsonb), 'resp_informatique')
    from public.profiles
    where id = auth.uid() and coalesce(actif, true)
  ), false)
$$;

create or replace function public.trg_revoquer_pin_si_plus_eligible()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if tg_op = 'UPDATE' then
    if not (
         coalesce(new.actif, true)
         and (
           public.profil_a_role_asbl(coalesce(new.fiche, '{}'::jsonb), 'president')
           or public.profil_a_role_asbl(coalesce(new.fiche, '{}'::jsonb), 'vice_president')
           or public.profil_a_role_asbl(coalesce(new.fiche, '{}'::jsonb), 'resp_informatique')
         )
       ) then
      new.archive_pin_hash := null;
      new.archive_pin_at := null;
      new.archive_pin_echecs := 0;
      new.archive_pin_bloque_jusqua := null;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_revoquer_pin_si_plus_eligible on public.profiles;
create trigger trg_revoquer_pin_si_plus_eligible
  before update on public.profiles
  for each row execute function public.trg_revoquer_pin_si_plus_eligible();

create or replace function public.definir_pin_archive(p_pin text, p_ancien text default null)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  err text;
  h text;
  a text;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'error', 'Non authentifié.');
  end if;
  if not public.peut_ouvrir_archives() then
    return json_build_object('ok', false, 'error', 'Seul le président, la vice-présidente ou le responsable informatique peuvent créer ce code.');
  end if;
  err := public.pin_archive_invalide(p_pin);
  if err is not null then
    return json_build_object('ok', false, 'error', err);
  end if;
  select archive_pin_hash into h from public.profiles where id = auth.uid();
  if h is not null then
    if p_ancien is null or crypt(regexp_replace(p_ancien, '\D', '', 'g'), h) is distinct from h then
      return json_build_object('ok', false, 'error', 'Indiquez d’abord l’ancien code pour le remplacer.');
    end if;
  end if;
  a := regexp_replace(p_pin, '\D', '', 'g');
  update public.profiles set
    archive_pin_hash = crypt(a, gen_salt('bf', 8)),
    archive_pin_at = now(),
    archive_pin_echecs = 0,
    archive_pin_bloque_jusqua = null
  where id = auth.uid();
  return json_build_object('ok', true);
end $$;

create or replace function public.mon_pin_archive_defini()
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select coalesce((
    select archive_pin_hash is not null
    from public.profiles where id = auth.uid()
  ), false)
$$;

-- ── Verrou calendaire ────────────────────────────────────────────────────────

create or replace function public.date_bruxelles()
returns date
language sql stable as $$
  select (timezone('Europe/Brussels', now()))::date
$$;

create or replace function public.date_verrouillage_souhait(p_realisee date, p_updated timestamptz)
returns date
language sql immutable as $$
  select (coalesce(p_realisee, (p_updated at time zone 'Europe/Brussels')::date) + interval '1 month')::date
$$;

create or replace function public.souhait_est_archive(s public.souhaits)
returns boolean
language sql stable as $$
  select s.statut::text = 'realise'
    and public.date_verrouillage_souhait(s.date_realisee, s.updated_at) <= public.date_bruxelles()
$$;

create or replace function public.souhait_id_est_archive(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select coalesce((
    select public.souhait_est_archive(s) from public.souhaits s where s.id = p_id
  ), false)
$$;

create or replace function public.archive_session_valide(p_souhait uuid)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select public.peut_ouvrir_archives()
    and exists (
      select 1 from public.archive_sessions
      where user_id = auth.uid()
        and souhait_id = p_souhait
        and expires_at > now()
    )
$$;

create or replace function public.acces_dossier_autorise(p_souhait uuid)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select p_souhait is not null and (
    (not public.souhait_id_est_archive(p_souhait) and public.peut_voir_souhaits())
    or public.archive_session_valide(p_souhait)
  )
$$;

create or replace function public.etat_souhait_archive(p_id uuid)
returns json
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  s public.souhaits;
begin
  select * into s from public.souhaits where id = p_id;
  if s.id is null then
    return json_build_object('ok', false, 'existe', false);
  end if;
  return json_build_object(
    'ok', true,
    'existe', true,
    'archive', public.souhait_est_archive(s),
    'peut_ouvrir', public.peut_ouvrir_archives(),
    'a_pin', public.mon_pin_archive_defini(),
    'verrouille_au', public.date_verrouillage_souhait(s.date_realisee, s.updated_at)
  );
end $$;

create or replace function public.lister_souhaits_archives()
returns table(
  id uuid,
  beneficiaire_prenom text,
  beneficiaire_nom text,
  date_souhaitee date,
  date_realisee date,
  verrouille_au date,
  fictif boolean
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    s.id,
    s.beneficiaire_prenom,
    s.beneficiaire_nom,
    s.date_souhaitee,
    s.date_realisee,
    public.date_verrouillage_souhait(s.date_realisee, s.updated_at),
    coalesce(s.fictif, false)
  from public.souhaits s
  where public.peut_ouvrir_archives()
    and public.souhait_est_archive(s)
  order by s.date_realisee desc nulls last, s.updated_at desc
$$;

create or replace function public.ouvrir_souhait_archive(p_id uuid, p_pin text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  s public.souhaits;
  h text;
  a text;
  bloq timestamptz;
  n int;
  err text;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'error', 'Non authentifié.');
  end if;
  if not public.peut_ouvrir_archives() then
    return json_build_object('ok', false, 'error', 'Accès réservé au président, à la vice-présidente et au responsable informatique.');
  end if;
  select * into s from public.souhaits where id = p_id;
  if s.id is null then
    return json_build_object('ok', false, 'error', 'Dossier introuvable.');
  end if;
  if not public.souhait_est_archive(s) then
    return json_build_object('ok', false, 'error', 'Ce dossier n’est pas encore archivé.');
  end if;

  select archive_pin_hash, archive_pin_bloque_jusqua, archive_pin_echecs
    into h, bloq, n
  from public.profiles where id = auth.uid();
  if h is null then
    return json_build_object('ok', false, 'error', 'Créez d’abord votre code PIN dans votre fiche volontaire.');
  end if;
  if bloq is not null and bloq > now() then
    return json_build_object('ok', false, 'error', 'Trop d’essais. Réessayez plus tard.');
  end if;
  err := public.pin_archive_invalide(p_pin);
  a := regexp_replace(coalesce(p_pin, ''), '\D', '', 'g');
  if crypt(a, h) is distinct from h then
    n := coalesce(n, 0) + 1;
    update public.profiles set
      archive_pin_echecs = n,
      archive_pin_bloque_jusqua = case when n >= 5 then now() + interval '15 minutes' else archive_pin_bloque_jusqua end
    where id = auth.uid();
    return json_build_object('ok', false, 'error', 'Code incorrect.');
  end if;

  update public.profiles set archive_pin_echecs = 0, archive_pin_bloque_jusqua = null
  where id = auth.uid();

  insert into public.archive_sessions (user_id, souhait_id, expires_at)
  values (auth.uid(), p_id, now() + interval '30 minutes')
  on conflict (user_id, souhait_id) do update
    set opened_at = now(), expires_at = now() + interval '30 minutes';

  insert into public.archive_ouvertures (user_id, souhait_id) values (auth.uid(), p_id);

  return json_build_object('ok', true, 'expires_at', (now() + interval '30 minutes'));
end $$;

-- ── RLS dossiers ─────────────────────────────────────────────────────────────

drop policy if exists souhaits_voir on public.souhaits;
create policy souhaits_voir on public.souhaits for all to authenticated
  using (public.acces_dossier_autorise(id))
  with check (public.peut_voir_souhaits() and not public.souhait_id_est_archive(id));

drop policy if exists medicaments_voir on public.souhait_medicaments;
create policy medicaments_voir on public.souhait_medicaments for all to authenticated
  using (
    public.peut_voir_souhaits()
    and (
      (souhait_id is not null and public.acces_dossier_autorise(souhait_id))
      or (souhait_id is null and demande_id is not null and public.acces_dossier_autorise(
        (select d.souhait_id from public.demandes_souhaits d where d.id = demande_id)
      ))
      or (souhait_id is null and demande_id is not null and (
        select d.souhait_id from public.demandes_souhaits d where d.id = demande_id
      ) is null)
    )
  )
  with check (public.peut_voir_souhaits());

drop policy if exists sc_voir on public.souhait_checklist;
create policy sc_voir on public.souhait_checklist for all to authenticated
  using (public.acces_dossier_autorise(souhait_id))
  with check (public.peut_voir_souhaits() and not public.souhait_id_est_archive(souhait_id));

drop policy if exists souhait_rapports_voir on public.souhait_rapports;
drop policy if exists rapports_staff_all on public.souhait_rapports;
create policy souhait_rapports_voir on public.souhait_rapports for all to authenticated
  using (public.acces_dossier_autorise(souhait_id))
  with check (public.peut_voir_souhaits() and not public.souhait_id_est_archive(souhait_id));

drop policy if exists souhait_suivi_voir on public.souhait_suivi;
create policy souhait_suivi_voir on public.souhait_suivi for all to authenticated
  using (public.acces_dossier_autorise(souhait_id))
  with check (public.peut_voir_souhaits() and not public.souhait_id_est_archive(souhait_id));

drop policy if exists souhait_personnel_voir on public.souhait_personnel;
drop policy if exists souhait_personnel_self on public.souhait_personnel;
create policy souhait_personnel_voir on public.souhait_personnel for all to authenticated
  using (public.acces_dossier_autorise(souhait_id) or (user_id = auth.uid() and not public.souhait_id_est_archive(souhait_id)))
  with check (public.peut_voir_souhaits() and not public.souhait_id_est_archive(souhait_id));
create policy souhait_personnel_self on public.souhait_personnel for select to authenticated
  using (user_id = auth.uid() and not public.souhait_id_est_archive(souhait_id));

drop policy if exists souhait_dates_voir on public.souhait_dates;
create policy souhait_dates_voir on public.souhait_dates for all to authenticated
  using (public.acces_dossier_autorise(souhait_id))
  with check (public.peut_voir_souhaits() and not public.souhait_id_est_archive(souhait_id));

drop policy if exists mission_photos_select on storage.objects;
create policy mission_photos_select on storage.objects for select to authenticated
  using (
    bucket_id = 'mission-photos'
    and public.acces_dossier_autorise(public._mission_photo_souhait(name))
  );

grant execute on function public.profil_a_role_asbl(jsonb, text) to authenticated;
grant execute on function public.nb_resp_informatique() to authenticated;
grant execute on function public.pin_archive_invalide(text) to authenticated;
grant execute on function public.peut_ouvrir_archives() to authenticated;
grant execute on function public.definir_pin_archive(text, text) to authenticated;
grant execute on function public.mon_pin_archive_defini() to authenticated;
grant execute on function public.date_bruxelles() to authenticated;
grant execute on function public.date_verrouillage_souhait(date, timestamptz) to authenticated;
grant execute on function public.souhait_est_archive(public.souhaits) to authenticated;
grant execute on function public.souhait_id_est_archive(uuid) to authenticated;
grant execute on function public.archive_session_valide(uuid) to authenticated;
grant execute on function public.acces_dossier_autorise(uuid) to authenticated;
grant execute on function public.etat_souhait_archive(uuid) to authenticated;
grant execute on function public.lister_souhaits_archives() to authenticated;
grant execute on function public.ouvrir_souhait_archive(uuid, text) to authenticated;

notify pgrst, 'reload schema';
