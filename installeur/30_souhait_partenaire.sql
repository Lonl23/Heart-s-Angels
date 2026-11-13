-- ════════════════════════════════════════════════════════════════════════════
--  Souhaits ↔ institutions / partenaires externes.
--  Origine privé vs institution, n° d’appel mission, pont annuaire.
--  Idempotent. Après 29_stock_lots.sql.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.partenaires
  add column if not exists annuaire_id    uuid references public.annuaire(id) on delete set null,
  add column if not exists email_general  text,
  add column if not exists tel_general    text;

create unique index if not exists partenaires_annuaire_uidx
  on public.partenaires (annuaire_id)
  where annuaire_id is not null;

alter table public.annuaire
  add column if not exists partenaire_id uuid references public.partenaires(id) on delete set null;

alter table public.souhaits
  add column if not exists origine              text,
  add column if not exists partenaire_id        uuid references public.partenaires(id) on delete set null,
  add column if not exists annuaire_externe_id  uuid references public.annuaire(id) on delete set null,
  add column if not exists contact_annuaire_id  uuid references public.annuaire(id) on delete set null;

update public.souhaits set origine = 'prive' where origine is null;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'souhaits_origine_chk') then
    alter table public.souhaits
      add constraint souhaits_origine_chk
      check (origine is null or origine in ('prive', 'institution'));
  end if;
end $$;

create index if not exists souhaits_partenaire_idx on public.souhaits (partenaire_id);
create index if not exists souhaits_externe_idx on public.souhaits (annuaire_externe_id);

-- Staff peut générer une invitation d’espace institution (e-mail général + code).
drop policy if exists invitations_staff_partenaire on public.invitations;
create policy invitations_staff_partenaire on public.invitations for all to authenticated
  using (public.is_staff() and partenaire_id is not null)
  with check (public.is_staff() and partenaire_id is not null);

-- Numéro à appeler : institution (n° général) ou privé (contact, sinon bénéficiaire).
create or replace function public.coordonnees_appel(p_souhait uuid)
returns json language plpgsql stable security definer set search_path = public as $$
declare
  s public.souhaits;
  inst_tel text;
  inst_nom text;
  c_tel text;
  c_nom text;
  tel text;
  lib text;
  src text;
begin
  if not (public.is_staff() or public.suis_affecte(p_souhait)) then
    return json_build_object('ok', false);
  end if;
  select * into s from public.souhaits where id = p_souhait;
  if not found then return json_build_object('ok', false); end if;

  select
    coalesce(nullif(p.tel_general, ''), nullif(p.contact_tel, '')),
    p.nom
  into inst_tel, inst_nom
  from public.partenaires p
  where p.id = s.partenaire_id;

  if inst_tel is null or inst_nom is null then
    select
      coalesce(nullif(a.telephone, ''), nullif(a.tel_fixe, ''), nullif(a.tel_gsm, ''), nullif(a.data->>'telephone', '')),
      a.nom
    into inst_tel, inst_nom
    from public.annuaire a
    where a.id = s.annuaire_externe_id;
  end if;

  select
    coalesce(nullif(c.tel_gsm, ''), nullif(c.tel_fixe, ''), nullif(c.telephone, ''),
             nullif(c.data->>'tel_gsm', ''), nullif(c.data->>'telephone', '')),
    trim(both from concat_ws(' ', c.prenom, c.nom))
  into c_tel, c_nom
  from public.annuaire c
  where c.id = s.contact_annuaire_id;

  if coalesce(s.origine, 'prive') = 'institution' then
    tel := inst_tel;
    lib := 'Institution' || case when coalesce(inst_nom, '') <> '' then ' · ' || inst_nom else '' end;
    src := 'institution';
  else
    tel := coalesce(c_tel, nullif(s.beneficiaire_tel_gsm, ''), nullif(s.beneficiaire_tel_fixe, ''));
    if c_tel is not null then
      lib := 'Contact' || case when coalesce(c_nom, '') <> '' then ' · ' || c_nom else '' end;
      src := 'contact';
    else
      lib := 'Bénéficiaire';
      src := 'beneficiaire';
    end if;
  end if;

  return json_build_object('ok', true, 'tel', tel, 'libelle', lib, 'source', src);
end $$;

grant execute on function public.coordonnees_appel(uuid) to authenticated;

drop function if exists public.mes_affectations();
create or replace function public.mes_affectations()
returns table(
  souhait_id uuid,
  beneficiaire_prenom text,
  date_souhaitee date,
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

-- Relier le souhait d’Ostende (5 sept. 2026) au contact externe « La Charmille ».
update public.annuaire
set telephone = '+32 81.62.72.38',
    data = coalesce(data, '{}'::jsonb) || jsonb_build_object('telephone', '+32 81.62.72.38')
where categorie = 'externe_souhait'
  and nom ilike 'La Charmille'
  and (telephone is null or telephone ~ '816');

insert into public.partenaires (nom, type, ville, contact_nom, contact_tel, tel_general, email_general, annuaire_id, notes)
select
  a.nom,
  'maison_repos',
  nullif(a.data->'adresse'->>'localite', ''),
  nullif(a.data->>'contact_personne', ''),
  a.telephone,
  a.telephone,
  nullif(a.data->>'email', ''),
  a.id,
  'Créé depuis l’annuaire (contact externe).'
from public.annuaire a
where a.categorie = 'externe_souhait'
  and a.nom ilike 'La Charmille'
  and not exists (
    select 1 from public.partenaires p
    where p.annuaire_id = a.id or lower(p.nom) = lower(a.nom)
  );

update public.annuaire a
set partenaire_id = p.id
from public.partenaires p
where a.categorie = 'externe_souhait'
  and a.nom ilike 'La Charmille'
  and (p.annuaire_id = a.id or lower(p.nom) = lower(a.nom))
  and a.partenaire_id is distinct from p.id;

update public.souhaits s
set
  origine = 'institution',
  annuaire_externe_id = a.id,
  partenaire_id = coalesce(a.partenaire_id, p.id)
from public.annuaire a
left join public.partenaires p on p.annuaire_id = a.id or lower(p.nom) = lower(a.nom)
where a.categorie = 'externe_souhait'
  and a.nom ilike 'La Charmille'
  and s.date_souhaitee = '2026-09-05'
  and (s.localisation ilike '%oost%' or s.description ilike '%oost%');

notify pgrst, 'reload schema';
