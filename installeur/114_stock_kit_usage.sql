-- ════════════════════════════════════════════════════════════════════════════
--  QR sur le sac, la pochette et le kit. Pas un QR par consommable.
--  Le scan d'un emplacement ne montre que ce qui y est rangé directement.
--  La prise de service d'un sac : scellé ou non, et la première péremption.
--  Idempotent. Après 113_activites_secours_dispositif.sql.
-- ════════════════════════════════════════════════════════════════════════════

comment on column public.stock_lieux.type is
  'reserve | armoire | sac | pochette | kit | vehicule | armoire_vehicule | autre';

-- ── Contenu direct d'un QR de lieu ─────────────────────────────────────────
create or replace function public.stock_contenu_direct(p_token text)
returns json language plpgsql stable security definer set search_path = public as $$
declare
  tok text := trim(coalesce(p_token, ''));
  l public.stock_lieux;
  items json;
  premiere date;
begin
  if not public.is_staff() then
    return json_build_object('ok', false, 'error', 'interdit');
  end if;
  if tok = '' then
    return json_build_object('ok', false, 'error', 'QR vide');
  end if;
  if tok not like 'ha:l:%' then
    return json_build_object('ok', false, 'error', 'pas_un_lieu');
  end if;
  select * into l from public.stock_lieux where qr_token = tok and actif;
  if not found then
    return json_build_object('ok', false, 'error', 'lieu inconnu');
  end if;

  select coalesce(json_agg(row_to_json(x) order by x.nom, x.date_peremption nulls last, x.lot), '[]'::json)
    into items
  from (
    select u.id, c.nom, c.mode, c.unite, u.lot, u.date_peremption,
           u.qte_restante, u.qte_initiale,
           (u.date_peremption is not null and u.date_peremption < current_date) as perime
    from public.stock_unites u
    join public.stock_catalogue c on c.id = u.catalogue_id
    where u.lieu_id = l.id
      and u.etat = 'dispo'
      and u.qte_restante > 0
      and c.mode <> 'oxygene'
  ) x;

  -- Date la plus proche dans tout le sac (pochettes et kits compris).
  -- Sert à proposer la première péremption à la prise de service.
  select min(u.date_peremption) into premiere
  from public.stock_unites u
  where u.lieu_id in (select d.id from public.stock_lieu_descendants(l.id) d)
    and u.etat = 'dispo'
    and u.qte_restante > 0
    and u.date_peremption is not null;

  return json_build_object(
    'ok', true,
    'kind', 'lieu',
    'lieu', json_build_object(
      'id', l.id, 'nom', l.nom, 'type', l.type,
      'qr_token', l.qr_token, 'parent_id', l.parent_id
    ),
    'items', items,
    'premiere_peremption', premiere
  );
end $$;
grant execute on function public.stock_contenu_direct(text) to authenticated;

-- ── Utilisation : quantités plafonnées à cet emplacement ───────────────────
create or replace function public.stock_utiliser_emplacement(
  p_token text,
  p_souhait uuid,
  p_lignes jsonb
)
returns json language plpgsql security definer set search_path = public as $$
declare
  tok text := trim(coalesce(p_token, ''));
  l public.stock_lieux;
  rec record;
  u public.stock_unites;
  c public.stock_catalogue;
  q numeric;
  reste numeric;
  n int := 0;
  msgs text := '';
  pret jsonb := '[]'::jsonb;
  act jsonb;
  i int;
begin
  if not public.is_staff() then
    return json_build_object('ok', false, 'error', 'interdit');
  end if;
  if p_souhait is not null and not public._sur_mission_stock(p_souhait) then
    return json_build_object('ok', false, 'error', 'vous n''êtes pas sur cette mission');
  end if;
  if tok not like 'ha:l:%' then
    return json_build_object('ok', false, 'error', 'scannez le sac, la pochette ou le kit');
  end if;
  select * into l from public.stock_lieux where qr_token = tok and actif;
  if not found then
    return json_build_object('ok', false, 'error', 'lieu inconnu');
  end if;
  if l.type not in ('sac', 'pochette', 'kit') then
    return json_build_object('ok', false, 'error', 'ce QR n''est pas un sac, une pochette ou un kit');
  end if;
  if jsonb_typeof(p_lignes) is distinct from 'array' or jsonb_array_length(p_lignes) = 0 then
    return json_build_object('ok', false, 'error', 'cochez au moins un article');
  end if;

  for rec in
    select (x->>'unite_id')::uuid as unite_id,
           sum((x->>'qte')::numeric) as qte
    from jsonb_array_elements(p_lignes) x
    where nullif(x->>'unite_id', '') is not null
    group by 1
  loop
    q := rec.qte;
    if q is null or q <= 0 then
      continue;
    end if;
    select * into u from public.stock_unites where id = rec.unite_id for update;
    if not found or u.lieu_id is distinct from l.id then
      return json_build_object('ok', false, 'error', 'cet article n''est pas dans cet emplacement');
    end if;
    select * into c from public.stock_catalogue where id = u.catalogue_id;
    if c.mode = 'oxygene' then
      return json_build_object('ok', false, 'error', 'une bouteille d''oxygène se scanne une à une');
    end if;
    if u.etat in ('vide', 'consomme', 'perdu') or u.qte_restante <= 0 then
      return json_build_object('ok', false, 'error', c.nom || ' : plus rien dans cet emplacement');
    end if;
    if u.date_peremption is not null and u.date_peremption < current_date then
      return json_build_object('ok', false, 'error', c.nom || ' est périmé — ne pas utiliser');
    end if;
    if c.mode = 'durable' then
      pret := pret || jsonb_build_array(jsonb_build_object(
        'id', u.id, 'catalogue_id', c.id, 'nom', c.nom, 'mode', 'durable', 'qte', 1
      ));
      continue;
    end if;
    if q > u.qte_restante then
      return json_build_object('ok', false,
        'error', c.nom || ' : il n''y en a que ' || trim(to_char(u.qte_restante, 'FM999999990.999')) || ' dans cet emplacement');
    end if;
    pret := pret || jsonb_build_array(jsonb_build_object(
      'id', u.id, 'catalogue_id', c.id, 'nom', c.nom, 'mode', c.mode, 'qte', q
    ));
  end loop;

  if jsonb_array_length(pret) = 0 then
    return json_build_object('ok', false, 'error', 'cochez au moins un article');
  end if;

  for i in 0 .. jsonb_array_length(pret) - 1 loop
    act := pret -> i;
    q := (act->>'qte')::numeric;
    if act->>'mode' = 'durable' then
      insert into public.stock_mouvements(type, quantite, motif, par, unite_id, lieu_id, souhait_id, catalogue_id)
        values ('usage', 1, 'utilisé en mission (durable)', auth.uid(), (act->>'id')::uuid, l.id, p_souhait, (act->>'catalogue_id')::uuid);
      msgs := msgs || (act->>'nom') || ' — reste en place. ';
    else
      update public.stock_unites
        set qte_restante = qte_restante - q,
            etat = case
              when qte_restante - q <= 0 then (case when act->>'mode' = 'boite' then 'vide' else 'consomme' end)
              else 'dispo' end
        where id = (act->>'id')::uuid
        returning qte_restante into reste;
      insert into public.stock_mouvements(type, quantite, motif, par, unite_id, lieu_id, souhait_id, catalogue_id)
        values ('sortie', q, 'conso mission', auth.uid(), (act->>'id')::uuid, l.id, p_souhait, (act->>'catalogue_id')::uuid);
      msgs := msgs || (act->>'nom') || ' −' || trim(to_char(q, 'FM999999990.999'))
        || ' · reste ' || trim(to_char(reste, 'FM999999990.999')) || '. ';
    end if;
    n := n + 1;
  end loop;

  return json_build_object('ok', true, 'message', trim(msgs), 'n', n);
end $$;
grant execute on function public.stock_utiliser_emplacement(text, uuid, jsonb) to authenticated;

-- ── Prise de service : sac scellé ou non, première péremption ──────────────
create table if not exists public.stock_prises_service (
  id                   uuid primary key default gen_random_uuid(),
  lieu_id              uuid not null references public.stock_lieux(id) on delete cascade,
  souhait_id           uuid not null references public.souhaits(id) on delete cascade,
  par                  uuid not null,
  scelle               boolean not null,
  premiere_peremption  date not null,
  created_at           timestamptz not null default now(),
  constraint stock_prises_service_un unique (souhait_id, lieu_id)
);

alter table public.stock_prises_service enable row level security;
drop policy if exists stock_prises_read on public.stock_prises_service;
create policy stock_prises_read on public.stock_prises_service
  for select to authenticated
  using (public.is_staff());

grant select on public.stock_prises_service to authenticated, service_role;
revoke all on public.stock_prises_service from anon;

create or replace function public.stock_prise_service(
  p_token text,
  p_souhait uuid,
  p_scelle boolean,
  p_date date
)
returns json language plpgsql security definer set search_path = public as $$
declare
  tok text := trim(coalesce(p_token, ''));
  l public.stock_lieux;
  connue date;
begin
  if not public.is_staff() then
    return json_build_object('ok', false, 'error', 'interdit');
  end if;
  if not public._sur_mission_stock(p_souhait) then
    return json_build_object('ok', false, 'error', 'vous n''êtes pas sur cette mission');
  end if;
  if p_scelle is null then
    return json_build_object('ok', false, 'error', 'indiquez si le sac est scellé');
  end if;
  if p_date is null then
    return json_build_object('ok', false, 'error', 'indiquez la date de la première péremption');
  end if;
  if tok not like 'ha:l:%' then
    return json_build_object('ok', false, 'error', 'scannez le sac');
  end if;
  select * into l from public.stock_lieux where qr_token = tok and actif;
  if not found then
    return json_build_object('ok', false, 'error', 'lieu inconnu');
  end if;
  if l.type <> 'sac' then
    return json_build_object('ok', false, 'error', 'la prise de service se fait sur le sac');
  end if;

  select min(u.date_peremption) into connue
  from public.stock_unites u
  where u.lieu_id in (select d.id from public.stock_lieu_descendants(l.id) d)
    and u.etat = 'dispo'
    and u.qte_restante > 0
    and u.date_peremption is not null;

  insert into public.stock_prises_service(lieu_id, souhait_id, par, scelle, premiere_peremption)
    values (l.id, p_souhait, auth.uid(), p_scelle, p_date)
  on conflict (souhait_id, lieu_id) do update
    set scelle = excluded.scelle,
        premiere_peremption = excluded.premiere_peremption,
        par = excluded.par,
        created_at = now();

  return json_build_object(
    'ok', true,
    'lieu', json_build_object('id', l.id, 'nom', l.nom, 'type', l.type),
    'scelle', p_scelle,
    'premiere_peremption', p_date,
    'connue', connue,
    'message', l.nom || ' — ' || case when p_scelle then 'scellé' else 'non scellé' end
      || ' · première péremption ' || to_char(p_date, 'DD/MM/YYYY')
  );
end $$;
grant execute on function public.stock_prise_service(text, uuid, boolean, date) to authenticated;

-- Le kit part comme un sac ou une pochette, sans ouvrir son contenu.
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
    if l.type not in ('sac', 'pochette', 'kit') then
      return json_build_object('ok', false, 'error', 'ce QR n''est pas un sac, une pochette ou un kit');
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
      values ('emport', 1, 'emporté', auth.uid(), l.id, p_souhait);
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
  prises json;
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

  select coalesce(json_agg(json_build_object(
      'lieu_id', p.lieu_id,
      'scelle', p.scelle,
      'premiere_peremption', p.premiere_peremption
    )), '[]'::json)
    into prises
  from public.stock_prises_service p
  where p.souhait_id = p_souhait;

  select coalesce(s.mission->'materiel_requis', '[]'::jsonb) into requis
    from public.souhaits s where s.id = p_souhait;

  return json_build_object(
    'ok', true, 'sacs', sacs, 'unites', unites,
    'prises', coalesce(prises, '[]'::json),
    'materiel_requis', coalesce(requis, '[]'::json)
  );
end $$;
grant execute on function public.stock_emports_souhait(uuid) to authenticated;

notify pgrst, 'reload schema';
