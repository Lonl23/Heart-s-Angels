-- © 2026 Heart's Angels ASBL & Laurent Noulin — Tous droits réservés.
-- Autorise patch stupefiants dans formation_appliquer (souhaits de test).
-- Idempotent. Après 146_stupefiants_mission.sql / 147_gemini_vault.sql.

create or replace function public.formation_appliquer(
  p_souhait uuid, p_op text, p_a text default null, p_b text default null,
  p_flag boolean default null, p_meta jsonb default null
)
returns json language plpgsql security definer set search_path = public as $$
declare
  e jsonb;
  checks jsonb;
  photos jsonb;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'error', 'non authentifié');
  end if;
  if not public.est_souhait_demo(p_souhait) then
    return json_build_object('ok', false, 'error', 'pas une formation');
  end if;
  if not public.suis_affecte(p_souhait) then
    return json_build_object('ok', false, 'error', 'non affecté');
  end if;
  e := public._formation_lire(p_souhait);
  if p_op = 'lire' then
    return json_build_object('ok', true, 'etat', e);
  elsif p_op = 'reset' then
    delete from public.formation_sessions where user_id = auth.uid() and souhait_id = p_souhait;
    return json_build_object('ok', true, 'etat', '{}'::jsonb);
  elsif p_op = 'etape' then
    if not public.etape_terrain_ok(p_a) then
      return json_build_object('ok', false, 'error', 'étape interdite');
    end if;
    e := e || jsonb_build_object('etape', public.normaliser_etape_terrain(p_a));
  elsif p_op = 'cocher' then
    if p_a not in ('base', 'retour_base', 'pec', 'retour_pec') then
      return json_build_object('ok', false, 'error', 'section interdite');
    end if;
    checks := coalesce(e->'checks', '{}'::jsonb);
    checks := public._jsonb_set_path(checks, array[p_a, p_b], to_jsonb(coalesce(p_flag, false)));
    e := public._jsonb_set_path(e, array['checks'], checks);
  elsif p_op = 'photo' then
    photos := public._photo_dans(coalesce(e->'photos', '{}'::jsonb), p_a, p_meta, coalesce(p_b, 'set'));
    e := public._jsonb_set_path(e, array['photos'], photos);
  elsif p_op = 'releves' then
    e := public._jsonb_set_path(e, array['releves'], coalesce(e->'releves', '{}'::jsonb) || coalesce(p_meta, '{}'::jsonb));
  elsif p_op = 'plaque' then
    e := e || jsonb_build_object('plaque', coalesce(p_a, ''));
  elsif p_op = 'noter' then
    e := e || jsonb_build_object('observations', coalesce(p_a, ''));
  elsif p_op = 'patch' then
    if p_a = 'injections_detresse' and coalesce(p_b, 'set') = 'append' then
      e := public._jsonb_set_path(e, array['injections'], coalesce(e->'injections', '[]'::jsonb) || jsonb_build_array(coalesce(p_meta, '{}'::jsonb)));
    elsif p_a = 'rapport_medical' then
      e := e || jsonb_build_object('rapport_medical', coalesce(p_meta #>> '{}', ''));
    elsif p_a = 'rapport_observations' then
      e := e || jsonb_build_object('observations', coalesce(p_meta #>> '{}', ''));
    elsif p_a = 'stupefiants' then
      e := public._jsonb_set_path(e, array['stupefiants'], coalesce(p_meta, '{}'::jsonb));
    else
      return json_build_object('ok', false, 'error', 'clé interdite');
    end if;
  elsif p_op = 'statut_base' then
    e := e || jsonb_build_object('statut_base', coalesce(p_a, ''));
  elsif p_op = 'avancer' then
    if p_a = 'en_cours' then
      e := e || jsonb_build_object('statut', 'en_cours', 'vecteur_statut', 'en_cours');
      if coalesce(p_b, '') <> '' then
        e := e || jsonb_build_object('etape', public.normaliser_etape_terrain(p_b));
      end if;
    elsif p_a = 'realise' then
      e := e || jsonb_build_object('statut', 'terminee_terrain', 'vecteur_statut', 'terminee_terrain', 'etape', 'base_rentre');
    else
      return json_build_object('ok', false, 'error', 'statut interdit');
    end if;
  else
    return json_build_object('ok', false, 'error', 'opération inconnue');
  end if;
  perform public._formation_ecrire(p_souhait, e);
  return json_build_object('ok', true, 'etat', e, 'etape', e->>'etape', 'statut', coalesce(e->>'statut', 'pret'), 'vecteur_statut', e->>'vecteur_statut');
end $$;

grant execute on function public.formation_appliquer(uuid, text, text, text, boolean, jsonb) to authenticated;

notify pgrst, 'reload schema';
