-- ════════════════════════════════════════════════════════════════════════════
--  Pont affectation ↔ disponibilités : qui est libre aux dates du souhait.
--  Réservé à qui peut préparer un dossier (peut_voir_souhaits).
--  RETURNS TABLE (pas jsonb) : supabase-js attend un jeu de lignes.
--  Idempotent. Après 14_quals_implicites.sql.
-- ════════════════════════════════════════════════════════════════════════════

drop function if exists public.personnel_disponible_souhait(uuid);

create or replace function public.personnel_disponible_souhait(p_souhait uuid)
returns table (
  user_id uuid,
  prenom text,
  nom text,
  role text,
  quals jsonb,
  dispo text,
  conflit boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  d0 date;
  d1 date;
  njours int;
  rec record;
  n_dispo int;
  a_conflit boolean;
begin
  if p_souhait is null then return; end if;
  if not (public.peut_voir_souhaits() or public.peut_voir_toutes_dispos()) then
    return;
  end if;

  select s.date_souhaitee, coalesce(s.date_fin, s.date_souhaitee)
    into d0, d1
  from public.souhaits s where s.id = p_souhait;

  njours := case when d0 is null then 0 else (d1 - d0) + 1 end;

  for rec in
    select p.id, p.prenom, p.nom, p.role::text as role, coalesce(p.fiche, '{}'::jsonb) as fiche
    from public.profiles p
    where coalesce(p.actif, true) and p.role::text <> 'partenaire'
    order by p.nom, p.prenom
  loop
    n_dispo := 0;
    if d0 is not null then
      select count(distinct (d::date)) into n_dispo
      from public.disponibilites dis
      cross join generate_series(
        greatest(dis.date_debut, d0),
        least(dis.date_fin, d1),
        interval '1 day'
      ) d
      where dis.user_id = rec.id
        and dis.date_debut <= d1
        and dis.date_fin >= d0;
    end if;

    a_conflit := false;
    if d0 is not null then
      select exists (
        select 1
        from public.souhait_personnel sp
        join public.souhaits s on s.id = sp.souhait_id
        where sp.user_id = rec.id
          and s.id <> p_souhait
          and s.statut::text <> 'non_realise'
          and s.date_souhaitee is not null
          and coalesce(s.date_fin, s.date_souhaitee) >= d0
          and s.date_souhaitee <= d1
      ) into a_conflit;
    end if;

    return query select
      rec.id,
      rec.prenom,
      rec.nom,
      rec.role,
      to_jsonb(public.quals_d_un_profil(rec.role, rec.fiche)),
      case
        when d0 is null then 'inconnu'
        when n_dispo >= njours then 'plein'
        when n_dispo > 0 then 'partiel'
        else 'non'
      end,
      coalesce(a_conflit, false);
  end loop;
end $$;

grant execute on function public.personnel_disponible_souhait(uuid) to authenticated;

notify pgrst, 'reload schema';
