-- © 2026 Heart's Angels ASBL & Laurent Noulin — Tous droits réservés.
-- Autorise patch_mission_cle('stupefiants') pour le registre stupéfiants terrain.
-- Idempotent. Après 96_menu_mission_dar_stats.sql.

create or replace function public.patch_mission_cle(
  p_souhait uuid, p_cle text, p_valeur jsonb, p_mode text default 'set'
)
returns json language plpgsql security definer set search_path = public as $$
declare
  m jsonb;
  sp public.souhait_personnel;
  allowed text[] := array['rapport_medical', 'rapport_observations', 'injections_detresse', 'stupefiants'];
  voir_med boolean;
  a_sp boolean;
  texte text;
begin
  if not public.suis_affecte(p_souhait) then
    return json_build_object('ok', false, 'error', 'non affecté');
  end if;
  if not (p_cle = any(allowed)) then
    return json_build_object('ok', false, 'error', 'clé interdite');
  end if;
  select * into sp from public.souhait_personnel
    where souhait_id = p_souhait and user_id = auth.uid() limit 1;
  a_sp := found;
  voir_med := public.session_profil_est_medical(case when a_sp then sp.role_mission else null end);
  if p_cle in ('rapport_medical', 'injections_detresse', 'stupefiants') and not voir_med then
    return json_build_object('ok', false, 'error', 'réservé au médical');
  end if;
  if public.est_souhait_demo(p_souhait) then
    if p_cle = 'rapport_medical' then
      texte := coalesce(p_valeur #>> '{}', '');
      return public.formation_appliquer(p_souhait, 'patch', p_cle, p_mode, null, to_jsonb(texte));
    end if;
    return public.formation_appliquer(p_souhait, 'patch', p_cle, p_mode, null, p_valeur);
  end if;
  select coalesce(mission, '{}'::jsonb) into m from public.souhaits where id = p_souhait for update;
  if p_cle = 'injections_detresse' and coalesce(p_mode, 'set') = 'append' then
    m := public._jsonb_set_path(
      m,
      array[p_cle],
      coalesce(m->p_cle, '[]'::jsonb) || jsonb_build_array(coalesce(p_valeur, '{}'::jsonb))
    );
  else
    m := public._jsonb_set_path(m, array[p_cle], coalesce(p_valeur, 'null'::jsonb));
  end if;
  update public.souhaits set mission = m where id = p_souhait;
  return json_build_object('ok', true);
end $$;

grant execute on function public.patch_mission_cle(uuid, text, jsonb, text) to authenticated;

notify pgrst, 'reload schema';
