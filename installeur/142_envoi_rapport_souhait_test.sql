-- Envoi rapport médical aussi sur les souhaits de test / formation (sans équipage).
-- Idempotent.

create or replace function public._user_peut_envoyer_rapport(p_user uuid, p_souhait uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.est_coordination_medicale(p_user)
      or exists (
        select 1
        from public.profiles p
        join public.souhait_personnel sp on sp.user_id = p.id and sp.souhait_id = p_souhait
        where p.id = p_user
          and public.profil_est_medical(p.role::text, coalesce(p.fiche, '{}'::jsonb), sp.role_mission)
      )
      or (
        exists (
          select 1 from public.souhaits s
          where s.id = p_souhait
            and coalesce(s.fictif, false)
            and coalesce(s.mission->>'demo_cle', '') <> ''
        )
        and exists (
          select 1 from public.profiles p
          where p.id = p_user
            and public.profil_est_medical(p.role::text, coalesce(p.fiche, '{}'::jsonb), null)
        )
      )
$$;

create or replace function public.autoriser_envoi_rapport(p_souhait uuid, p_user uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_user is null or p_souhait is null then return false; end if;
  if coalesce(auth.role(), '') is distinct from 'service_role' then
    if auth.uid() is null or auth.uid() is distinct from p_user then
      return false;
    end if;
  end if;
  return public._user_peut_envoyer_rapport(p_user, p_souhait);
end
$$;

comment on function public._user_peut_envoyer_rapport(uuid, uuid) is
  'Coordination médicale, volontaire médical affecté, ou médical sur souhait de test/formation.';
