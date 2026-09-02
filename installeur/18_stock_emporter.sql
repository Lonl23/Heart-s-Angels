-- ════════════════════════════════════════════════════════════════════════════
--  Emport mission : scanner O₂ et sacs au départ (sans consommer).
--  Idempotent. Après 17_stock_oxygene.sql.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public._sur_mission_stock(p_souhait uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_souhait is not null and (
    public.peut_gerer_stock()
    or exists (
      select 1 from public.souhait_personnel sp
      where sp.souhait_id = p_souhait and sp.user_id = auth.uid()
    )
  )
$$;

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
begin
  if not public.is_staff() then
    return json_build_object('ok', false, 'error', 'interdit');
  end if;
  if not public._sur_mission_stock(p_souhait) then
    return json_build_object('ok', false, 'error', 'vous n''êtes pas sur cette mission');
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

create or replace function public.stock_emports_souhait(p_souhait uuid)
returns json language plpgsql stable security definer set search_path = public as $$
declare
  sacs json;
  unites json;
  requis json;
begin
  if not public._sur_mission_stock(p_souhait) then
    return json_build_object('ok', false, 'error', 'interdit');
  end if;
  select coalesce(json_agg(json_build_object(
      'id', l.id, 'nom', l.nom, 'type', l.type, 'qr_token', l.qr_token, 'at', m.created_at
    ) order by m.created_at), '[]'::json)
    into sacs
  from public.stock_mouvements m
  join public.stock_lieux l on l.id = m.lieu_id
  where m.souhait_id = p_souhait and m.type = 'emport' and m.unite_id is null;

  select coalesce(json_agg(json_build_object(
      'id', u.id, 'qr_token', u.qr_token, 'nom', c.nom, 'mode', c.mode,
      'catalogue_id', c.id, 'lot', u.lot,
      'volume_l', coalesce(u.volume_l, c.volume_l),
      'pression_bar', u.pression_bar,
      'motif', m.motif, 'at', m.created_at
    ) order by m.created_at), '[]'::json)
    into unites
  from public.stock_mouvements m
  join public.stock_unites u on u.id = m.unite_id
  join public.stock_catalogue c on c.id = u.catalogue_id
  where m.souhait_id = p_souhait and m.type = 'emport' and m.unite_id is not null;

  select coalesce(s.mission->'materiel_requis', '[]'::jsonb) into requis
    from public.souhaits s where s.id = p_souhait;

  return json_build_object('ok', true, 'sacs', sacs, 'unites', unites, 'materiel_requis', coalesce(requis, '[]'::json));
end $$;
grant execute on function public.stock_emports_souhait(uuid) to authenticated;

notify pgrst, 'reload schema';
