-- ════════════════════════════════════════════════════════════════════════════
--  Accès préparation hors équipe (récolte / coord / log / transport) :
--  motif obligatoire + notification immédiate à la présidence.
--  Idempotent. Après 132_formation_preparation.sql.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.roles_equipe_notification(p_type text)
returns text[]
language sql
immutable
as $$
  select case p_type
    when 'demande_souhait' then array['recolteur_souhait']
    when 'equipage_incomplet' then array['coord_benevoles','coord_benevoles_adjoint','coord_transport','coord_transport_adjoint']
    when 'rapport_materiel' then array['resp_logistique','resp_logistique_adjoint']
    when 'peremption_stock' then array['resp_logistique','resp_logistique_adjoint']
    when 'stock_bas' then array['resp_logistique','resp_logistique_adjoint']
    when 'oxygene_basse' then array['resp_logistique','resp_logistique_adjoint']
    when 'entretien_materiel' then array['resp_logistique','resp_logistique_adjoint']
    when 'commande_rappel' then array['resp_logistique','resp_logistique_adjoint']
    when 'ticket_plein' then array['tresorier','tresorier_adjoint','president','vice_president']
    when 'protocole_detresse' then array['coord_medical','coord_medical_adjoint','coordinateur_medical']
    when 'helpdesk_nouveau' then array['resp_informatique','resp_informatique_adjoint']
    when 'dispo_retiree' then array['coord_benevoles','coord_benevoles_adjoint']
    when 'echeance_staff' then array['coord_benevoles','coord_benevoles_adjoint']
    when 'acces_preparation_souhait' then array['president','vice_president']
    else null
  end
$$;

create or replace function public.demander_acces_preparation_souhait(p_motif text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  qui text;
  motif text := trim(coalesce(p_motif, ''));
  n int;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'Non authentifié');
  end if;
  if char_length(motif) < 8 then
    return jsonb_build_object('ok', false, 'error', 'Indiquez un motif (au moins 8 caractères).');
  end if;
  if not public.peut_voir_souhaits() then
    return jsonb_build_object('ok', false, 'error', 'Accès au module souhaits requis');
  end if;

  select trim(both from coalesce(prenom, '') || ' ' || coalesce(nom, ''))
    into qui
    from public.profiles where id = uid;
  if qui is null or qui = '' then qui := 'Un compte'; end if;

  n := public.notifier_evenement(
    'acces_preparation_souhait',
    'Accès préparation souhait',
    qui || ' a ouvert la préparation avec le motif : ' || motif,
    '/app/souhaits',
    'haute',
    null,
    uid,
    jsonb_build_object(
      'motif', motif,
      'demandeur_id', uid,
      'sans_dedup', true
    )
  );

  return jsonb_build_object('ok', true, 'notifications', n);
end
$$;

revoke all on function public.demander_acces_preparation_souhait(text) from public, anon;
grant execute on function public.demander_acces_preparation_souhait(text) to authenticated;

notify pgrst, 'reload schema';
