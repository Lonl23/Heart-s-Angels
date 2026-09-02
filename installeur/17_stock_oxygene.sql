-- ════════════════════════════════════════════════════════════════════════════
--  Oxygène : bouteilles 2 / 5 / 10 L, une à une, 200 bar à la livraison.
--  Capacité ≈ volume × pression. Alerte DLC ou pression ≤ 50 bar.
--  Idempotent. Après 16_stock_qr.sql.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.stock_catalogue
  add column if not exists volume_l numeric;
alter table public.stock_unites
  add column if not exists volume_l numeric,
  add column if not exists pression_bar numeric,
  add column if not exists pression_pleine numeric default 200;

create or replace function public._stock_unite_json(
  u public.stock_unites, c public.stock_catalogue, l public.stock_lieux
)
returns json language sql stable as $$
  select json_build_object(
    'id', u.id, 'qr_token', u.qr_token, 'lot', u.lot,
    'date_peremption', u.date_peremption,
    'qte_initiale', u.qte_initiale, 'qte_restante', u.qte_restante,
    'etat', u.etat, 'lieu_id', u.lieu_id,
    'nom', c.nom, 'mode', c.mode, 'unite', c.unite, 'categorie', c.categorie,
    'catalogue_id', c.id,
    'lieu_nom', l.nom,
    'volume_l', coalesce(u.volume_l, c.volume_l),
    'pression_bar', u.pression_bar,
    'pression_pleine', coalesce(u.pression_pleine, 200),
    'capacite_l', round(coalesce(u.volume_l, c.volume_l, 0) * coalesce(u.pression_bar, 0), 1)
  )
$$;

drop function if exists public.stock_creer_unite(uuid, numeric, text, date, uuid, text);
create or replace function public.stock_creer_unite(
  p_catalogue uuid,
  p_qte numeric,
  p_lot text default null,
  p_dlc date default null,
  p_lieu uuid default null,
  p_notes text default null,
  p_pression numeric default 200
)
returns json language plpgsql security definer set search_path = public as $$
declare
  c public.stock_catalogue;
  n numeric;
  u public.stock_unites;
  l public.stock_lieux;
  vol numeric;
  pres numeric;
begin
  if not public.peut_gerer_stock() then
    return json_build_object('ok', false, 'error', 'réservé à la logistique');
  end if;
  select * into c from public.stock_catalogue where id = p_catalogue and actif;
  if not found then return json_build_object('ok', false, 'error', 'type inconnu'); end if;
  if c.mode = 'boite' then
    n := coalesce(nullif(p_qte, 0), c.qte_defaut);
    if n is null or n <= 0 then
      return json_build_object('ok', false, 'error', 'indiquez combien il y a dans la boîte');
    end if;
  else
    n := 1;
  end if;
  vol := case when c.mode = 'oxygene' then c.volume_l else null end;
  if c.mode = 'oxygene' and (vol is null or vol <= 0) then
    return json_build_object('ok', false, 'error', 'volume de la bouteille manquant (2, 5 ou 10 L)');
  end if;
  pres := case when c.mode = 'oxygene' then coalesce(nullif(p_pression, 0), 200) else null end;
  insert into public.stock_unites(
    catalogue_id, lot, date_peremption, qte_initiale, qte_restante, lieu_id, notes,
    volume_l, pression_bar, pression_pleine
  )
    values (c.id, nullif(p_lot, ''), p_dlc, n, n, p_lieu, p_notes, vol, pres, coalesce(pres, 200))
    returning * into u;
  insert into public.stock_mouvements(type, quantite, motif, par, unite_id, lieu_id, catalogue_id)
    values ('entree', coalesce(pres, n), case when c.mode = 'oxygene' then 'réception bouteille' else 'réception' end, auth.uid(), u.id, p_lieu, c.id);
  select * into l from public.stock_lieux where id = u.lieu_id;
  return json_build_object('ok', true, 'unite', public._stock_unite_json(u, c, l));
end $$;
grant execute on function public.stock_creer_unite(uuid, numeric, text, date, uuid, text, numeric) to authenticated;

create or replace function public.stock_scan(
  p_token text,
  p_action text default 'lire',
  p_qte numeric default 1,
  p_souhait uuid default null,
  p_lieu uuid default null
)
returns json language plpgsql security definer set search_path = public as $$
declare
  tok text := trim(coalesce(p_token, ''));
  u public.stock_unites;
  c public.stock_catalogue;
  l public.stock_lieux;
  q numeric := coalesce(p_qte, 1);
  reste numeric;
  recap text;
  avant numeric;
begin
  if not public.is_staff() then
    return json_build_object('ok', false, 'error', 'interdit');
  end if;
  if tok = '' then
    return json_build_object('ok', false, 'error', 'QR vide');
  end if;

  if tok like 'ha:l:%' then
    select * into l from public.stock_lieux where qr_token = tok and actif;
    if not found then return json_build_object('ok', false, 'error', 'lieu inconnu'); end if;
    if p_action = 'inventaire' then
      return public.stock_inventaire(l.id);
    end if;
    return json_build_object('ok', true, 'kind', 'lieu', 'lieu', json_build_object(
      'id', l.id, 'nom', l.nom, 'type', l.type, 'qr_token', l.qr_token, 'parent_id', l.parent_id
    ));
  end if;

  if tok not like 'ha:u:%' then
    return json_build_object('ok', false, 'error', 'QR non reconnu');
  end if;
  select * into u from public.stock_unites where qr_token = tok;
  if not found then return json_build_object('ok', false, 'error', 'article inconnu'); end if;
  select * into c from public.stock_catalogue where id = u.catalogue_id;
  select * into l from public.stock_lieux where id = u.lieu_id;

  if p_action = 'lire' then
    return json_build_object('ok', true, 'kind', 'unite',
      'unite', public._stock_unite_json(u, c, l));
  end if;

  if p_action = 'ranger' then
    if not public.peut_gerer_stock() then
      return json_build_object('ok', false, 'error', 'réservé à la logistique');
    end if;
    if p_lieu is null then
      return json_build_object('ok', false, 'error', 'scannez d''abord le lieu');
    end if;
    update public.stock_unites set lieu_id = p_lieu where id = u.id;
    insert into public.stock_mouvements(type, quantite, motif, par, unite_id, lieu_id, catalogue_id)
      values ('transfert', coalesce(u.qte_restante, 1), 'rangement', auth.uid(), u.id, p_lieu, c.id);
    select * into u from public.stock_unites where id = u.id;
    select * into l from public.stock_lieux where id = u.lieu_id;
    return json_build_object('ok', true, 'kind', 'unite', 'action', 'ranger',
      'unite', public._stock_unite_json(u, c, l));
  end if;

  if p_action = 'consommer' then
    if p_souhait is not null and not (
      public.peut_gerer_stock()
      or exists (select 1 from public.souhait_personnel sp where sp.souhait_id = p_souhait and sp.user_id = auth.uid())
    ) then
      return json_build_object('ok', false, 'error', 'vous n''êtes pas sur cette mission');
    end if;
    if u.etat = 'perdu' then
      return json_build_object('ok', false, 'error', 'article marqué perdu');
    end if;

    if c.mode = 'oxygene' then
      if u.date_peremption is not null and u.date_peremption < current_date then
        return json_build_object('ok', false, 'error', 'bouteille périmée — ne pas utiliser',
          'unite', public._stock_unite_json(u, c, l));
      end if;
      if q < 0 or q > coalesce(u.pression_pleine, 200) then
        return json_build_object('ok', false, 'error', 'pression invalide (0–' || coalesce(u.pression_pleine, 200)::text || ' bar)');
      end if;
      avant := coalesce(u.pression_bar, 0);
      update public.stock_unites set pression_bar = q where id = u.id;
      insert into public.stock_mouvements(type, quantite, motif, par, unite_id, lieu_id, souhait_id, catalogue_id)
        values ('releve_o2', q, 'reste ' || q::text || ' bar (avant ' || avant::text || ')', auth.uid(), u.id, u.lieu_id, p_souhait, c.id);
      select * into u from public.stock_unites where id = u.id;
      recap := c.nom || ' ' || coalesce(u.volume_l, c.volume_l)::text || ' L · reste '
        || q::text || ' bar · ' || round(coalesce(u.volume_l, c.volume_l, 0) * q, 0)::text || ' L';
      if q <= 50 then
        recap := recap || ' — ALERTE ≤ 50 bar';
      end if;
      return json_build_object('ok', true, 'kind', 'unite', 'action', 'oxygene',
        'unite', public._stock_unite_json(u, c, l), 'message', recap, 'alerte_pression', (q <= 50));
    end if;

    if c.mode = 'durable' then
      insert into public.stock_mouvements(type, quantite, motif, par, unite_id, lieu_id, souhait_id, catalogue_id)
        values ('usage', 1, 'utilisé en mission (durable)', auth.uid(), u.id, u.lieu_id, p_souhait, c.id);
      return json_build_object('ok', true, 'kind', 'unite', 'action', 'usage',
        'unite', public._stock_unite_json(u, c, l),
        'message', c.nom || ' — reste dans son emplacement');
    end if;
    if u.etat in ('vide','consomme') or u.qte_restante <= 0 then
      return json_build_object('ok', false, 'error', 'boîte / article vide');
    end if;
    if u.date_peremption is not null and u.date_peremption < current_date then
      return json_build_object('ok', false, 'error', 'périmé — ne pas utiliser',
        'unite', public._stock_unite_json(u, c, l));
    end if;
    q := greatest(q, 0);
    if q > u.qte_restante then
      return json_build_object('ok', false, 'error', 'il ne reste que ' || u.qte_restante::text,
        'unite', public._stock_unite_json(u, c, l));
    end if;
    reste := u.qte_restante - q;
    update public.stock_unites
      set qte_restante = reste,
          etat = case when reste <= 0 then (case when c.mode = 'boite' then 'vide' else 'consomme' end) else 'dispo' end
      where id = u.id;
    insert into public.stock_mouvements(type, quantite, motif, par, unite_id, lieu_id, souhait_id, catalogue_id)
      values ('sortie', q, 'conso mission', auth.uid(), u.id, u.lieu_id, p_souhait, c.id);
    select * into u from public.stock_unites where id = u.id;
    recap := c.nom || ' −' || q::text || ' · reste ' || u.qte_restante::text
      || case when c.mode = 'boite' then '/' || u.qte_initiale::text else '' end;
    return json_build_object('ok', true, 'kind', 'unite', 'action', 'consommer',
      'unite', public._stock_unite_json(u, c, l), 'message', recap);
  end if;

  if p_action = 'ajuster' then
    if not public.peut_gerer_stock() then
      return json_build_object('ok', false, 'error', 'réservé à la logistique');
    end if;
    if q < 0 then return json_build_object('ok', false, 'error', 'quantité invalide'); end if;
    if c.mode = 'oxygene' then
      if q > coalesce(u.pression_pleine, 200) then
        return json_build_object('ok', false, 'error', 'pression trop élevée');
      end if;
      update public.stock_unites set pression_bar = q where id = u.id;
      insert into public.stock_mouvements(type, quantite, motif, par, unite_id, lieu_id, catalogue_id)
        values ('ajustement', q, 'relevé pression', auth.uid(), u.id, u.lieu_id, c.id);
    else
      update public.stock_unites
        set qte_restante = q,
            etat = case when q <= 0 then (case when c.mode = 'boite' then 'vide' else 'consomme' end) else 'dispo' end
        where id = u.id;
      insert into public.stock_mouvements(type, quantite, motif, par, unite_id, lieu_id, catalogue_id)
        values ('ajustement', q, 'inventaire', auth.uid(), u.id, u.lieu_id, c.id);
    end if;
    select * into u from public.stock_unites where id = u.id;
    return json_build_object('ok', true, 'kind', 'unite', 'action', 'ajuster',
      'unite', public._stock_unite_json(u, c, l));
  end if;

  return json_build_object('ok', false, 'error', 'action inconnue');
end $$;
grant execute on function public.stock_scan(text, text, numeric, uuid, uuid) to authenticated;

create or replace function public.stock_alertes()
returns json language plpgsql stable security definer set search_path = public as $$
declare
  perimes json;
  proches json;
  vides json;
  bas json;
  o2 json;
begin
  if not public.peut_gerer_stock() then
    return json_build_object('ok', false, 'error', 'réservé à la logistique');
  end if;
  select coalesce(json_agg(public._stock_unite_json(u, c, l)), '[]'::json) into perimes
  from public.stock_unites u
  join public.stock_catalogue c on c.id = u.catalogue_id
  left join public.stock_lieux l on l.id = u.lieu_id
  where u.etat = 'dispo'
    and u.date_peremption is not null and u.date_peremption < current_date;
  select coalesce(json_agg(public._stock_unite_json(u, c, l)), '[]'::json) into proches
  from public.stock_unites u
  join public.stock_catalogue c on c.id = u.catalogue_id
  left join public.stock_lieux l on l.id = u.lieu_id
  where u.etat = 'dispo'
    and u.date_peremption is not null
    and u.date_peremption >= current_date
    and u.date_peremption <= current_date + 90;
  select coalesce(json_agg(public._stock_unite_json(u, c, l)), '[]'::json) into vides
  from public.stock_unites u
  join public.stock_catalogue c on c.id = u.catalogue_id
  left join public.stock_lieux l on l.id = u.lieu_id
  where u.etat in ('vide','consomme') or (c.mode = 'boite' and u.qte_restante > 0 and u.qte_restante <= 10);
  select coalesce(json_agg(json_build_object(
      'id', s.id, 'nom', s.nom, 'mode', s.mode, 'reste', s.reste, 'stock_minimal', s.stock_minimal
    )), '[]'::json) into bas
  from (
    select c.id, c.nom, c.mode, c.stock_minimal,
           coalesce(sum(u.qte_restante) filter (where u.etat = 'dispo'), 0) as reste
    from public.stock_catalogue c
    left join public.stock_unites u on u.catalogue_id = c.id
    where c.actif and c.stock_minimal > 0 and c.mode <> 'oxygene'
    group by c.id
    having coalesce(sum(u.qte_restante) filter (where u.etat = 'dispo'), 0) <= c.stock_minimal
  ) s;
  select coalesce(json_agg(public._stock_unite_json(u, c, l)), '[]'::json) into o2
  from public.stock_unites u
  join public.stock_catalogue c on c.id = u.catalogue_id
  left join public.stock_lieux l on l.id = u.lieu_id
  where u.etat = 'dispo' and c.mode = 'oxygene'
    and coalesce(u.pression_bar, 0) <= 50;
  return json_build_object('ok', true, 'perimes', perimes, 'proches', proches, 'vides', vides, 'bas', bas, 'o2_basse', o2);
end $$;
grant execute on function public.stock_alertes() to authenticated;

create or replace function public.stock_inventaire(p_lieu uuid)
returns json language plpgsql stable security definer set search_path = public as $$
declare
  lieu public.stock_lieux;
  items json;
begin
  if not public.peut_gerer_stock() then
    return json_build_object('ok', false, 'error', 'réservé à la logistique');
  end if;
  select * into lieu from public.stock_lieux where stock_lieux.id = p_lieu;
  if not found then return json_build_object('ok', false, 'error', 'lieu inconnu'); end if;
  select coalesce(json_agg(row_to_json(x) order by x.nom, x.created_at), '[]'::json)
    into items
  from (
    select u.id, u.qr_token, u.lot, u.date_peremption, u.qte_initiale, u.qte_restante,
           u.etat, u.lieu_id, u.created_at, u.volume_l, u.pression_bar, u.pression_pleine,
           c.nom, c.mode, c.unite, c.categorie,
           l.nom as lieu_nom
    from public.stock_unites u
    join public.stock_catalogue c on c.id = u.catalogue_id
    left join public.stock_lieux l on l.id = u.lieu_id
    where u.lieu_id in (select d.id from public.stock_lieu_descendants(p_lieu) d)
      and u.etat in ('dispo','vide')
  ) x;
  return json_build_object('ok', true, 'lieu', json_build_object(
    'id', lieu.id, 'nom', lieu.nom, 'type', lieu.type, 'qr_token', lieu.qr_token, 'parent_id', lieu.parent_id
  ), 'items', items);
end $$;
grant execute on function public.stock_inventaire(uuid) to authenticated;

create or replace function public.stock_conso_souhait(p_souhait uuid)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object('ok', true, 'items', coalesce((
    select json_agg(json_build_object(
      'nom', c.nom, 'mode', c.mode, 'quantite', m.quantite,
      'reste', u.qte_restante, 'initiale', u.qte_initiale,
      'lot', u.lot, 'type_mouv', m.type, 'quand', m.created_at,
      'volume_l', u.volume_l, 'pression_bar', u.pression_bar, 'motif', m.motif
    ) order by m.created_at)
    from public.stock_mouvements m
    join public.stock_unites u on u.id = m.unite_id
    join public.stock_catalogue c on c.id = coalesce(m.catalogue_id, u.catalogue_id)
    where m.souhait_id = p_souhait and m.type in ('sortie','usage','releve_o2')
  ), '[]'::json))
$$;
grant execute on function public.stock_conso_souhait(uuid) to authenticated;

create or replace function public.notifier_conso_souhait(p_souhait uuid)
returns json language plpgsql security definer set search_path = public as $$
declare
  lignes text;
  lieu_txt text;
  dest record;
begin
  select string_agg(
    case
      when c.mode = 'oxygene' then c.nom || ' ' || coalesce(u.volume_l, c.volume_l)::text || ' L · '
        || coalesce(u.pression_bar, m.quantite)::text || ' bar restants'
      when c.mode = 'boite' then c.nom || ' −' || m.quantite::text || ' (reste ' || u.qte_restante::text || '/' || u.qte_initiale::text || ')'
      else c.nom || ' −' || m.quantite::text
    end,
    E'\n' order by c.nom
  ), max(coalesce(s.localisation, s.mission->>'lieu', s.mission->>'activite', 'Mission'))
    into lignes, lieu_txt
  from public.stock_mouvements m
  join public.stock_unites u on u.id = m.unite_id
  join public.stock_catalogue c on c.id = m.catalogue_id
  join public.souhaits s on s.id = m.souhait_id
  where m.souhait_id = p_souhait and m.type in ('sortie','usage','releve_o2');
  if lignes is null then
    lignes := 'Aucune conso scannée.';
  end if;
  for dest in
    select p.id from public.profiles p
    where p.role::text in ('admin','president','coordinateur')
       or coalesce(p.fiche->'roles_asbl' ?| array[
            'resp_logistique','resp_logistique_adjoint','president','vice_president'
          ], false)
  loop
    insert into public.notifications(destinataire_id, type, titre, message, lien, priorite)
      values (dest.id, 'stock', 'Conso — ' || coalesce(lieu_txt, 'mission'),
              lignes, '/app/stock', 'normale');
  end loop;
  return json_build_object('ok', true, 'message', lignes);
end $$;
grant execute on function public.notifier_conso_souhait(uuid) to authenticated;

insert into public.stock_catalogue (nom, categorie, mode, unite, volume_l)
select v.nom, 'oxygène', 'oxygene', 'L', v.vol
from (values
  ('Oxygène 2 L', 2),
  ('Oxygène 5 L', 5),
  ('Oxygène 10 L', 10)
) as v(nom, vol)
where not exists (select 1 from public.stock_catalogue c where c.mode = 'oxygene' and c.volume_l = v.vol);

notify pgrst, 'reload schema';
