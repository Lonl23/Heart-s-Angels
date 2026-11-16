-- ════════════════════════════════════════════════════════════════════════════
--  Notif photographes uniquement si autorisation photos accordée
--  (oui / oui_sauf_presse) au moment de la validation.
--  Idempotent. Après 135_prep_patho_photo_blocages.sql.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.notifier_photographes_souhait(p_souhait uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.souhaits%rowtype;
  auth_photo text;
  lieu text;
  n int;
begin
  if p_souhait is null then return 0; end if;
  select * into s from public.souhaits where id = p_souhait;
  if not found then return 0; end if;
  if coalesce(s.fictif, false) then return 0; end if;
  if public.est_souhait_formation_preparation(p_souhait) then return 0; end if;

  -- Uniquement si l’autorisation photos est positive (pas refus / vide).
  auth_photo := lower(trim(coalesce(s.mission->>'autorisation_photos', '')));
  if auth_photo not in ('oui', 'oui_sauf_presse', 'sans_visage', 'oui_sans_visage') then
    return 0;
  end if;

  lieu := coalesce(
    nullif(s.localisation, ''),
    s.mission->'dest_adresse'->>'localite',
    'lieu à confirmer'
  );

  n := public.notifier_evenement(
    'souhait_pret_photographe',
    'Souhait prêt — photographes',
    coalesce(s.beneficiaire_prenom, 'Patient') || ' · ' || public.fmt_dates_souhait(s) || ' · ' || lieu,
    '/app/souhaits/' || p_souhait::text,
    'normale',
    null,
    p_souhait,
    jsonb_build_object(
      'souhait_id', p_souhait,
      'autorisation_photos', auth_photo,
      'sans_dedup', true
    )
  );
  return n;
end
$$;

comment on function public.notifier_photographes_souhait(uuid) is
  'Notifie les photographes si date+équipage validés ET autorisation photos accordée.';

notify pgrst, 'reload schema';
