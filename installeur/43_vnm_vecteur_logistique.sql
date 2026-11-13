-- ════════════════════════════════════════════════════════════════════════════
--  Vecteur VNM seul : le rôle mission non médical prime sur la fiche.
--  Pas de matériel à emporter pour un VNM. Idempotent. Après 42.
-- ════════════════════════════════════════════════════════════════════════════

-- Infirmier / médecin / ambulancier. Un rôle VNM / chauffeur / secouriste
-- n’est jamais médical, même si la fiche volontaire est encore « médicale ».
create or replace function public.profil_est_medical(p_role text, p_fiche jsonb, p_role_mission text)
returns boolean language sql immutable as $$
  select
    coalesce(p_fiche->>'type_benevole', '') is distinct from 'non_medical'
    and coalesce(p_role_mission, '') not in (
      'volontaire_non_medical', 'chauffeur', 'secouriste', 'kine', 'psychologue', 'autre'
    )
    and (
      coalesce(p_role_mission, '') in ('ambulancier', 'infirmier', 'medecin')
      or coalesce(p_role, '') in ('medecin', 'infirmier', 'ambulancier_bleu', 'ambulancier_gris')
      or coalesce(p_fiche->>'type_benevole', '') = 'medical'
      or (
        jsonb_typeof(coalesce(p_fiche, '{}'::jsonb)->'qualifications') = 'array'
        and coalesce(p_fiche, '{}'::jsonb)->'qualifications' ?| array['ambulancier', 'infirmier', 'medecin']
      )
    );
$$;

-- Emport O₂ / sacs : réservé à l’équipage médical de la mission.
create or replace function public.stock_emporter(
  p_token text,
  p_souhait uuid,
  p_qte numeric default null
)
returns json language plpgsql security definer set search_path = public as $$
declare
  tok text := trim(coalesce(p_token, ''));
  u public.stock_unites;
  c public.stock_catalogue;
  l public.stock_lieux;
  q numeric;
  avant numeric;
  recap text;
  deja uuid;
  rm text;
begin
  if not public.is_staff() then
    return json_build_object('ok', false, 'error', 'interdit');
  end if;
  if not public._sur_mission_stock(p_souhait) then
    return json_build_object('ok', false, 'error', 'vous n''êtes pas sur cette mission');
  end if;

  select sp.role_mission into rm
    from public.souhait_personnel sp
    where sp.souhait_id = p_souhait and sp.user_id = auth.uid()
    limit 1;
  if found and not public.session_profil_est_medical(rm) then
    return json_build_object('ok', false, 'error', 'l''emport de matériel est réservé à l''équipage médical');
  end if;

  if tok = '' then
    return json_build_object('ok', false, 'error', 'QR vide');
  end if;

  if tok like 'ha:l:%' then
    select * into l from public.stock_lieux where qr_token = tok and actif;
    if not found then return json_build_object('ok', false, 'error', 'lieu inconnu'); end if;
    if l.type not in ('sac', 'pochette') then
      return json_build_object('ok', false, 'error', 'ce QR n''est pas un sac — scannez un sac ou une pochette');
    end if;
    select m.id into deja from public.stock_mouvements m
      where m.souhait_id = p_souhait and m.lieu_id = l.id and m.type = 'emport' and m.unite_id is null
      limit 1;
    if deja is not null then
      return json_build_object('ok', true, 'kind', 'lieu', 'action', 'emporter', 'deja', true,
        'lieu', json_build_object('id', l.id, 'nom', l.nom, 'type', l.type, 'qr_token', l.qr_token),
        'message', l.nom || ' — déjà scanné');
    end if;
    insert into public.stock_mouvements(type, quantite, motif, par, lieu_id, souhait_id)
      values ('emport', 1, 'sac emporté', auth.uid(), l.id, p_souhait);
    return json_build_object('ok', true, 'kind', 'lieu', 'action', 'emporter',
      'lieu', json_build_object('id', l.id, 'nom', l.nom, 'type', l.type, 'qr_token', l.qr_token),
      'message', l.nom || ' emporté');
  end if;

  if tok not like 'ha:u:%' then
    return json_build_object('ok', false, 'error', 'QR non reconnu');
  end if;
  select * into u from public.stock_unites where qr_token = tok;
  if not found then return json_build_object('ok', false, 'error', 'article inconnu'); end if;
  select * into c from public.stock_catalogue where id = u.catalogue_id;
  select * into l from public.stock_lieux where id = u.lieu_id;
  if u.etat = 'perdu' then
    return json_build_object('ok', false, 'error', 'article marqué perdu');
  end if;

  if c.mode = 'oxygene' then
    if u.date_peremption is not null and u.date_peremption < current_date then
      return json_build_object('ok', false, 'error', 'bouteille périmée — ne pas emporter',
        'unite', public._stock_unite_json(u, c, l));
    end if;
    q := coalesce(p_qte, u.pression_bar, 0);
    if q < 0 or q > coalesce(u.pression_pleine, 200) then
      return json_build_object('ok', false, 'error', 'pression invalide (0–' || coalesce(u.pression_pleine, 200)::text || ' bar)');
    end if;
    avant := coalesce(u.pression_bar, 0);
    update public.stock_unites set pression_bar = q where id = u.id;
    select m.id into deja from public.stock_mouvements m
      where m.souhait_id = p_souhait and m.unite_id = u.id and m.type = 'emport' limit 1;
    if deja is not null then
      update public.stock_mouvements
        set quantite = q, motif = 'emporté · ' || q::text || ' bar'
        where id = deja;
    else
      insert into public.stock_mouvements(type, quantite, motif, par, unite_id, lieu_id, souhait_id, catalogue_id)
        values ('emport', q, 'emporté · ' || q::text || ' bar (avant ' || avant::text || ')', auth.uid(), u.id, u.lieu_id, p_souhait, c.id);
    end if;
    select * into u from public.stock_unites where id = u.id;
    recap := c.nom || ' ' || coalesce(u.volume_l, c.volume_l)::text || ' L emportée · '
      || q::text || ' bar · ' || round(coalesce(u.volume_l, c.volume_l, 0) * q, 0)::text || ' L';
    if q <= 50 then recap := recap || ' — ALERTE ≤ 50 bar'; end if;
    return json_build_object('ok', true, 'kind', 'unite', 'action', 'emporter',
      'unite', public._stock_unite_json(u, c, l), 'message', recap, 'alerte_pression', (q <= 50));
  end if;

  select m.id into deja from public.stock_mouvements m
    where m.souhait_id = p_souhait and m.unite_id = u.id and m.type = 'emport' limit 1;
  if deja is not null then
    return json_build_object('ok', true, 'kind', 'unite', 'action', 'emporter', 'deja', true,
      'unite', public._stock_unite_json(u, c, l),
      'message', c.nom || ' — déjà scanné');
  end if;
  insert into public.stock_mouvements(type, quantite, motif, par, unite_id, lieu_id, souhait_id, catalogue_id)
    values ('emport', 1, 'emporté en mission', auth.uid(), u.id, u.lieu_id, p_souhait, c.id);
  return json_build_object('ok', true, 'kind', 'unite', 'action', 'emporter',
    'unite', public._stock_unite_json(u, c, l),
    'message', c.nom || ' emporté');
end $$;
grant execute on function public.stock_emporter(text, uuid, numeric) to authenticated;
