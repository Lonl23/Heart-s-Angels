-- ════════════════════════════════════════════════════════════════════════════
--  Verrou immédiat des souhaits non réalisés. Un dossier verrouillé n’est plus
--  préparable. La liste n’expose que prénom, date, lieu et activité.
--  Idempotent. Après 59_demande_info_externe_missions.sql.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.souhait_est_archive(s public.souhaits)
returns boolean
language sql stable as $$
  select
    s.statut::text = 'non_realise'
    or (
      s.statut::text = 'realise'
      and public.date_verrouillage_souhait(s.date_realisee, s.updated_at) <= public.date_bruxelles()
    )
$$;

-- Passage en non réalisé : l’ancienne politique FOR ALL refusait le WITH CHECK
-- dès que la ligne devenait verrouillée. SELECT reste ouvert via PIN ;
-- UPDATE / DELETE ne portent que sur un dossier encore ouvert.
drop policy if exists souhaits_voir on public.souhaits;
drop policy if exists souhaits_select on public.souhaits;
drop policy if exists souhaits_insert on public.souhaits;
drop policy if exists souhaits_update on public.souhaits;
drop policy if exists souhaits_delete on public.souhaits;

create policy souhaits_select on public.souhaits for select to authenticated
  using (public.acces_dossier_autorise(id));

create policy souhaits_insert on public.souhaits for insert to authenticated
  with check (public.peut_voir_souhaits());

create policy souhaits_update on public.souhaits for update to authenticated
  using (public.peut_voir_souhaits() and not public.souhait_id_est_archive(id))
  with check (public.peut_voir_souhaits());

create policy souhaits_delete on public.souhaits for delete to authenticated
  using (public.peut_voir_souhaits() and not public.souhait_id_est_archive(id));

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
    'verrouille_au', public.date_verrouillage_souhait(s.date_realisee, s.updated_at),
    'statut', s.statut::text,
    'beneficiaire', nullif(btrim(coalesce(s.beneficiaire_prenom, '')), ''),
    'beneficiaire_prenom', s.beneficiaire_prenom,
    'description', s.description,
    'localisation', s.localisation,
    'date_souhaitee', s.date_souhaitee
  );
end $$;

drop function if exists public.lister_souhaits_verrouilles();
create function public.lister_souhaits_verrouilles()
returns table (
  id uuid,
  beneficiaire_prenom text,
  description text,
  localisation text,
  date_souhaitee date,
  statut text,
  verrouille boolean
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    s.id,
    s.beneficiaire_prenom,
    s.description,
    s.localisation,
    s.date_souhaitee,
    s.statut::text,
    true
  from public.souhaits s
  where public.peut_voir_souhaits()
    and public.souhait_est_archive(s)
  order by
    case s.statut::text when 'non_realise' then 1 else 0 end,
    s.date_realisee desc nulls last,
    s.updated_at desc
$$;

drop function if exists public.lister_souhaits_archives();
create function public.lister_souhaits_archives()
returns table(
  id uuid,
  beneficiaire_prenom text,
  date_souhaitee date,
  localisation text,
  description text,
  date_realisee date,
  verrouille_au date,
  statut text,
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
    s.date_souhaitee,
    s.localisation,
    s.description,
    s.date_realisee,
    public.date_verrouillage_souhait(s.date_realisee, s.updated_at),
    s.statut::text,
    coalesce(s.fictif, false)
  from public.souhaits s
  where public.peut_ouvrir_archives()
    and public.souhait_est_archive(s)
  order by s.date_realisee desc nulls last, s.updated_at desc
$$;

grant execute on function public.souhait_est_archive(public.souhaits) to authenticated;
grant execute on function public.etat_souhait_archive(uuid) to authenticated;
grant execute on function public.lister_souhaits_verrouilles() to authenticated;
grant execute on function public.lister_souhaits_archives() to authenticated;

notify pgrst, 'reload schema';
