-- ════════════════════════════════════════════════════════════════════════════
--  profiles.role = identité de compte / accès ASBL, pas les qualifications.
--  Infirmier, médecin, ambulancier_* quittent l’énuméré : ils vivent dans
--  fiche.qualifications et fiche.type_benevole.
--  Conservés : admin, président, coordinateur, trésorier, secrétaire,
--  partenaire, volontaire_medical, volontaire_non_medical.
--  Idempotent autant que possible. Après 76_smtp_from_noreply.sql.
-- ════════════════════════════════════════════════════════════════════════════

-- Garde-fou : seuls les libellés connus (accès + anciennes quals) sont présents.
do $$
declare
  bad text;
begin
  select string_agg(distinct s.role, ', ' order by s.role) into bad
  from (
    select role::text as role from public.profiles
    union all
    select role::text from public.invitations
  ) s
  where s.role not in (
    'admin', 'president', 'coordinateur', 'tresorier', 'secretaire',
    'partenaire', 'volontaire_medical', 'volontaire_non_medical',
    'ambulancier_bleu', 'ambulancier_gris', 'infirmier', 'medecin'
  );
  if bad is not null then
    raise exception 'Rôles inattendus, migration annulée : %', bad;
  end if;
end $$;

-- Recopier les anciennes quals de compte dans la fiche, sans toucher
-- admin / président / partenaire ni une fiche déjà marquée non médicale.
do $$
declare
  r record;
  f jsonb;
  qs jsonb;
  q text;
  t text;
begin
  for r in
    select id, role::text as role, coalesce(fiche, '{}'::jsonb) as fiche
    from public.profiles
    where role::text in ('ambulancier_bleu', 'ambulancier_gris', 'infirmier', 'medecin')
  loop
    f := r.fiche;
    t := f->>'type_benevole';
    qs := f->'qualifications';
    if jsonb_typeof(qs) is distinct from 'array' then
      qs := '[]'::jsonb;
    end if;

    q := case r.role
      when 'ambulancier_bleu' then 'ambulancier'
      when 'ambulancier_gris' then 'ambulancier'
      when 'infirmier' then 'infirmier'
      when 'medecin' then 'medecin'
    end;

    -- Une fiche déjà « non médical » a souvent reçu infirmier par erreur
    -- dans l’éditeur de table : on ne lui colle pas la qualification.
    if t is distinct from 'non_medical' and q is not null and not (qs ? q) then
      qs := qs || to_jsonb(q);
    end if;
    if t is null or t not in ('medical', 'non_medical') then
      t := 'medical';
    end if;

    update public.profiles
       set fiche = f || jsonb_build_object('qualifications', qs, 'type_benevole', t)
     where id = r.id;
  end loop;
end $$;

do $$ begin
  create type public.role_utilisateur_acces as enum (
    'admin',
    'president',
    'coordinateur',
    'tresorier',
    'secretaire',
    'partenaire',
    'volontaire_medical',
    'volontaire_non_medical'
  );
exception when duplicate_object then null; end $$;

-- Recréer avant de supprimer l’ancien énuméré (variable locale du type).
create or replace function public.creer_volontaire_sans_compte(
  p_prenom text,
  p_nom text,
  p_role text,
  p_telephone text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_role public.role_utilisateur_acces;
  v_type text;
  v_tel text;
begin
  if not public.peut_gerer_fiches() then
    return json_build_object('ok', false, 'error', 'Droits insuffisants.');
  end if;
  if btrim(coalesce(p_prenom, '')) = '' or btrim(coalesce(p_nom, '')) = '' then
    return json_build_object('ok', false, 'error', 'Prénom et nom requis.');
  end if;

  if p_role = 'volontaire_medical' then
    v_role := 'volontaire_medical';
    v_type := 'medical';
  else
    v_role := 'volontaire_non_medical';
    v_type := 'non_medical';
  end if;

  v_tel := nullif(btrim(coalesce(p_telephone, '')), '');
  v_id := gen_random_uuid();

  insert into public.profiles (id, email, prenom, nom, telephone, role, actif, fiche)
  values (
    v_id,
    null,
    btrim(p_prenom),
    btrim(p_nom),
    v_tel,
    v_role,
    true,
    jsonb_strip_nulls(jsonb_build_object(
      'compte_a_configurer', true,
      'type_benevole', v_type,
      'qualifications', '[]'::jsonb,
      'roles_asbl', '[]'::jsonb,
      'telephone', v_tel
    ))
  );

  return json_build_object('ok', true, 'id', v_id);
end $$;

alter table public.profiles alter column role drop default;

-- Ces politiques référencent profiles.role : Postgres refuse le changement de type sinon.
drop policy if exists dispos_insert on public.disponibilites;
drop policy if exists dispos_update on public.disponibilites;

alter table public.profiles
  alter column role type public.role_utilisateur_acces
  using (
    case
      when role::text in ('ambulancier_bleu', 'ambulancier_gris', 'infirmier', 'medecin') then
        case when coalesce(fiche->>'type_benevole', '') = 'non_medical'
             then 'volontaire_non_medical'
             else 'volontaire_medical'
        end
      else role::text
    end
  )::public.role_utilisateur_acces;

alter table public.invitations
  alter column role type public.role_utilisateur_acces
  using (
    case
      when role::text in ('ambulancier_bleu', 'ambulancier_gris', 'infirmier', 'medecin') then
        case when coalesce(type_benevole, '') = 'non_medical'
             then 'volontaire_non_medical'
             else 'volontaire_medical'
        end
      else role::text
    end
  )::public.role_utilisateur_acces;

drop type public.role_utilisateur;
alter type public.role_utilisateur_acces rename to role_utilisateur;

alter table public.profiles
  alter column role set default 'volontaire_non_medical'::public.role_utilisateur;

create policy dispos_insert on public.disponibilites for insert to authenticated
  with check (
    public.is_staff()
    and (user_id = auth.uid() or public.peut_gerer_dispos())
    and exists (select 1 from public.profiles p where p.id = user_id and p.role::text <> 'partenaire')
  );

create policy dispos_update on public.disponibilites for update to authenticated
  using (user_id = auth.uid() or public.peut_gerer_dispos())
  with check (
    public.is_staff()
    and (user_id = auth.uid() or public.peut_gerer_dispos())
    and exists (select 1 from public.profiles p where p.id = user_id and p.role::text <> 'partenaire')
  );

-- Source alignée sur le nom définitif de l’énuméré.
create or replace function public.creer_volontaire_sans_compte(
  p_prenom text,
  p_nom text,
  p_role text,
  p_telephone text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_role public.role_utilisateur;
  v_type text;
  v_tel text;
begin
  if not public.peut_gerer_fiches() then
    return json_build_object('ok', false, 'error', 'Droits insuffisants.');
  end if;
  if btrim(coalesce(p_prenom, '')) = '' or btrim(coalesce(p_nom, '')) = '' then
    return json_build_object('ok', false, 'error', 'Prénom et nom requis.');
  end if;

  if p_role = 'volontaire_medical' then
    v_role := 'volontaire_medical';
    v_type := 'medical';
  else
    v_role := 'volontaire_non_medical';
    v_type := 'non_medical';
  end if;

  v_tel := nullif(btrim(coalesce(p_telephone, '')), '');
  v_id := gen_random_uuid();

  insert into public.profiles (id, email, prenom, nom, telephone, role, actif, fiche)
  values (
    v_id,
    null,
    btrim(p_prenom),
    btrim(p_nom),
    v_tel,
    v_role,
    true,
    jsonb_strip_nulls(jsonb_build_object(
      'compte_a_configurer', true,
      'type_benevole', v_type,
      'qualifications', '[]'::jsonb,
      'roles_asbl', '[]'::jsonb,
      'telephone', v_tel
    ))
  );

  return json_build_object('ok', true, 'id', v_id);
end $$;

grant execute on function public.creer_volontaire_sans_compte(text, text, text, text) to authenticated;

-- Le type de bénévole / les quals primeront ; volontaire_medical reste un accès médical.
create or replace function public.profil_est_medical(p_role text, p_fiche jsonb, p_role_mission text)
returns boolean language sql immutable as $$
  select
    coalesce(p_fiche->>'type_benevole', '') is distinct from 'non_medical'
    and coalesce(p_role_mission, '') not in (
      'volontaire_non_medical', 'chauffeur', 'secouriste', 'kine', 'psychologue', 'autre'
    )
    and (
      coalesce(p_role_mission, '') in ('ambulancier', 'infirmier', 'medecin')
      or coalesce(p_role, '') in (
        'volontaire_medical', 'medecin', 'infirmier', 'ambulancier_bleu', 'ambulancier_gris'
      )
      or coalesce(p_fiche->>'type_benevole', '') = 'medical'
      or (
        jsonb_typeof(coalesce(p_fiche, '{}'::jsonb)->'qualifications') = 'array'
        and coalesce(p_fiche, '{}'::jsonb)->'qualifications' ?| array['ambulancier', 'infirmier', 'medecin']
      )
    );
$$;

comment on type public.role_utilisateur is
  'Identité de compte / accès : admin, président, coordinateur, trésorier, secrétaire, partenaire, volontaire médical ou non médical. Qualifications (infirmier, médecin, ambulancier) : fiche.qualifications. Fonctions ASBL multiples : fiche.roles_asbl.';

comment on column public.profiles.role is
  'Accès au compte (ASBL / volontaire / partenaire). Pas une qualification professionnelle.';

comment on column public.invitations.role is
  'Rôle de compte attribué à l’inscription. Pour un volontaire : médical ou non médical uniquement.';

notify pgrst, 'reload schema';
