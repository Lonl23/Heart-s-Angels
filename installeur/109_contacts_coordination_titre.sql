-- Contacts de mission : la coordination médicale renvoie aussi la qualification.
-- L'écran distingue alors le médecin coordinateur de l'infirmier ou de l'infirmière.
-- Le téléphone et l'e-mail ne changent pas.

create or replace function public.contacts_mission(p_souhait uuid)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  s public.souhaits;
  crew jsonb;
  coords jsonb;
begin
  if not public.peut_lire_dar(p_souhait) then
    return json_build_object('ok', false, 'error', 'non autorisé');
  end if;
  select * into s from public.souhaits where id = p_souhait;
  if not found then return json_build_object('ok', false, 'error', 'introuvable'); end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'prenom', p.prenom,
    'nom', p.nom,
    'role', sp.role_mission,
    'telephone', coalesce(p.fiche->>'telephone', '')
  ) order by p.prenom), '[]'::jsonb)
    into crew
  from public.souhait_personnel sp
  join public.profiles p on p.id = sp.user_id
  where sp.souhait_id = p_souhait;

  select coalesce(jsonb_agg(jsonb_build_object(
    'prenom', p.prenom,
    'nom', p.nom,
    'telephone', coalesce(p.fiche->>'telephone', ''),
    'email', coalesce(p.email, ''),
    'qualifications', coalesce(p.fiche->'qualifications', '[]'::jsonb)
  ) order by p.prenom), '[]'::jsonb)
    into coords
  from public.profiles p
  where coalesce(p.actif, true)
    and coalesce(p.fiche->'roles_asbl' ?| array[
      'coord_medical', 'coord_medical_adjoint', 'coordinateur_medical'
    ], false);

  return json_build_object(
    'ok', true,
    'beneficiaire', json_build_object(
      'prenom', s.beneficiaire_prenom,
      'nom', s.beneficiaire_nom,
      'tel_gsm', s.beneficiaire_tel_gsm,
      'tel_fixe', s.beneficiaire_tel_fixe,
      'email', s.beneficiaire_email
    ),
    'contacts', coalesce(s.contacts, '[]'::jsonb),
    'equipe_pluri', coalesce(s.mission->'equipe_pluri', '[]'::jsonb),
    'institution', json_build_object(
      'nom', s.mission->>'pec_institution',
      'service', s.mission->>'pec_service',
      'telephone', coalesce(s.mission->>'pec_telephone', '')
    ),
    'equipage', crew,
    'coordinateurs', coords
  );
end
$$;

grant execute on function public.contacts_mission(uuid) to authenticated;
