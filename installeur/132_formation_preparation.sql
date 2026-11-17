-- ════════════════════════════════════════════════════════════════════════════
--  Souhait de formation préparation : un dossier fictif personnel par compte
--  ayant accès à la préparation des souhaits (indépendant, comme Camille
--  l’est pour le terrain dans Mes souhaits).
--  demo_cle = formation_preparation
--  Idempotent. Après 131_activite_province.sql.
-- ════════════════════════════════════════════════════════════════════════════

create index if not exists souhaits_formation_prep_owner_idx
  on public.souhaits (created_by)
  where coalesce(fictif, false)
    and coalesce(mission->>'demo_cle', '') = 'formation_preparation';

create or replace function public.est_souhait_formation_preparation(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.souhaits s
     where s.id = p_id
       and coalesce(s.fictif, false)
       and coalesce(s.mission->>'demo_cle', '') = 'formation_preparation'
  )
$$;

revoke all on function public.est_souhait_formation_preparation(uuid) from public, anon;
grant execute on function public.est_souhait_formation_preparation(uuid) to authenticated, service_role;

-- Crée ou renvoie le souhait de formation préparation du compte courant.
create or replace function public.assurer_souhait_formation_preparation()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  sid uuid;
  m jsonb;
begin
  if uid is null then
    raise exception 'Non authentifié';
  end if;
  if not public.peut_voir_souhaits() then
    raise exception 'Accès préparation souhaits requis';
  end if;

  select s.id into sid
    from public.souhaits s
   where coalesce(s.fictif, false)
     and coalesce(s.mission->>'demo_cle', '') = 'formation_preparation'
     and s.created_by = uid
   order by s.created_at asc
   limit 1;

  if sid is not null then
    return sid;
  end if;

  m := jsonb_build_object(
    'demo_cle', 'formation_preparation',
    'formation_prep', true,
    'notes', 'Dossier fictif personnel — entraînement à la préparation. Invisible pour les autres préparateurs.'
  );

  insert into public.souhaits (
    description, localisation, statut, priorite, fictif,
    beneficiaire_prenom, beneficiaire_nom, beneficiaire_ddn, beneficiaire_genre, beneficiaire_niss,
    beneficiaire_adresse, beneficiaire_adresse_residence,
    origine, contacts, mission, created_by,
    date_souhaitee, date_fin, courte_duree, heure_depart, heure_retour
  ) values (
    'Souhait de formation — entraînement à l’encodage et à la préparation du dossier. Fictif, personnel, indépendant des autres préparateurs.',
    'À définir (entraînement)',
    'nouveau',
    2,
    true,
    'Léa',
    'TEST-Prep',
    '1968-05-14',
    'femme',
    null,
    jsonb_build_object('rue', 'Rue de la Formation', 'numero', '1', 'cp', '4000', 'localite', 'Liège', 'pays', 'Belgique'),
    jsonb_build_object('rue', 'Rue de la Formation', 'numero', '1', 'cp', '4000', 'localite', 'Liège', 'pays', 'Belgique'),
    'prive',
    jsonb_build_array(
      jsonb_build_object(
        'id', gen_random_uuid()::text,
        'type', 'demandeur',
        'prenom', 'Marc',
        'nom', 'TEST-Prep',
        'lien', 'fils',
        'tel_gsm', '+32 470.00.00.00'
      )
    ),
    m,
    uid,
    (current_date + 14),
    (current_date + 14),
    true,
    time '10:00',
    time '16:00'
  )
  returning id into sid;

  return sid;
end
$$;

revoke all on function public.assurer_souhait_formation_preparation() from public, anon;
grant execute on function public.assurer_souhait_formation_preparation() to authenticated;

comment on function public.assurer_souhait_formation_preparation() is
  'Souhait fictif personnel pour entraîner la préparation (un par compte).';

-- Ne pas figer le statut des dossiers formation_preparation (ce sont des sandboxes).
-- Le trigger existant trg_demo_statut_partage_fige s’applique à tout est_souhait_demo ;
-- on restreint ce figeage à la formation terrain (Camille / formation_detresse).
create or replace function public.est_souhait_demo(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.souhaits s
     where s.id = p_id
       and coalesce(s.fictif, false)
       and coalesce(s.mission->>'demo_cle', '') <> ''
       and coalesce(s.mission->>'demo_cle', '') <> 'formation_preparation'
  )
$$;

notify pgrst, 'reload schema';
