-- ════════════════════════════════════════════════════════════════════════════
--  En mission, l'équipage ne voit pas les lots ni les dates.
--  Il note ce qui a été utilisé. La logistique refait ensuite la pochette
--  ou le kit. Le stock continue de sortir le lot le plus proche.
--  Idempotent. Après 114_stock_kit_usage.sql.
-- ════════════════════════════════════════════════════════════════════════════

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

  select coalesce(json_agg(row_to_json(x) order by x.nom), '[]'::json)
    into items
  from (
    select c.id, c.id as catalogue_id, c.nom, c.mode, c.unite,
           sum(u.qte_restante) as qte_restante
    from public.stock_unites u
    join public.stock_catalogue c on c.id = u.catalogue_id
    where u.lieu_id = l.id
      and u.etat = 'dispo'
      and u.qte_restante > 0
      and c.mode <> 'oxygene'
      and (u.date_peremption is null or u.date_peremption >= current_date)
    group by c.id, c.nom, c.mode, c.unite
  ) x;

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

create table if not exists public.stock_refections (
  id            uuid primary key default gen_random_uuid(),
  lieu_id       uuid not null references public.stock_lieux(id) on delete cascade,
  souhait_id    uuid references public.souhaits(id) on delete set null,
  catalogue_id  uuid not null references public.stock_catalogue(id) on delete restrict,
  quantite      numeric not null check (quantite > 0),
  par           uuid,
  created_at    timestamptz not null default now(),
  refait_le     timestamptz,
  refait_par    uuid
);
create index if not exists stock_refections_ouvert_idx
  on public.stock_refections (lieu_id) where refait_le is null;

alter table public.stock_refections enable row level security;
drop policy if exists stock_refections_read on public.stock_refections;
create policy stock_refections_read on public.stock_refections
  for select to authenticated
  using (public.peut_gerer_stock());

grant select on public.stock_refections to authenticated, service_role;
revoke all on public.stock_refections from anon;

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
  dispo numeric;
  prise numeric;
  reste numeric;
  a_prendre numeric;
  n int := 0;
  msgs text := '';
  pret jsonb := '[]'::jsonb;
  demande jsonb := '[]'::jsonb;
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
    select coalesce(nullif(x->>'catalogue_id', ''), nullif(x->>'id', ''))::uuid as catalogue_id,
           sum((x->>'qte')::numeric) as qte
    from jsonb_array_elements(p_lignes) x
    where coalesce(nullif(x->>'catalogue_id', ''), nullif(x->>'id', '')) is not null
    group by 1
  loop
    q := rec.qte;
    if q is null or q <= 0 then
      continue;
    end if;
    select * into c from public.stock_catalogue where id = rec.catalogue_id;
    if not found or c.mode = 'oxygene' then
      return json_build_object('ok', false, 'error', 'cet article n''est pas dans cet emplacement');
    end if;
    select coalesce(sum(u2.qte_restante), 0) into dispo
    from public.stock_unites u2
    where u2.lieu_id = l.id
      and u2.catalogue_id = c.id
      and u2.etat = 'dispo'
      and u2.qte_restante > 0
      and (u2.date_peremption is null or u2.date_peremption >= current_date);
    if dispo <= 0 then
      return json_build_object('ok', false, 'error', c.nom || ' : plus rien dans cet emplacement');
    end if;
    if c.mode = 'durable' then
      q := 1;
    elsif q > dispo then
      return json_build_object('ok', false,
        'error', c.nom || ' : il n''y en a que ' || trim(to_char(dispo, 'FM999999990.999')) || ' dans cet emplacement');
    end if;
    demande := demande || jsonb_build_array(jsonb_build_object(
      'catalogue_id', c.id, 'nom', c.nom, 'qte', q
    ));
    a_prendre := q;
    for u in
      select un.* from public.stock_unites un
      where un.lieu_id = l.id
        and un.catalogue_id = c.id
        and un.etat = 'dispo'
        and un.qte_restante > 0
        and (un.date_peremption is null or un.date_peremption >= current_date)
      order by un.date_peremption nulls last, un.id
      for update of un
    loop
      exit when a_prendre <= 0;
      prise := least(u.qte_restante, a_prendre);
      pret := pret || jsonb_build_array(jsonb_build_object(
        'id', u.id, 'catalogue_id', c.id, 'nom', c.nom, 'mode', c.mode, 'qte', prise
      ));
      a_prendre := a_prendre - prise;
      if c.mode = 'durable' then
        exit;
      end if;
    end loop;
    if a_prendre > 0 then
      return json_build_object('ok', false, 'error', c.nom || ' : plus rien dans cet emplacement');
    end if;
  end loop;

  if jsonb_array_length(pret) = 0 then
    return json_build_object('ok', false, 'error', 'cochez au moins un article');
  end if;

  for i in 0 .. jsonb_array_length(pret) - 1 loop
    act := pret -> i;
    q := (act->>'qte')::numeric;
    if act->>'mode' = 'durable' then
      insert into public.stock_mouvements(type, quantite, motif, par, unite_id, lieu_id, souhait_id, catalogue_id)
        values ('usage', 1, 'utilisé en mission', auth.uid(), (act->>'id')::uuid, l.id, p_souhait, (act->>'catalogue_id')::uuid);
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
    end if;
  end loop;

  for i in 0 .. jsonb_array_length(demande) - 1 loop
    act := demande -> i;
    msgs := msgs || (act->>'nom') || ' −' || trim(to_char((act->>'qte')::numeric, 'FM999999990.999')) || '. ';
    n := n + 1;
    if l.type in ('pochette', 'kit') then
      insert into public.stock_refections(lieu_id, souhait_id, catalogue_id, quantite, par)
        values (l.id, p_souhait, (act->>'catalogue_id')::uuid, (act->>'qte')::numeric, auth.uid());
    end if;
  end loop;

  return json_build_object('ok', true, 'message', trim(msgs), 'n', n);
end $$;
grant execute on function public.stock_utiliser_emplacement(text, uuid, jsonb) to authenticated;

create or replace function public.stock_a_refaire()
returns json language plpgsql stable security definer set search_path = public as $$
declare
  items json;
begin
  if not public.peut_gerer_stock() then
    return json_build_object('ok', false, 'error', 'réservé à la logistique');
  end if;
  select coalesce(json_agg(row_to_json(x) order by x.depuis), '[]'::json)
    into items
  from (
    select l.id as lieu_id, l.nom, l.type, parent.nom as parent_nom,
           d.depuis,
           json_agg(json_build_object('nom', c.nom, 'quantite', t.quantite) order by c.nom) as lignes
    from (
      select lieu_id, catalogue_id, sum(quantite) as quantite
      from public.stock_refections
      where refait_le is null
      group by lieu_id, catalogue_id
    ) t
    join public.stock_lieux l on l.id = t.lieu_id
    left join public.stock_lieux parent on parent.id = l.parent_id
    join public.stock_catalogue c on c.id = t.catalogue_id
    join (
      select lieu_id, min(created_at) as depuis
      from public.stock_refections
      where refait_le is null
      group by lieu_id
    ) d on d.lieu_id = l.id
    group by l.id, l.nom, l.type, parent.nom, d.depuis
  ) x;
  return json_build_object('ok', true, 'items', items);
end $$;
grant execute on function public.stock_a_refaire() to authenticated;

create or replace function public.stock_marquer_refait(p_lieu uuid)
returns json language plpgsql security definer set search_path = public as $$
declare
  n int;
  l public.stock_lieux;
begin
  if not public.peut_gerer_stock() then
    return json_build_object('ok', false, 'error', 'réservé à la logistique');
  end if;
  select * into l from public.stock_lieux where id = p_lieu;
  if not found then
    return json_build_object('ok', false, 'error', 'lieu inconnu');
  end if;
  update public.stock_refections
    set refait_le = now(), refait_par = auth.uid()
    where lieu_id = p_lieu and refait_le is null;
  get diagnostics n = row_count;
  if n = 0 then
    return json_build_object('ok', false, 'error', 'rien à refaire ici');
  end if;
  return json_build_object('ok', true, 'message', l.nom || ' est marqué refait', 'n', n);
end $$;
grant execute on function public.stock_marquer_refait(uuid) to authenticated;

notify pgrst, 'reload schema';
