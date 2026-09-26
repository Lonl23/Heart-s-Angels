-- Plusieurs dates / périodes possibles pour un souhait.
-- date_souhaitee / date_fin restent la plage globale (tri, compat).
-- Le calendrier et les dispos utilisent chaque période, sans occuper les jours entre deux options.

alter table public.souhaits
  add column if not exists dates_possibles jsonb not null default '[]'::jsonb;

update public.souhaits
set dates_possibles = jsonb_build_array(
  jsonb_build_object(
    'debut', date_souhaitee,
    'fin', coalesce(date_fin, date_souhaitee)
  )
)
where date_souhaitee is not null
  and (dates_possibles is null or dates_possibles = '[]'::jsonb);

create or replace function public.periodes_d_un_souhait(p_dates jsonb, p_debut date, p_fin date)
returns table (debut date, fin date)
language sql
immutable
as $$
  with src as (
    select case when jsonb_typeof(p_dates) = 'array' then p_dates else '[]'::jsonb end as arr
  ),
  from_json as (
    select (e->>'debut')::date as d0,
           coalesce(nullif(e->>'fin', '')::date, (e->>'debut')::date) as d1
    from src, jsonb_array_elements(src.arr) e
    where coalesce(e->>'debut', '') ~ '^\d{4}-\d{2}-\d{2}$'
  )
  select distinct least(d0, d1) as debut, greatest(d0, d1) as fin
  from from_json
  where d0 is not null
  union all
  select p_debut, coalesce(p_fin, p_debut)
  from src
  where p_debut is not null
    and not exists (select 1 from from_json where d0 is not null)
$$;

create or replace function public.jours_d_un_souhait(p_dates jsonb, p_debut date, p_fin date)
returns table (j date)
language sql
immutable
as $$
  select distinct gs::date
  from public.periodes_d_un_souhait(p_dates, p_debut, p_fin) p
  cross join generate_series(p.debut, p.fin, interval '1 day') gs
$$;

grant execute on function public.periodes_d_un_souhait(jsonb, date, date) to authenticated;
grant execute on function public.jours_d_un_souhait(jsonb, date, date) to authenticated;

drop function if exists public.calendrier_missions(date, date);
create or replace function public.calendrier_missions(p_debut date, p_fin date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  restreint boolean;
  resultat jsonb := '[]'::jsonb;
  r record;
  per record;
  cov record;
  requis text[];
  couverts text[];
  besoin_nm boolean;
  lieu text;
  act text;
begin
  if p_debut is null or p_fin is null then return '[]'::jsonb; end if;
  restreint := public.calendrier_non_med_restreint();

  for r in
    select s.id, s.date_souhaitee, s.date_fin, s.dates_possibles, s.courte_duree, s.heure_depart, s.heure_retour,
           s.localisation, s.description, s.statut, s.mission
    from public.souhaits s
    where s.statut::text <> 'non_realise'
      and exists (
        select 1
        from public.periodes_d_un_souhait(s.dates_possibles, s.date_souhaitee, s.date_fin) p
        where p.fin >= p_debut and p.debut <= p_fin
      )
  loop
    select * into cov from public.couverture_d_un_souhait(
      r.id,
      (select min(p.debut) from public.periodes_d_un_souhait(r.dates_possibles, r.date_souhaitee, r.date_fin) p),
      (select max(p.fin) from public.periodes_d_un_souhait(r.dates_possibles, r.date_souhaitee, r.date_fin) p),
      r.mission
    );
    requis := coalesce(cov.p_requis, public.roles_requis_d_un_souhait(r.mission));
    couverts := coalesce(cov.p_couverts, '{}'::text[]);
    besoin_nm := ('volontaire_non_medical' = any (requis))
              or ('secouriste' = any (requis))
              or coalesce((r.mission->>'besoin_non_medical') in ('true','t','1'), false);
    if restreint and not besoin_nm then
      continue;
    end if;

    lieu := nullif(btrim(coalesce(r.localisation, '')), '');
    act := left(btrim(coalesce(r.description, '')), 80);

    for per in
      select p.debut, p.fin
      from public.periodes_d_un_souhait(r.dates_possibles, r.date_souhaitee, r.date_fin) p
      where p.fin >= p_debut and p.debut <= p_fin
    loop
      resultat := resultat || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
        'souhait_id', r.id,
        'date_debut', per.debut,
        'date_fin', per.fin,
        'courte_duree', coalesce(r.courte_duree, false),
        'heure_debut', r.heure_depart,
        'heure_fin', r.heure_retour,
        'rdv_base', r.mission->>'rdv_base',
        'lieu', lieu,
        'activite', nullif(act, ''),
        'besoin_non_medical', besoin_nm,
        'roles_requis', to_jsonb(requis),
        'roles_couverts', to_jsonb(coalesce(couverts, '{}'::text[])),
        'statut', r.statut::text
      )));
    end loop;
  end loop;

  return resultat;
end $$;

grant execute on function public.calendrier_missions(date, date) to authenticated;

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
  dates jsonb;
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
    n_dispo := 0;
    if njours > 0 then
      select count(*) into n_dispo
      from public.jours_d_un_souhait(dates, d0, d1) j
      where exists (
        select 1 from public.disponibilites dis
        where dis.user_id = rec.id
          and dis.date_debut <= j.j
          and dis.date_fin >= j.j
      );
    end if;

    a_conflit := false;
    if njours > 0 then
      select exists (
        select 1
        from public.souhait_personnel sp
        join public.souhaits s on s.id = sp.souhait_id
        join public.jours_d_un_souhait(s.dates_possibles, s.date_souhaitee, s.date_fin) j2 on true
        join public.jours_d_un_souhait(dates, d0, d1) j1 on j1.j = j2.j
        where sp.user_id = rec.id
          and s.id <> p_souhait
          and s.statut::text <> 'non_realise'
      ) into a_conflit;
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
      coalesce(a_conflit, false);
  end loop;
end $$;

grant execute on function public.personnel_disponible_souhait(uuid) to authenticated;

drop function if exists public.mes_affectations();
create or replace function public.mes_affectations()
returns table(
  souhait_id uuid,
  beneficiaire_prenom text,
  date_souhaitee date,
  date_fin date,
  dates_possibles jsonb,
  statut text,
  vehicule text,
  role_mission text,
  description text,
  lieu text,
  statut_base text,
  etape_vehicule text,
  tel_a_appeler text,
  tel_a_appeler_libelle text,
  origine text
)
language sql stable security definer set search_path = public as $$
  select
    s.id,
    s.beneficiaire_prenom,
    s.date_souhaitee,
    s.date_fin,
    coalesce(s.dates_possibles, '[]'::jsonb),
    s.statut::text,
    coalesce(
      nullif(sp.vehicule, ''),
      (
        select e->>'nom'
        from jsonb_array_elements(coalesce(s.mission->'vecteurs', '[]'::jsonb)) e
        where e->>'id' = sp.vecteur_id
        limit 1
      )
    ),
    sp.role_mission,
    s.description,
    coalesce(
      s.mission->'dest_adresse'->>'localite',
      s.mission->'pec_adresse'->>'localite',
      s.localisation
    ),
    coalesce(sp.statut_base, s.mission->'personnel_statuts'->>sp.user_id::text),
    coalesce(
      case when nullif(sp.vecteur_id, '') is not null
           then s.mission->'vecteur_etapes'->>sp.vecteur_id end,
      s.mission->>'etape_terrain'
    ),
    public.coordonnees_appel(s.id)->>'tel',
    public.coordonnees_appel(s.id)->>'libelle',
    coalesce(s.origine, 'prive')
  from public.souhait_personnel sp
  join public.souhaits s on s.id = sp.souhait_id
  where sp.user_id = auth.uid()
  order by
    case s.statut::text
      when 'en_cours' then 0
      when 'pret' then 1
      when 'en_attente' then 2
      when 'nouveau' then 3
      else 4
    end,
    s.date_souhaitee nulls last
$$;

grant execute on function public.mes_affectations() to authenticated;

create or replace function public.ma_mission(p_souhait uuid)
returns json language plpgsql stable security definer set search_path = public as $$
declare
  s public.souhaits;
  sp public.souhait_personnel;
  m jsonb;
  v jsonb;
  vid text;
  pec_adr jsonb;
  dispos jsonb;
  n int;
  crew jsonb;
  etape text;
  vstat text;
  appel json;
begin
  select * into sp from public.souhait_personnel
    where souhait_id = p_souhait and user_id = auth.uid() limit 1;
  if not found then return json_build_object('ok', false); end if;
  select * into s from public.souhaits where id = p_souhait;
  m := coalesce(s.mission, '{}'::jsonb);
  vid := nullif(sp.vecteur_id, '');
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', e->>'id', 'nom', e->>'nom', 'plaque', e->>'plaque', 'type_transport', e->>'type_transport'
    )), '[]'::jsonb)
    into dispos
    from jsonb_array_elements(coalesce(m->'vecteurs','[]'::jsonb)) e;
  n := jsonb_array_length(coalesce(dispos, '[]'::jsonb));

  if vid is not null then
    select e into v from jsonb_array_elements(coalesce(m->'vecteurs','[]'::jsonb)) e
      where e->>'id' = vid limit 1;
  elsif n = 1 then
    select e into v from jsonb_array_elements(coalesce(m->'vecteurs','[]'::jsonb)) e limit 1;
    vid := v->>'id';
  end if;

  if (m->>'pec_type') = 'Domicile du patient' then pec_adr := m->'patient_adresse';
  else pec_adr := m->'pec_adresse';
  end if;

  etape := coalesce(
    case when vid is not null then m->'vecteur_etapes'->>vid end,
    m->>'etape_terrain'
  );
  vstat := case when vid is not null then m->'vecteur_statuts'->>vid end;

  select coalesce(jsonb_agg(jsonb_build_object(
      'user_id', x.user_id,
      'prenom', x.prenom,
      'role_mission', x.role_mission,
      'statut_base', x.statut_base,
      'medical', x.medical
    ) order by x.prenom), '[]'::jsonb)
    into crew
    from (
      select
        sp2.user_id,
        p.prenom,
        sp2.role_mission,
        coalesce(sp2.statut_base, m->'personnel_statuts'->>sp2.user_id::text) as statut_base,
        public.profil_est_medical(p.role::text, coalesce(p.fiche, '{}'::jsonb), sp2.role_mission) as medical
      from public.souhait_personnel sp2
      join public.profiles p on p.id = sp2.user_id
      where sp2.souhait_id = p_souhait
        and vid is not null
        and sp2.vecteur_id is not distinct from vid
    ) x;

  appel := public.coordonnees_appel(p_souhait);

  return json_build_object(
    'ok', true,
    'statut', s.statut::text,
    'beneficiaire_prenom', s.beneficiaire_prenom,
    'description', s.description,
    'date_souhaitee', s.date_souhaitee,
    'date_fin', s.date_fin,
    'dates_possibles', coalesce(s.dates_possibles, '[]'::jsonb),
    'role_mission', sp.role_mission,
    'statut_base', coalesce(sp.statut_base, m->'personnel_statuts'->>sp.user_id::text),
    'vecteur_id', vid,
    'vecteur', v,
    'vecteurs_dispo', case when v is null then dispos else '[]'::jsonb end,
    'etape_terrain', etape,
    'vecteur_statut', vstat,
    'nb_vecteurs', n,
    'nb_vecteurs_equipes', (
      select count(distinct spx.vecteur_id)
      from public.souhait_personnel spx
      where spx.souhait_id = p_souhait and nullif(spx.vecteur_id, '') is not null
    ),
    'equipage_medical', public.vecteur_a_medical(p_souhait, vid),
    'equipage', crew,
    'photos', coalesce(m->'terrain_photos'->vid, '{}'::jsonb),
    'checklist_extras', coalesce(m->'checklist_extras', '{}'::jsonb),
    'origine', coalesce(s.origine, 'prive'),
    'tel_a_appeler', appel->>'tel',
    'tel_a_appeler_libelle', appel->>'libelle',
    'base', json_build_object(
      'nom', m->>'base_nom', 'adresse', m->'base_adresse',
      'rdv', m->>'rdv_base', 'depart', m->>'depart_base'
    ),
    'pec', json_build_object(
      'type', m->>'pec_type', 'institution', m->>'pec_institution', 'adresse', pec_adr,
      'service', m->>'pec_service', 'etage', m->>'pec_etage', 'aile', m->>'pec_aile',
      'chambre', m->>'pec_chambre', 'heure', m->>'arrivee_pec', 'depart', m->>'depart_pec',
      'precisions', m->>'pec_precisions'
    ),
    'destination', json_build_object(
      'adresse', m->'dest_adresse', 'precisions', m->>'dest_precisions', 'heure', m->>'arrivee_destination'
    ),
    'retour', json_build_object(
      'type', m->>'retour_type', 'heure', m->>'retour_heure', 'precisions', m->>'retour_precisions'
    ),
    'consignes_equipage', m->>'consignes_equipage',
    'rapport_observations', m->>'rapport_observations',
    'check_base', coalesce(
      case when vid is not null then m->'vecteur_checklists'->vid->'base' end,
      '{}'::jsonb
    ),
    'check_retour_base', coalesce(
      case when vid is not null then m->'vecteur_checklists'->vid->'retour_base' end,
      '{}'::jsonb
    ),
    'check_pec', coalesce(
      case when vid is not null then m->'vecteur_checklists'->vid->'pec' end,
      m->'checklists'->'pec',
      '{}'::jsonb
    ),
    'check_retour_pec', coalesce(
      case when vid is not null then m->'vecteur_checklists'->vid->'retour_pec' end,
      m->'checklists'->'retour_pec',
      '{}'::jsonb
    )
  );
end $$;

grant execute on function public.ma_mission(uuid) to authenticated;

notify pgrst, 'reload schema';
