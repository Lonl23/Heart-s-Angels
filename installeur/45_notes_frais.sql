-- ════════════════════════════════════════════════════════════════════════════
--  Notes de frais volontariat — système forfaitaire (sans km pour l’instant).
--  Idempotent. Après 44_rapport_horaires_partenaire.sql.
--  Une note = un volontaire × un mois. Lignes forfait en JSON.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.est_tresorier_notes()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with me as (select role::text as role, fiche from public.profiles where id = auth.uid())
  select coalesce((
    select role in ('admin', 'president', 'tresorier')
        or coalesce(fiche->'roles_asbl' ?| array[
             'president', 'vice_president',
             'tresorier', 'tresorier_adjoint',
             'resp_informatique', 'resp_informatique_adjoint',
             'administrateur_asbl'
           ], false)
    from me
  ), false)
$$;

create table if not exists public.notes_frais (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  periode_mois    int not null check (periode_mois between 1 and 12),
  periode_annee   int not null check (periode_annee between 2000 and 2100),
  iban            text not null default '',
  lignes_forfait  jsonb not null default '[]'::jsonb,
  lignes_km       jsonb not null default '[]'::jsonb,
  total_forfait   numeric(10,2) not null default 0,
  total_km        numeric(10,2) not null default 0,
  total           numeric(10,2) not null default 0,
  statut          public.statut_defraiement not null default 'en_attente',
  motif_refus     text,
  valide_par      uuid references public.profiles(id) on delete set null,
  valide_at       timestamptz,
  paye_at         timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, periode_mois, periode_annee)
);

comment on table public.notes_frais is
  'Note de frais mensuelle (forfait journalier). Les km personnels ne sont pas remboursés pour le moment.';
comment on column public.notes_frais.lignes_km is
  'Réservé. Toujours vide : les kilomètres ne sont pas pris en compte.';

create index if not exists notes_frais_user_annee_idx
  on public.notes_frais (user_id, periode_annee);
create index if not exists notes_frais_statut_idx
  on public.notes_frais (statut);

drop trigger if exists trg_notes_frais_updated on public.notes_frais;
create trigger trg_notes_frais_updated before update on public.notes_frais
  for each row execute function public.set_updated_at();

-- Missions du mois pour préremplir les lignes forfait (1 jour = 1 forfait).
create or replace function public.missions_pour_note_frais(p_user uuid, p_mois int, p_annee int)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  res jsonb := '[]'::jsonb;
  r record;
  d date;
  lieu text;
  debut_m date;
  fin_m date;
begin
  if p_user is null or p_mois is null or p_annee is null then
    return '[]'::jsonb;
  end if;
  if not (p_user = auth.uid() or public.est_tresorier_notes()) then
    return '[]'::jsonb;
  end if;
  if p_mois < 1 or p_mois > 12 then return '[]'::jsonb; end if;

  debut_m := make_date(p_annee, p_mois, 1);
  fin_m := (debut_m + interval '1 month' - interval '1 day')::date;

  for r in
    select s.id, s.date_souhaitee, s.date_fin, s.date_realisee, s.dates_possibles,
           s.localisation, s.description, s.mission, s.statut
    from public.souhait_personnel sp
    join public.souhaits s on s.id = sp.souhait_id
    where sp.user_id = p_user
      and s.statut::text not in ('non_realise')
    order by coalesce(s.date_realisee, s.date_souhaitee)
  loop
    d := null;
    if r.date_realisee is not null and r.date_realisee between debut_m and fin_m then
      d := r.date_realisee;
    elsif r.date_souhaitee is not null and r.date_souhaitee between debut_m and fin_m then
      d := r.date_souhaitee;
    else
      select greatest(p.debut, debut_m) into d
      from public.periodes_d_un_souhait(r.dates_possibles, r.date_souhaitee, r.date_fin) p
      where p.debut <= fin_m and p.fin >= debut_m
      order by p.debut
      limit 1;
      if d is not null and (d < debut_m or d > fin_m) then
        d := null;
      end if;
    end if;
    if d is null then continue; end if;

    lieu := nullif(btrim(coalesce(r.localisation, '')), '');
    if lieu is null then
      lieu := nullif(btrim(split_part(coalesce(r.mission->>'dest_precisions', ''), E'\n', 1)), '');
    end if;
    if lieu is null then
      lieu := nullif(btrim(coalesce(r.mission->'dest_adresse'->>'localite', '')), '');
    end if;
    if lieu is null then
      lieu := nullif(left(btrim(coalesce(r.description, '')), 80), '');
    end if;

    res := res || jsonb_build_array(jsonb_build_object(
      'date', to_char(d, 'YYYY-MM-DD'),
      'activite', 'Souhait',
      'lieu', coalesce(lieu, ''),
      'souhait_id', r.id,
      'montant', 44.02
    ));
  end loop;

  return res;
end $$;

alter table public.notes_frais enable row level security;

drop policy if exists notes_frais_select on public.notes_frais;
create policy notes_frais_select on public.notes_frais
  for select to authenticated
  using (user_id = auth.uid() or public.est_tresorier_notes());

drop policy if exists notes_frais_insert on public.notes_frais;
create policy notes_frais_insert on public.notes_frais
  for insert to authenticated
  with check (
    public.is_staff()
    and (user_id = auth.uid() or public.est_tresorier_notes())
    and statut = 'en_attente'
  );

drop policy if exists notes_frais_update on public.notes_frais;
create policy notes_frais_update on public.notes_frais
  for update to authenticated
  using (
    (user_id = auth.uid() and statut = 'en_attente')
    or public.est_tresorier_notes()
  )
  with check (
    (user_id = auth.uid() and statut = 'en_attente' and not public.est_tresorier_notes())
    or public.est_tresorier_notes()
  );

drop policy if exists notes_frais_delete on public.notes_frais;
create policy notes_frais_delete on public.notes_frais
  for delete to authenticated
  using (
    (user_id = auth.uid() and statut = 'en_attente')
    or public.est_tresorier_notes()
  );

grant select, insert, update, delete on public.notes_frais to authenticated, service_role;
grant execute on function public.est_tresorier_notes() to authenticated;
grant execute on function public.missions_pour_note_frais(uuid, int, int) to authenticated;

notify pgrst, 'reload schema';
