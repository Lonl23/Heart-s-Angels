-- ════════════════════════════════════════════════════════════════════════════
--  Volontaires sans compte de connexion + import Odoo (identifiant).
--  Une fiche peut exister dans Volontaires avant toute inscription.
--  « Configurer le compte » crée une invitation liée à cette fiche :
--  à l’inscription, les missions déjà affectées suivent le nouveau compte.
--  Idempotent. Après 55_acces_partenaire_demande.sql.
-- ════════════════════════════════════════════════════════════════════════════

-- Fiches visibles dans Volontaires sans ligne auth.users (pas de mot de passe).
alter table public.profiles drop constraint if exists profiles_id_fkey;

alter table public.souhaits
  add column if not exists odoo_id integer;
create unique index if not exists souhaits_odoo_id_uidx
  on public.souhaits (odoo_id)
  where odoo_id is not null;

comment on column public.souhaits.odoo_id is
  'Identifiant Odoo x_beneficiaires.id (lecture seule). Sert à éviter les doublons d’import.';

alter table public.invitations
  add column if not exists profile_cible_id uuid references public.profiles(id) on delete set null;

comment on column public.invitations.profile_cible_id is
  'Fiche volontaire déjà encodée (sans accès). Fusionnée vers le compte créé à l’inscription.';

create or replace function public.fusionner_profil_stub(p_stub uuid, p_reel uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_sql text;
  v_stub_fiche jsonb;
begin
  if p_stub is null or p_reel is null or p_stub = p_reel then
    return;
  end if;
  if not exists (select 1 from public.profiles where id = p_stub) then
    return;
  end if;
  if not exists (select 1 from public.profiles where id = p_reel) then
    return;
  end if;

  select coalesce(fiche, '{}'::jsonb) into v_stub_fiche from public.profiles where id = p_stub;

  update public.profiles p
     set prenom    = coalesce(nullif(s.prenom, ''), p.prenom),
         nom       = coalesce(nullif(s.nom, ''), p.nom),
         telephone = coalesce(nullif(s.telephone, ''), p.telephone),
         role      = s.role,
         fiche     = (coalesce(v_stub_fiche, '{}'::jsonb) || coalesce(p.fiche, '{}'::jsonb)
                      || case
                           when coalesce(jsonb_array_length(p.fiche->'qualifications'), 0) = 0
                             then jsonb_build_object('qualifications', coalesce(v_stub_fiche->'qualifications', '[]'::jsonb))
                           else '{}'::jsonb
                         end
                      || case
                           when coalesce(jsonb_array_length(p.fiche->'roles_asbl'), 0) = 0
                             then jsonb_build_object('roles_asbl', coalesce(v_stub_fiche->'roles_asbl', '[]'::jsonb))
                           else '{}'::jsonb
                         end)
                     - 'compte_a_configurer'
    from public.profiles s
   where p.id = p_reel
     and s.id = p_stub;

  for r in
    select n.nspname as sch, c.relname as tbl, a.attname as col
    from pg_constraint con
    join pg_class c on c.oid = con.conrelid
    join pg_namespace n on n.oid = c.relnamespace
    join unnest(con.conkey) as k(attnum) on true
    join pg_attribute a on a.attrelid = c.oid and a.attnum = k.attnum
    where con.contype = 'f'
      and con.confrelid = 'public.profiles'::regclass
      and n.nspname = 'public'
      and not (c.relname = 'profiles' and a.attname = 'id')
  loop
    v_sql := format('update %I.%I set %I = $1 where %I = $2', r.sch, r.tbl, r.col, r.col);
    begin
      execute v_sql using p_reel, p_stub;
    exception when unique_violation then
      execute format('delete from %I.%I where %I = $1', r.sch, r.tbl, r.col) using p_stub;
    end;
  end loop;

  update public.souhaits
     set mission = replace(coalesce(mission, '{}'::jsonb)::text, p_stub::text, p_reel::text)::jsonb
   where mission is not null
     and mission::text like '%' || p_stub::text || '%';

  delete from public.profiles where id = p_stub;
end $$;

revoke all on function public.fusionner_profil_stub(uuid, uuid) from public, anon, authenticated;
grant execute on function public.fusionner_profil_stub(uuid, uuid) to service_role;

create or replace function public.consommer_invitation(p_code text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v public.invitations;
  v_email text;
  v_fiche jsonb;
begin
  select email into v_email from auth.users where id = auth.uid();
  if v_email is null then return json_build_object('ok', false, 'error', 'non authentifié'); end if;
  select * into v from public.invitations where code = p_code;
  if not found then return json_build_object('ok', false, 'error', 'Code invalide.'); end if;
  if v.utilise then return json_build_object('ok', false, 'error', 'Code déjà utilisé.'); end if;
  if v.expire_le < now() then return json_build_object('ok', false, 'error', 'Code expiré.'); end if;
  if lower(v.email) <> lower(v_email) then return json_build_object('ok', false, 'error', 'Ce code ne correspond pas à votre e-mail.'); end if;

  if v.profile_cible_id is not null and v.profile_cible_id is distinct from auth.uid() then
    perform set_config('app.role_guard_off', 'on', true);
    perform public.fusionner_profil_stub(v.profile_cible_id, auth.uid());
  end if;

  select coalesce(fiche, '{}'::jsonb) into v_fiche from public.profiles where id = auth.uid();
  if v.type_benevole is not null and btrim(v.type_benevole) <> '' then
    v_fiche := coalesce(v_fiche, '{}'::jsonb) || jsonb_build_object('type_benevole', v.type_benevole);
  end if;
  v_fiche := coalesce(v_fiche, '{}'::jsonb) - 'compte_a_configurer';

  perform set_config('app.role_guard_off', 'on', true);
  update public.profiles
     set role = v.role,
         partenaire_id = v.partenaire_id,
         prenom = coalesce(nullif(v.prenom,''), prenom),
         nom    = coalesce(nullif(v.nom,''), nom),
         email  = coalesce(nullif(email,''), v_email),
         fiche  = coalesce(v_fiche, fiche, '{}'::jsonb),
         doit_changer_mdp = false,
         actif = true
   where id = auth.uid();

  update public.invitations set utilise = true, utilise_le = now() where code = p_code;
  return json_build_object('ok', true, 'role', v.role);
end $$;

grant execute on function public.consommer_invitation(text) to authenticated;

notify pgrst, 'reload schema';
