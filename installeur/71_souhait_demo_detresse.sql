-- ════════════════════════════════════════════════════════════════════════════
--  Souhait de formation fictif : dossier complet + protocole de détresse.
--  Départ base 9h30 (prochain jeudi à l’installation, puis le jour du recyclage).
--  Une fois clôturé (statut réalisé), le lendemain il revient en Nouveau
--  pour que chacun puisse reprendre l’application en main.
--  Idempotent. Après 70_creer_volontaire_sans_compte.sql.
-- ════════════════════════════════════════════════════════════════════════════

create extension if not exists pg_cron;

create index if not exists souhaits_demo_cle_idx
  on public.souhaits ((mission->>'demo_cle'))
  where coalesce(mission->>'demo_cle', '') <> '';

-- Ne pas spammer l’agenda ni la logistique pour un dossier de démonstration.
create or replace function public.trg_souhait_agenda_notif()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  lieu text;
begin
  if coalesce(new.fictif, false) then return new; end if;
  if coalesce(new.mission->>'demo_cle', '') <> '' then return new; end if;
  if tg_op = 'UPDATE' and public.souhait_a_des_dates(old) then
    return new;
  end if;
  if not public.souhait_a_des_dates(new) then
    return new;
  end if;
  if coalesce(new.statut::text, '') in ('annule', 'non_realise') then
    return new;
  end if;
  lieu := coalesce(nullif(new.localisation, ''), new.mission->>'lieu', new.mission->>'activite', 'Souhait');
  perform public.notifier_evenement(
    'souhait_agenda',
    'Nouveau souhait à l’agenda',
    public.fmt_dates_souhait(new) || ' · ' || lieu,
    '/app/disponibilites',
    'normale',
    null,
    new.id,
    jsonb_build_object('souhait_id', new.id)
  );
  return new;
end
$$;

create or replace function public.trg_souhait_conso_notif()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.fictif, false) then return new; end if;
  if coalesce(new.mission->>'demo_cle', '') <> '' then return new; end if;
  if new.statut = 'realise' and old.statut is distinct from 'realise' then
    perform public.notifier_conso_souhait(new.id);
  end if;
  return new;
end
$$;

create or replace function public.trg_assignation_notif()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.souhaits;
  lieu text;
begin
  select * into s from public.souhaits where id = new.souhait_id;
  if not found then return new; end if;
  if coalesce(s.fictif, false) then return new; end if;
  if coalesce(s.mission->>'demo_cle', '') <> '' then return new; end if;
  lieu := coalesce(nullif(s.localisation, ''), s.mission->>'lieu', s.mission->>'activite', 'Mission');
  perform public.notifier_evenement(
    'assignation_souhait',
    'Affectation à un souhait',
    public.fmt_dates_souhait(s) || ' · ' || lieu,
    '/app/missions/' || new.souhait_id::text,
    'haute',
    array[new.user_id],
    new.id,
    jsonb_build_object('souhait_id', new.souhait_id)
  );
  return new;
end
$$;

-- ── Horaires type : RDV 9h, départ base 9h30 ────────────────────────────────

create or replace function public.horaires_mission_demo(p_jour date)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'rdv_base',              to_char(p_jour, 'YYYY-MM-DD') || 'T09:00',
    'depart_base',           to_char(p_jour, 'YYYY-MM-DD') || 'T09:30',
    'arrivee_pec',           to_char(p_jour, 'YYYY-MM-DD') || 'T10:00',
    'depart_pec',            to_char(p_jour, 'YYYY-MM-DD') || 'T10:30',
    'arrivee_destination',   to_char(p_jour, 'YYYY-MM-DD') || 'T11:15',
    'retour_heure',          to_char(p_jour, 'YYYY-MM-DD') || 'T16:00'
  )
$$;

create or replace function public.prochain_jeudi(p_jour date default public.date_bruxelles())
returns date
language sql
stable
as $$
  select (p_jour + ((4 - extract(isodow from p_jour)::int + 7) % 7))::date
$$;

create or replace function public.nettoyer_execution_mission_demo(p_mission jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  m jsonb := coalesce(p_mission, '{}'::jsonb);
  v jsonb;
  acc jsonb := '[]'::jsonb;
begin
  m := m - array[
    'etape_terrain', 'vecteur_etapes', 'vecteur_etape_heures', 'vecteur_statuts',
    'vecteur_clotures', 'personnel_statuts', 'personnel_heures',
    'injections_detresse', 'checklists', 'vecteur_checklists',
    'cloture_le', 'demarre_le', 'terrain_photos', 'rapport_medical',
    'motif_non_realise', 'attente'
  ];
  for v in select * from jsonb_array_elements(coalesce(m->'vecteurs', '[]'::jsonb))
  loop
    acc := acc || jsonb_build_array(
      v - 'kms_depart' - 'kms_retour' - 'essence_pct' - 'km_depart' - 'km_retour'
    );
  end loop;
  m := jsonb_set(m, '{vecteurs}', acc, true);
  return m;
end
$$;

create or replace function public.appliquer_jour_mission_demo(p_mission jsonb, p_jour date)
returns jsonb
language sql
immutable
as $$
  select public.nettoyer_execution_mission_demo(p_mission) || public.horaires_mission_demo(p_jour)
$$;

-- ── Recyclage d’un dossier de formation clôturé ─────────────────────────────

create or replace function public.recycler_un_souhait_demo(p_id uuid, p_jour date default public.date_bruxelles())
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.souhaits;
  m jsonb;
begin
  select * into s from public.souhaits where id = p_id for update;
  if not found then return false; end if;
  if coalesce(s.mission->>'demo_cle', '') = '' then return false; end if;
  if not coalesce(s.fictif, false) then return false; end if;

  m := public.appliquer_jour_mission_demo(s.mission, p_jour);
  m := jsonb_set(m, '{date_demande}', to_jsonb(to_char(p_jour, 'YYYY-MM-DD')), true);

  update public.souhaits
     set statut          = 'nouveau',
         date_souhaitee  = p_jour,
         date_fin        = p_jour,
         dates_possibles = '[]'::jsonb,
         date_realisee   = null,
         heure_depart    = time '09:30',
         heure_retour    = time '16:30',
         courte_duree    = true,
         mission         = m,
         updated_at      = now()
   where id = p_id;

  delete from public.souhait_personnel where souhait_id = p_id;

  update public.souhait_medicaments
     set donne = false,
         prises = '[]'::jsonb
   where souhait_id = p_id;

  update public.souhait_checklist
     set coche = false,
         coche_par = null,
         coche_le = null
   where souhait_id = p_id;

  return true;
end
$$;

revoke all on function public.recycler_un_souhait_demo(uuid, date) from public, anon, authenticated;
grant execute on function public.recycler_un_souhait_demo(uuid, date) to service_role;

create or replace function public.recycler_souhaits_demo()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  auj date := public.date_bruxelles();
  r record;
  n_clotures int := 0;
  n_dates int := 0;
  jour_cloture date;
begin
  for r in
    select s.id, s.statut, s.date_realisee, s.date_souhaitee, s.updated_at, s.mission
      from public.souhaits s
     where coalesce(s.fictif, false)
       and coalesce(s.mission->>'demo_cle', '') <> ''
  loop
    if r.statut::text = 'realise' then
      jour_cloture := coalesce(
        r.date_realisee,
        ((nullif(r.mission->>'cloture_le', ''))::timestamptz at time zone 'Europe/Brussels')::date,
        (r.updated_at at time zone 'Europe/Brussels')::date
      );
      if jour_cloture is not null and jour_cloture < auj then
        if public.recycler_un_souhait_demo(r.id, auj) then
          n_clotures := n_clotures + 1;
        end if;
      end if;
    elsif r.statut::text in ('nouveau', 'en_attente', 'pret')
      and r.date_souhaitee is not null
      and r.date_souhaitee < auj
    then
      -- Dossier encore ouvert mais daté d’hier : on le replace aujourd’hui 9h30.
      update public.souhaits
         set date_souhaitee  = auj,
             date_fin        = auj,
             dates_possibles = '[]'::jsonb,
             heure_depart    = time '09:30',
             heure_retour    = time '16:30',
             mission         = public.appliquer_jour_mission_demo(mission, auj)
       where id = r.id;
      n_dates := n_dates + 1;
    end if;
  end loop;
  return json_build_object('ok', true, 'recycles', n_clotures, 'dates_avancees', n_dates, 'jour', auj);
end
$$;

revoke all on function public.recycler_souhaits_demo() from public, anon, authenticated;
grant execute on function public.recycler_souhaits_demo() to service_role;

-- ── Seed : institutions, bénéficiaire, souhait complet ──────────────────────

create or replace function public.assurer_souhait_demo_detresse()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cle text := 'formation_detresse';
  v_jour date := public.prochain_jeudi();
  v_by uuid;
  v_recolteur uuid;
  v_partenaire uuid;
  v_inst_pec uuid;
  v_inst_dest uuid;
  v_benef uuid;
  v_contact uuid;
  v_medecin uuid;
  v_infi uuid;
  v_souhait uuid;
  v_sac_para uuid;
  v_sac_interv uuid;
  m jsonb;
  h jsonb;
begin
  select id into v_by
    from public.profiles
   where lower(coalesce(email, '')) in (
     'laurent@heartsangels.be',
     'laurent.noulin.be@gmail.com'
   )
   order by case when role = 'admin' then 0 else 1 end
   limit 1;
  if v_by is null then
    select id into v_by from public.profiles where coalesce(actif, true) and role = 'admin' limit 1;
  end if;

  select id into v_recolteur
    from public.profiles
   where lower(coalesce(nom, '')) = 'cloes'
   limit 1;

  select id into v_sac_para from public.stock_lieux where nom = 'Sac paramedic' and coalesce(actif, true) limit 1;
  select id into v_sac_interv from public.stock_lieux where nom = 'Sac intervention' and coalesce(actif, true) limit 1;

  -- Partenaire fictif
  insert into public.partenaires (nom, type, contact_nom, contact_email, email_general, fictif, notes, actif)
  select
    'Partenaire fictif (test)',
    'maison_repos',
    'Laurent Noulin',
    'laurent.noulin@outlook.be',
    'laurent.noulin@outlook.be',
    true,
    'Organisation de démonstration. Toutes les demandes et missions issues de ce partenaire sont fictives.',
    true
  where not exists (
    select 1 from public.partenaires p
    where lower(p.nom) = 'partenaire fictif (test)'
       or lower(coalesce(p.email_general, p.contact_email, '')) = 'laurent.noulin@outlook.be'
  );

  select id into v_partenaire
    from public.partenaires
   where lower(nom) = 'partenaire fictif (test)'
      or lower(coalesce(email_general, contact_email, '')) = 'laurent.noulin@outlook.be'
   order by case when lower(nom) = 'partenaire fictif (test)' then 0 else 1 end
   limit 1;

  update public.partenaires
     set fictif = true,
         type = coalesce(nullif(type, ''), 'maison_repos'),
         actif = true,
         notes = coalesce(nullif(notes, ''),
           'Organisation de démonstration. Toutes les demandes et missions issues de ce partenaire sont fictives.')
   where id = v_partenaire;

  -- Institution PEC
  select id into v_inst_pec
    from public.annuaire
   where categorie = 'institution'
     and data->>'demo_cle' = v_cle
     and data->>'demo_role' = 'pec'
   limit 1;
  if v_inst_pec is null then
    insert into public.annuaire (categorie, nom, telephone, data, created_by)
    values (
      'institution',
      'MRS Les Tilleuls (TEST FICTIF)',
      '04 000 11 22',
      jsonb_build_object(
        'demo_cle', v_cle,
        'demo_role', 'pec',
        'type_institution', 'MR / MRS',
        'telephone', '04 000 11 22',
        'notes', 'Établissement fictif de formation. Ne correspond à aucun vrai patient.',
        'adresse', jsonb_build_object(
          'rue', 'Rue de l’Hôpital',
          'numero', '12',
          'cp', '4100',
          'localite', 'Seraing',
          'pays', 'Belgique'
        )
      ),
      v_by
    )
    returning id into v_inst_pec;
  end if;

  -- Lieu destination (annuaire institution culturelle, pour le dossier)
  select id into v_inst_dest
    from public.annuaire
   where categorie = 'institution'
     and data->>'demo_cle' = v_cle
     and data->>'demo_role' = 'destination'
   limit 1;
  if v_inst_dest is null then
    insert into public.annuaire (categorie, nom, telephone, data, created_by)
    values (
      'institution',
      'Aquarium-Muséum de Liège (TEST FICTIF)',
      '04 366 50 10',
      jsonb_build_object(
        'demo_cle', v_cle,
        'demo_role', 'destination',
        'type_institution', 'Autre',
        'telephone', '04 366 50 10',
        'notes', 'Lieu de destination fictif pour le souhait de formation.',
        'adresse', jsonb_build_object(
          'rue', 'Quai Van Beneden',
          'numero', '1',
          'cp', '4020',
          'localite', 'Liège',
          'pays', 'Belgique'
        )
      ),
      v_by
    )
    returning id into v_inst_dest;
  end if;

  update public.partenaires
     set annuaire_id = coalesce(annuaire_id, v_inst_pec)
   where id = v_partenaire;

  -- Bénéficiaire fictif
  select id into v_benef
    from public.annuaire
   where categorie = 'beneficiaire'
     and data->>'demo_cle' = v_cle
   limit 1;
  if v_benef is null then
    insert into public.annuaire (
      categorie, nom, prenom, niss, genre, date_naissance, tel_gsm, data, created_by
    ) values (
      'beneficiaire',
      'TEST-Angel',
      'Camille',
      '00000000097',
      'femme',
      date '1950-03-12',
      '0470 00 00 01',
      jsonb_build_object(
        'demo_cle', v_cle,
        'adresse', jsonb_build_object(
          'rue', 'Rue sous les vignes',
          'numero', '8',
          'cp', '4101',
          'localite', 'Seraing',
          'pays', 'Belgique'
        ),
        'notes', 'Personne fictive — formation Heart’s Angels. NISS d’exemple, ne pas confondre avec un vrai dossier.'
      ),
      v_by
    )
    returning id into v_benef;
  end if;

  -- Accompagnant
  select id into v_contact
    from public.annuaire
   where categorie = 'accompagnant'
     and data->>'demo_cle' = v_cle
   limit 1;
  if v_contact is null then
    insert into public.annuaire (
      categorie, nom, prenom, lien, tel_gsm, beneficiaire_id, data, created_by
    ) values (
      'accompagnant',
      'TEST-Angel',
      'Hugo',
      'fils',
      '0470 00 00 02',
      v_benef,
      jsonb_build_object('demo_cle', v_cle, 'notes', 'Accompagnant fictif de formation.'),
      v_by
    )
    returning id into v_contact;
  end if;

  -- Médecin + infirmier d’institution (équipe pluri)
  select id into v_medecin
    from public.annuaire
   where categorie = 'medical'
     and data->>'demo_cle' = v_cle
     and data->>'type_medical' in ('Médecin', 'Medecin')
   limit 1;
  if v_medecin is null then
    insert into public.annuaire (categorie, nom, prenom, telephone, data, created_by)
    values (
      'medical',
      'Fictive',
      'Léa',
      '+32 499 00 00 01',
      jsonb_build_object(
        'demo_cle', v_cle,
        'type_medical', 'Médecin',
        'tel_gsm', '+32 499 00 00 01',
        'telephone', '+32 499 00 00 01',
        'organisme', 'MRS Les Tilleuls (TEST FICTIF)',
        'notes', 'Médecin fictif — joignable uniquement dans le cadre de la formation.'
      ),
      v_by
    )
    returning id into v_medecin;
  end if;

  select id into v_infi
    from public.annuaire
   where categorie = 'medical'
     and data->>'demo_cle' = v_cle
     and data->>'type_medical' = 'Infirmier'
   limit 1;
  if v_infi is null then
    insert into public.annuaire (categorie, nom, prenom, telephone, data, created_by)
    values (
      'medical',
      'Demo',
      'Marc',
      '+32 499 00 00 02',
      jsonb_build_object(
        'demo_cle', v_cle,
        'type_medical', 'Infirmier',
        'tel_gsm', '+32 499 00 00 02',
        'telephone', '+32 499 00 00 02',
        'organisme', 'MRS Les Tilleuls (TEST FICTIF)'
      ),
      v_by
    )
    returning id into v_infi;
  end if;

  select id into v_souhait
    from public.souhaits
   where mission->>'demo_cle' = v_cle
   limit 1;

  h := public.horaires_mission_demo(v_jour);
  -- jsonb_build_object est limité à 100 arguments : on fusionne plusieurs objets.
  m := jsonb_build_object(
    'demo_cle', v_cle,
    'demo_recyclable', true,
    'origine', 'Institution · MRS Les Tilleuls (TEST FICTIF)',
    'base_nom', 'Solumob Jemeppe-sur-Meuse',
    'base_adresse', jsonb_build_object(
      'rue', 'Rue sous les vignes', 'numero', '8', 'cp', '4101',
      'localite', 'Seraing', 'pays', 'Belgique'
    ),
    'rdv_base', h->>'rdv_base',
    'depart_base', h->>'depart_base',
    'pec_type', 'Institution',
    'pec_inst_source', 'demandeuse',
    'pec_institution', 'MRS Les Tilleuls (TEST FICTIF)',
    'pec_adresse', jsonb_build_object(
      'rue', 'Rue de l’Hôpital', 'numero', '12', 'cp', '4100',
      'localite', 'Seraing', 'pays', 'Belgique'
    ),
    'pec_service', 'Unité de revalidation',
    'pec_etage', '2',
    'pec_aile', 'Aile B',
    'pec_chambre', '214 (FICTIF)',
    'arrivee_pec', h->>'arrivee_pec',
    'depart_pec', h->>'depart_pec',
    'pec_precisions', 'FICTIF — badge visiteur à l’accueil. Patient en chaise, O₂ lunettes 2 L/min. Briefing détresse avec l’équipage avant de quitter l’institution.',
    'dest_adresse', jsonb_build_object(
      'rue', 'Quai Van Beneden', 'numero', '1', 'cp', '4020',
      'localite', 'Liège', 'pays', 'Belgique'
    ),
    'dest_precisions', 'Aquarium-Muséum (accès PMR côté quai). Stationnement dépose minute. Durée sur place ~ 3 h. FICTIF.',
    'arrivee_destination', h->>'arrivee_destination',
    'retour_type', 'Patient attendu à une heure',
    'retour_heure', h->>'retour_heure',
    'retour_precisions', 'Retour à la MRS pour le repas du soir. Transmettre le rapport à l’accueil (simulation).',
    'patient_adresse', jsonb_build_object(
      'rue', 'Rue sous les vignes', 'numero', '8', 'cp', '4101',
      'localite', 'Seraing', 'pays', 'Belgique'
    ),
    'registre_national', '00000000097',
    'consentement', true,
    'autorisation_photos', 'sans_visage',
    'priorite_elevee', false,
    'date_demande', to_char(public.date_bruxelles(), 'YYYY-MM-DD'),
    'date_rencontre', to_char(public.date_bruxelles(), 'YYYY-MM-DD') || 'T14:00'
  );
  m := m || jsonb_build_object(
    'consignes_equipage',
      'FORMATION FICTIF — Ce n’est PAS un vrai patient.' || chr(10)
      || 'Parcours complet : checklists, terrain, bouton rouge protocole de détresse (simulation uniquement).' || chr(10)
      || 'En cas de vraie urgence autour de vous : 112. Ne jamais administrer les médicaments du protocole hors simulation.' || chr(10)
      || 'Une fois la mission clôturée, le dossier revient en Nouveau le lendemain (départ base 9h30) pour qu’un autre équipage s’entraîne.',
    'allergies', 'Pénicilline (FICTIF) — collier d’allergie.',
    'ne_pas_reanimer', false,
    'details_acharnement', '',
    'pathologies',
      'BPCO GOLD II, insuffisance cardiaque NYHA II, diabète de type 2 (TOUT EST FICTIF).' || chr(10)
      || 'Oxygénodépendance de repos 2 L/min.',
    'antecedents', 'Fracture du col fémoral 2023 (FICTIF). Pas de stent. Pas d’AVC connu.',
    'douleurs', 'Douleurs d’arthrose genou droit, EVA 3/10 au repos.',
    'voie_acces', 'Voie veineuse périphérique possible au membre supérieur gauche (simulation).',
    'mobilisations', 'Quelques pas avec aide, puis chaise roulante. Transfert 2 personnes.',
    'communication', 'Normale. Un peu d’essoufflement à l’effort.',
    'deglutition', 'Normale',
    'alimentation', 'Diabétique, textures normales',
    'continence_urinaire', 'Autonome',
    'continence_fecale', 'Autonome',
    'precisions_continences', '',
    'cible_saturation_o2', '92–94 %',
    'debit_o2', '2',
    'apport_o2', 'Lunettes',
    'cible_ta', '120/70 (tolérer 100–150 / 60–90)',
    'cible_fc', '60–90 / min'
  );
  m := m || jsonb_build_object(
    'protocole_detresse', jsonb_build_object(
      'notes',
        'PROTOCOLE FICTIF DE FORMATION. Ordre indicatif après appel du médecin d’équipe et du 112 si le scénario le prévoit. Ne jamais injecter en dehors de la simulation.',
      'lignes', jsonb_build_array(
        jsonb_build_object('id', 'demo-det-adr', 'medicament', 'Adrénaline', 'dosage', '1 mg', 'voie', 'IM'),
        jsonb_build_object('id', 'demo-det-mida', 'medicament', 'Midazolam', 'dosage', '5 mg', 'voie', 'IV'),
        jsonb_build_object('id', 'demo-det-morph', 'medicament', 'Morphine', 'dosage', '2 mg', 'voie', 'IV'),
        jsonb_build_object('id', 'demo-det-salbu', 'medicament', 'Salbutamol', 'dosage', '5 mg', 'voie', 'nebulisation'),
        jsonb_build_object('id', 'demo-det-gluca', 'medicament', 'Glucagon', 'dosage', '1 mg', 'voie', 'IM'),
        jsonb_build_object('id', 'demo-det-amio', 'medicament', 'Amiodarone', 'dosage', '300 mg', 'voie', 'IV')
      )
    ),
    'vecteurs', jsonb_build_array(
      jsonb_build_object(
        'id', 'a1e0d000-0000-4000-8000-000000000001',
        'nom', '',
        'plaque', '',
        'type_transport', 'Ambulance',
        'roles_requis', jsonb_build_array('ambulancier', 'infirmier')
      )
    ),
    'equipe_pluri', jsonb_build_array(
      jsonb_build_object(
        'id', 'a1e0d000-0000-4000-8000-000000000011',
        'role', 'medecin',
        'prenom', 'Léa',
        'nom', 'Fictive',
        'tel', '+32 499 00 00 01',
        'organisme', 'MRS Les Tilleuls (TEST FICTIF)',
        'notes', 'Médecin fictif. Pour la simu : rester joignable. En vrai urgence → 112.',
        'annuaire_id', v_medecin
      ),
      jsonb_build_object(
        'id', 'a1e0d000-0000-4000-8000-000000000012',
        'role', 'infirmier',
        'prenom', 'Marc',
        'nom', 'Demo',
        'tel', '+32 499 00 00 02',
        'organisme', 'MRS Les Tilleuls (TEST FICTIF)',
        'notes', 'Infirmier d’institution fictif — relais au retour.',
        'annuaire_id', v_infi
      )
    ),
    'recolteur', case when v_recolteur is null then 'Formation' else 'Véronique Cloes' end,
    'recolteurs', case
      when v_recolteur is null then '[]'::jsonb
      else jsonb_build_array(jsonb_build_object(
        'id', v_recolteur, 'prenom', 'Véronique', 'nom', 'Cloes'
      ))
    end,
    'materiel_requis', (
      jsonb_build_array(
        jsonb_build_object('id', 'demo-mat-o2-2', 'kind', 'o2', 'qte', 1, 'volume_l', 2, 'libelle', 'O2 B2L'),
        jsonb_build_object('id', 'demo-mat-o2-5', 'kind', 'o2', 'qte', 1, 'volume_l', 5, 'libelle', 'O2 B5L'),
        jsonb_build_object('id', 'demo-mat-o2-10', 'kind', 'o2', 'qte', 1, 'volume_l', 10, 'libelle', 'O2 B10L'),
        jsonb_build_object('id', 'demo-mat-chaise', 'kind', 'libre', 'qte', 1, 'libelle', 'Chaise roulante'),
        jsonb_build_object('id', 'demo-mat-coussin', 'kind', 'libre', 'qte', 1, 'libelle', 'Coussin anti-escarres')
      )
      || case when v_sac_para is not null then jsonb_build_array(jsonb_build_object(
           'id', 'demo-mat-sac-para', 'kind', 'sac', 'qte', 1, 'lieu_id', v_sac_para, 'libelle', 'Sac paramedic'
         )) else '[]'::jsonb end
      || case when v_sac_interv is not null then jsonb_build_array(jsonb_build_object(
           'id', 'demo-mat-sac-int', 'kind', 'sac', 'qte', 1, 'lieu_id', v_sac_interv, 'libelle', 'Sac intervention'
         )) else '[]'::jsonb end
    ),
    'checklist_extras', jsonb_build_object(
      'base', jsonb_build_array(jsonb_build_object(
        'id', 'demo-cl-brief',
        'libelle', 'Briefing formation — rappeler que le dossier est FICTIF',
        'medical', false
      )),
      'pec', jsonb_build_array(jsonb_build_object(
        'id', 'demo-cl-detresse',
        'libelle', 'Relire le protocole de détresse (simulation) avant de quitter la PEC',
        'medical', true
      ))
    )
  );

  if v_souhait is null then
    insert into public.souhaits (
      beneficiaire_nom, beneficiaire_prenom, beneficiaire_ddn, beneficiaire_contact,
      beneficiaire_annuaire_id, contact_annuaire_id, beneficiaire_niss, beneficiaire_genre,
      beneficiaire_tel_gsm, beneficiaire_adresse,
      description, localisation, notes_medicales, besoins_specifiques,
      date_souhaitee, date_fin, dates_possibles, courte_duree, heure_depart, heure_retour,
      statut, priorite, origine, partenaire_id, annuaire_externe_id,
      created_by, fictif, mission
    ) values (
      'TEST-Angel',
      'Camille',
      date '1950-03-12',
      'Hugo TEST-Angel',
      v_benef,
      v_contact,
      '00000000097',
      'femme',
      '0470 00 00 01',
      jsonb_build_object(
        'rue', 'Rue sous les vignes', 'numero', '8', 'cp', '4101',
        'localite', 'Seraing', 'pays', 'Belgique'
      ),
      'Visite à l’Aquarium-Muséum de Liège. Dossier de formation FICTIF (protocole de détresse). Toutes les données sont inventées — à réaliser puis rejouer le lendemain.',
      'Aquarium-Muséum de Liège',
      'Dossier médical fictif : BPCO, IC NYHA II, diabète 2, O₂ 2 L/min. Protocole de détresse encodé (simulation).',
      'Chaise roulante, O₂ lunettes, transfert 2 personnes. Formation — aucun vrai soin.',
      v_jour,
      v_jour,
      '[]'::jsonb,
      true,
      time '09:30',
      time '16:30',
      'nouveau',
      2,
      'institution',
      v_partenaire,
      v_inst_pec,
      v_by,
      true,
      m
    )
    returning id into v_souhait;
  elsif (select statut::text from public.souhaits where id = v_souhait) in ('nouveau', 'en_attente') then
    -- Rafraîchir le canevas tant que personne n’a démarré le terrain.
    update public.souhaits
       set beneficiaire_nom = 'TEST-Angel',
           beneficiaire_prenom = 'Camille',
           beneficiaire_ddn = date '1950-03-12',
           beneficiaire_contact = 'Hugo TEST-Angel',
           beneficiaire_annuaire_id = v_benef,
           contact_annuaire_id = v_contact,
           beneficiaire_niss = '00000000097',
           beneficiaire_genre = 'femme',
           beneficiaire_tel_gsm = '0470 00 00 01',
           beneficiaire_adresse = jsonb_build_object(
             'rue', 'Rue sous les vignes', 'numero', '8', 'cp', '4101',
             'localite', 'Seraing', 'pays', 'Belgique'
           ),
           description = 'Visite à l’Aquarium-Muséum de Liège. Dossier de formation FICTIF (protocole de détresse). Toutes les données sont inventées — à réaliser puis rejouer le lendemain.',
           localisation = 'Aquarium-Muséum de Liège',
           notes_medicales = 'Dossier médical fictif : BPCO, IC NYHA II, diabète 2, O₂ 2 L/min. Protocole de détresse encodé (simulation).',
           besoins_specifiques = 'Chaise roulante, O₂ lunettes, transfert 2 personnes. Formation — aucun vrai soin.',
           date_souhaitee = v_jour,
           date_fin = v_jour,
           dates_possibles = '[]'::jsonb,
           courte_duree = true,
           heure_depart = time '09:30',
           heure_retour = time '16:30',
           origine = 'institution',
           partenaire_id = v_partenaire,
           annuaire_externe_id = v_inst_pec,
           fictif = true,
           mission = public.appliquer_jour_mission_demo(m, v_jour)
     where id = v_souhait;
  end if;

  insert into public.souhait_medicaments (
    souhait_id, medicament, dosage, voie, type_admin, horaires, posologie_max, notes, ordre, donne
  )
  select v_souhait, x.medicament, x.dosage, x.voie, x.type_admin, x.horaires, x.posologie_max, x.notes, x.ordre, false
  from (values
    ('Bisoprolol', '2,5 mg', 'PO', 'programme', '["08:00"]'::jsonb, null, 'FICTIF — β-bloquant du matin.', 1),
    ('Metformine', '500 mg', 'PO', 'programme', '["08:00","18:00"]'::jsonb, null, 'FICTIF — avec les repas.', 2),
    ('Furosémide', '40 mg', 'PO', 'programme', '["08:00"]'::jsonb, null, 'FICTIF — diurétique.', 3),
    ('Paracétamol', '1 g', 'PO', 'si_necessaire', null, '3 g / 24 h', 'FICTIF — douleur ou fièvre.', 4)
  ) as x(medicament, dosage, voie, type_admin, horaires, posologie_max, notes, ordre)
  where not exists (
    select 1 from public.souhait_medicaments sm
     where sm.souhait_id = v_souhait and sm.medicament = x.medicament
  );

  return v_souhait;
end
$$;

revoke all on function public.assurer_souhait_demo_detresse() from public, anon, authenticated;
grant execute on function public.assurer_souhait_demo_detresse() to service_role;

select public.assurer_souhait_demo_detresse();
select public.recycler_souhaits_demo();

do $$
declare
  jid int;
begin
  for jid in select jobid from cron.job where jobname = 'ha-recyclage-souhaits-demo'
  loop
    perform cron.unschedule(jid);
  end loop;
  perform cron.schedule(
    'ha-recyclage-souhaits-demo',
    '10 2 * * *',
    'select public.recycler_souhaits_demo()'
  );
exception
  when others then
    raise notice 'pg_cron indisponible : %', sqlerrm;
end
$$;

notify pgrst, 'reload schema';
