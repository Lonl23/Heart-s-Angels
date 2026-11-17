-- Souhait de test/formation : médicaux + staff (admin/président/coord) peuvent envoyer.
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
            and (
              public.profil_est_medical(p.role::text, coalesce(p.fiche, '{}'::jsonb), null)
              or p.role in ('admin', 'president', 'coordinateur')
              or coalesce(p.fiche->'roles_asbl', '[]'::jsonb)
                   ?| array['president','vice_president','coord_medical','coord_medical_adjoint','coordinateur_medical','resp_informatique','resp_informatique_adjoint','administrateur_asbl']
            )
        )
      )
$$;
