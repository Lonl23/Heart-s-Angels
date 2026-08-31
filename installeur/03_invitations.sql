-- ════════════════════════════════════════════════════════════════════════════
--  Invitations — inscription auto-gérée par code (sans fonction Edge).
--  L'admin crée une invitation ; la personne s'inscrit elle-même et le RÔLE
--  lui est attribué de façon sûre par une fonction en base (SECURITY DEFINER).
--  À exécuter après rebuild_interne + acces_partenaire.
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists public.invitations (
  code          text primary key,
  email         text not null,
  prenom        text,
  nom           text,
  role          role_utilisateur not null,
  partenaire_id uuid references public.partenaires(id) on delete set null,
  cree_par      uuid references public.profiles(id),
  utilise       boolean default false,
  utilise_le    timestamptz,
  expire_le     timestamptz not null default (now() + interval '7 days'),
  created_at    timestamptz default now()
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.profiles where id = auth.uid()) in ('admin','president'), false)
$$;

-- Vérifier un code AVANT inscription (appelable par un visiteur anonyme)
create or replace function public.verifier_invitation(p_code text, p_email text)
returns json language plpgsql security definer set search_path = public as $$
declare v public.invitations;
begin
  select * into v from public.invitations where code = p_code;
  if not found or v.utilise or v.expire_le < now() or lower(v.email) <> lower(p_email) then
    return json_build_object('ok', false);
  end if;
  return json_build_object('ok', true, 'prenom', v.prenom, 'nom', v.nom, 'role', v.role);
end $$;

-- Consommer le code APRÈS inscription (utilisateur connecté) → attribue le rôle
create or replace function public.consommer_invitation(p_code text)
returns json language plpgsql security definer set search_path = public as $$
declare v public.invitations; v_email text;
begin
  select email into v_email from auth.users where id = auth.uid();
  if v_email is null then return json_build_object('ok', false, 'error', 'non authentifié'); end if;
  select * into v from public.invitations where code = p_code;
  if not found then return json_build_object('ok', false, 'error', 'Code invalide.'); end if;
  if v.utilise then return json_build_object('ok', false, 'error', 'Code déjà utilisé.'); end if;
  if v.expire_le < now() then return json_build_object('ok', false, 'error', 'Code expiré.'); end if;
  if lower(v.email) <> lower(v_email) then return json_build_object('ok', false, 'error', 'Ce code ne correspond pas à votre e-mail.'); end if;
  update public.profiles
     set role = v.role, partenaire_id = v.partenaire_id,
         prenom = coalesce(nullif(v.prenom,''), prenom),
         nom    = coalesce(nullif(v.nom,''), nom),
         doit_changer_mdp = false, actif = true
   where id = auth.uid();
  update public.invitations set utilise = true, utilise_le = now() where code = p_code;
  return json_build_object('ok', true, 'role', v.role);
end $$;

grant execute on function public.verifier_invitation(text,text) to anon, authenticated;
grant execute on function public.consommer_invitation(text) to authenticated;

alter table public.invitations enable row level security;
drop policy if exists invitations_admin_all on public.invitations;
create policy invitations_admin_all on public.invitations for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.invitations to authenticated, service_role;

notify pgrst, 'reload schema';
