-- ════════════════════════════════════════════════════════════════════════════
--  Invitation membre : médical / non médical uniquement.
--  type_benevole est recopié sur la fiche à l’inscription (vaut le profil).
--  Les fonctions ASBL (président, trésorier…) restent dans la fiche.
--  Idempotent. Après 49_role_volontaire_medical.sql.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.invitations
  add column if not exists type_benevole text;

comment on column public.invitations.type_benevole is
  'medical | non_medical pour un volontaire. Null pour un compte partenaire.';

alter table public.invitations drop constraint if exists invitations_type_benevole_chk;
alter table public.invitations add constraint invitations_type_benevole_chk
  check (type_benevole is null or type_benevole in ('medical', 'non_medical'));

create or replace function public.invitations_membres_role_guard()
returns trigger
language plpgsql
as $$
begin
  if new.partenaire_id is null then
    if tg_op = 'INSERT' or new.role is distinct from old.role then
      if new.role::text not in ('volontaire_medical', 'volontaire_non_medical') then
        raise exception 'Un volontaire s''invite uniquement comme médical ou non médical.';
      end if;
    end if;
    if new.type_benevole is null or btrim(new.type_benevole) = '' then
      if new.role::text = 'volontaire_medical' then
        new.type_benevole := 'medical';
      elsif new.role::text = 'volontaire_non_medical' then
        new.type_benevole := 'non_medical';
      end if;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists invitations_membres_role_guard on public.invitations;
create trigger invitations_membres_role_guard
  before insert or update on public.invitations
  for each row execute function public.invitations_membres_role_guard();

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

  select coalesce(fiche, '{}'::jsonb) into v_fiche from public.profiles where id = auth.uid();
  if v.type_benevole is not null and btrim(v.type_benevole) <> '' then
    v_fiche := coalesce(v_fiche, '{}'::jsonb) || jsonb_build_object('type_benevole', v.type_benevole);
  end if;

  update public.profiles
     set role = v.role,
         partenaire_id = v.partenaire_id,
         prenom = coalesce(nullif(v.prenom,''), prenom),
         nom    = coalesce(nullif(v.nom,''), nom),
         fiche  = coalesce(v_fiche, fiche, '{}'::jsonb),
         doit_changer_mdp = false,
         actif = true
   where id = auth.uid();
  update public.invitations set utilise = true, utilise_le = now() where code = p_code;
  return json_build_object('ok', true, 'role', v.role);
end $$;

grant execute on function public.consommer_invitation(text) to authenticated;

notify pgrst, 'reload schema';
