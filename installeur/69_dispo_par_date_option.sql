-- ════════════════════════════════════════════════════════════════════════════
--  Dates possibles = options (l’une ou l’autre). Le RPC renvoie les jours
--  réellement couverts et les jours en conflit, pour affecter par date.
--  Idempotent. Après 68_dispo_sejour_complet.sql.
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
  conflit boolean,
  jours_dispo date[],
  jours_conflit date[]
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  dates jsonb;
  d0 date;
  d1 date;
  njours int;
  rec record;
  n_dispo int;
  a_conflit boolean;
  jours_ok date[];
  jours_ko date[];
begin
  if p_souhait is null then return; end if;
  if not (public.peut_voir_souhaits() or public.peut_voir_toutes_dispos()) then
    return;
  end if;

  select s.dates_possibles, s.date_souhaitee, coalesce(s.date_fin, s.date_souhaitee)
    into dates, d0, d1
  from public.souhaits s where s.id = p_souhait;

  select count(*) into njours from public.jours_d_un_souhait(dates, d0, d1);

  for rec in
    select p.id, p.prenom, p.nom, p.role::text as role, coalesce(p.fiche, '{}'::jsonb) as fiche
    from public.profiles p
    where coalesce(p.actif, true) and p.role::text <> 'partenaire'
    order by p.nom, p.prenom
  loop
    jours_ok := '{}'::date[];
    jours_ko := '{}'::date[];
    n_dispo := 0;
    a_conflit := false;

    if njours > 0 then
      select coalesce(array_agg(j.j order by j.j), '{}'::date[]) into jours_ok
      from public.jours_d_un_souhait(dates, d0, d1) j
      where exists (
        select 1 from public.disponibilites dis
        where dis.user_id = rec.id
          and dis.date_debut <= j.j
          and dis.date_fin >= j.j
      );
      n_dispo := coalesce(array_length(jours_ok, 1), 0);

      select coalesce((
        select array_agg(x.j order by x.j)
        from (
          select distinct j1.j
          from public.souhait_personnel sp
          join public.souhaits s on s.id = sp.souhait_id
          join public.jours_d_un_souhait(s.dates_possibles, s.date_souhaitee, s.date_fin) j2 on true
          join public.jours_d_un_souhait(dates, d0, d1) j1 on j1.j = j2.j
          where sp.user_id = rec.id
            and s.id <> p_souhait
            and s.statut::text <> 'non_realise'
        ) x
      ), '{}'::date[]) into jours_ko;
      a_conflit := coalesce(array_length(jours_ko, 1), 0) > 0;
    end if;

    return query select
      rec.id,
      rec.prenom,
      rec.nom,
      rec.role,
      to_jsonb(public.quals_d_un_profil(rec.role, rec.fiche)),
      case
        when njours = 0 then 'inconnu'
        when n_dispo >= njours then 'plein'
        when n_dispo > 0 then 'partiel'
        else 'non'
      end,
      coalesce(a_conflit, false),
      coalesce(jours_ok, '{}'::date[]),
      coalesce(jours_ko, '{}'::date[]);
  end loop;
end $$;

grant execute on function public.personnel_disponible_souhait(uuid) to authenticated;

notify pgrst, 'reload schema';
