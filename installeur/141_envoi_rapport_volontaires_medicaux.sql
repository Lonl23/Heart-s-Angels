-- Tout volontaire médical affecté au souhait peut envoyer le rapport médical.
-- Idempotent (réaffirme la règle métier).

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
$$;

comment on function public._user_peut_envoyer_rapport(uuid, uuid) is
  'Coordination médicale, ou volontaire médical affecté au souhait.';
