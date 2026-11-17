-- ════════════════════════════════════════════════════════════════════════════
--  Candidatures bénévolat (WordPress) : droits anon + traitement RH.
--  Les demandes de souhait WP utilisent déjà public.demandes_souhaits.
--  Idempotent. Après 129_helpdesk_cycle_vie.sql.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.candidatures_benevoles
  add column if not exists profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists traite_par uuid references public.profiles(id) on delete set null,
  add column if not exists traite_le timestamptz,
  add column if not exists type_benevole text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'candidatures_benevoles_statut_check'
  ) then
    alter table public.candidatures_benevoles
      add constraint candidatures_benevoles_statut_check
      check (statut in ('nouvelle', 'en_cours', 'acceptee', 'refusee'));
  end if;
exception when others then
  null;
end $$;

alter table public.candidatures_benevoles enable row level security;

drop policy if exists candidatures_insert_anon on public.candidatures_benevoles;
create policy candidatures_insert_anon on public.candidatures_benevoles
  for insert to anon, authenticated
  with check (true);

drop policy if exists candidatures_select_rh on public.candidatures_benevoles;
create policy candidatures_select_rh on public.candidatures_benevoles
  for select to authenticated
  using (public.peut_gerer_fiches() or public.peut_gerer_helpdesk() or public.is_admin());

drop policy if exists candidatures_update_rh on public.candidatures_benevoles;
create policy candidatures_update_rh on public.candidatures_benevoles
  for update to authenticated
  using (public.peut_gerer_fiches() or public.is_admin())
  with check (public.peut_gerer_fiches() or public.is_admin());

grant insert on table public.candidatures_benevoles to anon, authenticated;
grant select, update on table public.candidatures_benevoles to authenticated;
grant all on table public.candidatures_benevoles to service_role;

-- Créer fiche + marquer la candidature acceptée (invitation optionnelle côté app).
create or replace function public.accepter_candidature_benevole(
  p_id uuid,
  p_role text default 'volontaire_non_medical',
  p_envoyer_invitation boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.candidatures_benevoles%rowtype;
  v_role text;
  v_type text;
  v_fiche jsonb;
  v_id uuid;
  v_code text;
  v_cree json;
begin
  if not public.peut_gerer_fiches() then
    return jsonb_build_object('ok', false, 'error', 'Droits insuffisants.');
  end if;
  select * into c from public.candidatures_benevoles where id = p_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Candidature introuvable.');
  end if;
  if c.statut = 'acceptee' and c.profile_id is not null then
    return jsonb_build_object('ok', true, 'profile_id', c.profile_id, 'deja', true);
  end if;
  if c.statut = 'refusee' then
    return jsonb_build_object('ok', false, 'error', 'Candidature refusée.');
  end if;

  if p_role = 'volontaire_medical' then
    v_role := 'volontaire_medical';
    v_type := 'medical';
  else
    v_role := 'volontaire_non_medical';
    v_type := 'non_medical';
  end if;
  if c.type_benevole in ('medical', 'non_medical') then
    v_type := c.type_benevole;
    v_role := case when v_type = 'medical' then 'volontaire_medical' else 'volontaire_non_medical' end;
  end if;

  select public.creer_volontaire_sans_compte(
    c.prenom,
    c.nom,
    v_role,
    c.telephone
  ) into v_cree;
  if v_cree is null or (v_cree->>'ok')::boolean is not true then
    return jsonb_build_object('ok', false, 'error', coalesce(v_cree->>'error', 'Création impossible.'));
  end if;
  v_id := (v_cree->>'id')::uuid;

  select fiche into v_fiche from public.profiles where id = v_id;
  v_fiche := coalesce(v_fiche, '{}'::jsonb)
    || jsonb_strip_nulls(jsonb_build_object(
      'type_benevole', v_type,
      'date_naissance', c.date_naissance,
      'adresse', c.adresse,
      'registre_national', nullif(c.registre, ''),
      'profession', nullif(c.profession, ''),
      'telephone', nullif(c.telephone, ''),
      'motivation_candidature', nullif(c.motivation, ''),
      'comites_souhaites', to_jsonb(coalesce(c.comites, '{}'::text[])),
      'origine_candidature', 'wordpress'
    ));
  update public.profiles
     set email = case
           when email is null or email = '' then lower(nullif(btrim(c.email), ''))
           else email
         end,
         fiche = v_fiche
   where id = v_id;

  update public.candidatures_benevoles
     set statut = 'acceptee',
         profile_id = v_id,
         type_benevole = v_type,
         traite_par = auth.uid(),
         traite_le = now()
   where id = p_id;

  if p_envoyer_invitation and nullif(btrim(c.email), '') is not null
     and position('@' in c.email) > 1
     and lower(c.email) <> 'inconnu@heartsangels.be' then
    v_code := 'HA-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4))
      || '-' || upper(substr(md5(random()::text || gen_random_uuid()::text), 1, 4));
    insert into public.invitations (
      code, email, prenom, nom, role, type_benevole, profile_cible_id, utilise
    ) values (
      v_code,
      lower(btrim(c.email)),
      c.prenom,
      c.nom,
      v_role,
      v_type,
      v_id,
      false
    );
    return jsonb_build_object(
      'ok', true,
      'profile_id', v_id,
      'invitation_code', v_code,
      'email', lower(btrim(c.email))
    );
  end if;

  return jsonb_build_object('ok', true, 'profile_id', v_id);
end
$$;

revoke all on function public.accepter_candidature_benevole(uuid, text, boolean) from public, anon;
grant execute on function public.accepter_candidature_benevole(uuid, text, boolean) to authenticated;

create or replace function public.refuser_candidature_benevole(p_id uuid, p_notes text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.peut_gerer_fiches() then
    return jsonb_build_object('ok', false, 'error', 'Droits insuffisants.');
  end if;
  update public.candidatures_benevoles
     set statut = 'refusee',
         notes_internes = coalesce(nullif(trim(p_notes), ''), notes_internes),
         traite_par = auth.uid(),
         traite_le = now()
   where id = p_id
     and statut is distinct from 'acceptee';
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Candidature introuvable ou déjà acceptée.');
  end if;
  return jsonb_build_object('ok', true);
end
$$;

revoke all on function public.refuser_candidature_benevole(uuid, text) from public, anon;
grant execute on function public.refuser_candidature_benevole(uuid, text) to authenticated;

insert into public.app_modules_maintenance (module_key, actif)
values ('candidatures_volontariat', true)
on conflict (module_key) do nothing;

-- Realtime pour la file RH
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'candidatures_benevoles'
  ) then
    execute 'alter publication supabase_realtime add table public.candidatures_benevoles';
  end if;
exception when undefined_object then
  null;
end $$;

notify pgrst, 'reload schema';
