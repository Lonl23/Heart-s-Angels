-- ════════════════════════════════════════════════════════════════════════════
--  Créer un volontaire sans e-mail ni compte de connexion.
--  Fiche « Sans accès » ; « Configurer le compte » envoie l’invitation plus tard.
--  Idempotent. Après 69_dispo_par_date_option.sql.
-- ════════════════════════════════════════════════════════════════════════════

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

notify pgrst, 'reload schema';
