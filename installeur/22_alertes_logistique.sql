-- ════════════════════════════════════════════════════════════════════════════
--  Alertes stock par e-mail, uniquement responsable logistique et adjoint.
--    • mission réalisée : matériel utilisé
--    • oxygène ≤ 50 bar (dès que la pression passe sous le seuil, une fois)
--    • péremption à J-15, J-7 et le jour J
--  Idempotent. Après 21_statuts_terrain.sql.
--
--  L'envoi lui-même est fait par la fonction Edge alertes-stock (Resend).
--  Pour le courrier du matin sans ouvrir l'appli, enregistrer dans le Vault :
--    select vault.create_secret('https://xxxx.supabase.co', 'project_url');
--    select vault.create_secret('clé anon publique', 'anon_key');
--    select vault.create_secret('même valeur que le secret ALERTES_SECRET', 'alertes_secret');
--  Puis secrets de la fonction : RESEND_API_KEY, ALERTES_FROM, ALERTES_SECRET.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.alertes_mail (
  id               uuid primary key default gen_random_uuid(),
  cle              text not null,
  destinataire_id  uuid not null references public.profiles(id) on delete cascade,
  email            text not null,
  sujet            text not null,
  corps            text not null,
  cree_le          timestamptz not null default now(),
  prise_le         timestamptz,
  envoye_le        timestamptz,
  erreur           text,
  unique (cle, destinataire_id)
);
create index if not exists alertes_mail_a_envoyer_idx
  on public.alertes_mail (cree_le)
  where envoye_le is null;

create table if not exists public.alertes_deja (
  cle      text primary key,
  cree_le  timestamptz not null default now()
);

alter table public.alertes_mail enable row level security;
alter table public.alertes_deja enable row level security;
revoke all on public.alertes_mail from public, anon, authenticated;
revoke all on public.alertes_deja from public, anon, authenticated;
grant all on public.alertes_mail to service_role;
grant all on public.alertes_deja to service_role;

-- ── Destinataires : fiche ASBL, pas le rôle de connexion ───────────────────
create or replace function public.alerter_logistique(p_cle text, p_sujet text, p_corps text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  d record;
  n int := 0;
  ins int;
begin
  if p_cle is null or p_sujet is null or p_corps is null then
    return 0;
  end if;
  for d in
    select p.id, trim(p.email) as email
    from public.profiles p
    where coalesce(p.actif, true)
      and p.email is not null
      and length(trim(p.email)) > 3
      and coalesce(p.fiche, '{}'::jsonb)->'roles_asbl' ?| array['resp_logistique', 'resp_logistique_adjoint']
  loop
    insert into public.alertes_mail (cle, destinataire_id, email, sujet, corps)
    values (p_cle, d.id, d.email, p_sujet, p_corps)
    on conflict (cle, destinataire_id) do nothing;
    get diagnostics ins = row_count;
    if ins > 0 then
      n := n + ins;
      insert into public.notifications (destinataire_id, type, titre, message, lien, priorite)
      values (d.id, 'stock', p_sujet, p_corps, '/app/stock', 'haute');
    end if;
  end loop;
  return n;
end;
$$;
revoke all on function public.alerter_logistique(text, text, text) from public, anon, authenticated;
grant execute on function public.alerter_logistique(text, text, text) to service_role;

-- ── File d'envoi : prend les courriers encore en attente ───────────────────
create or replace function public.prendre_alertes_mail()
returns setof public.alertes_mail
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with pris as (
    select m.id
    from public.alertes_mail m
    where m.envoye_le is null
      and (m.prise_le is null or m.prise_le < now() - interval '15 minutes')
    order by m.cree_le
    limit 40
    for update skip locked
  )
  update public.alertes_mail m
     set prise_le = now()
    from pris
   where m.id = pris.id
  returning m.*;
end;
$$;
revoke all on function public.prendre_alertes_mail() from public, anon, authenticated;
grant execute on function public.prendre_alertes_mail() to service_role;

create or replace function public.marquer_alerte_mail(p_id uuid, p_erreur text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_erreur is null or btrim(p_erreur) = '' then
    update public.alertes_mail
       set envoye_le = now(), erreur = null
     where id = p_id;
  else
    update public.alertes_mail
       set erreur = left(p_erreur, 500), prise_le = null
     where id = p_id and envoye_le is null;
  end if;
end;
$$;
revoke all on function public.marquer_alerte_mail(uuid, text) from public, anon, authenticated;
grant execute on function public.marquer_alerte_mail(uuid, text) to service_role;

-- ── Appel de la fonction d'envoi, si le Vault est prêt ─────────────────────
create or replace function public.stock_ping_envoi()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  base text;
  secret text;
  anon text;
begin
  select decrypted_secret into base from vault.decrypted_secrets where name = 'project_url' limit 1;
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'alertes_secret' limit 1;
  select decrypted_secret into anon from vault.decrypted_secrets where name = 'anon_key' limit 1;
  if base is null or secret is null or anon is null then
    return;
  end if;
  perform net.http_post(
    url := rtrim(base, '/') || '/functions/v1/alertes-stock',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', anon,
      'Authorization', 'Bearer ' || anon,
      'x-alertes-secret', secret
    ),
    body := '{"action":"envoyer"}'::jsonb,
    timeout_milliseconds := 120000
  );
exception when others then
  -- La file reste en base : l'ouverture du stock ou le cron du matin reprendra.
  return;
end;
$$;
revoke all on function public.stock_ping_envoi() from public, anon, authenticated;
grant execute on function public.stock_ping_envoi() to service_role;

-- ── Mission réalisée : matériel utilisé ────────────────────────────────────
create or replace function public.notifier_conso_souhait(p_souhait uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  lignes text;
  lieu_txt text;
begin
  select string_agg(
    case
      when c.mode = 'oxygene' then c.nom || ' ' || coalesce(u.volume_l, c.volume_l)::text || ' L · '
        || coalesce(u.pression_bar, m.quantite)::text || ' bar restants'
      when c.mode = 'boite' then c.nom || ' −' || m.quantite::text
        || ' (reste ' || u.qte_restante::text || '/' || u.qte_initiale::text || ')'
      else c.nom || ' −' || m.quantite::text
    end,
    E'\n' order by c.nom
  ), max(coalesce(s.localisation, s.mission->>'lieu', s.mission->>'activite', 'Mission'))
    into lignes, lieu_txt
  from public.stock_mouvements m
  join public.stock_unites u on u.id = m.unite_id
  join public.stock_catalogue c on c.id = coalesce(m.catalogue_id, u.catalogue_id)
  join public.souhaits s on s.id = m.souhait_id
  where m.souhait_id = p_souhait and m.type in ('sortie', 'usage', 'releve_o2');
  if lignes is null then
    lignes := 'Aucune consommation scannée.';
  end if;
  perform public.alerter_logistique(
    'conso:' || p_souhait::text,
    'Mission réalisée — ' || coalesce(lieu_txt, 'mission'),
    'Matériel utilisé :' || E'\n' || lignes
  );
  perform public.stock_ping_envoi();
  return json_build_object('ok', true, 'message', lignes);
end;
$$;
grant execute on function public.notifier_conso_souhait(uuid) to authenticated;

-- ── Oxygène : une alerte quand la pression passe à 50 bar ou moins ─────────
create or replace function public.trg_stock_o2_mail()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.stock_catalogue;
  l public.stock_lieux;
  corps text;
begin
  if new.pression_bar is not null and new.pression_bar > 50 then
    delete from public.alertes_mail where cle = 'o2:' || new.id::text;
    delete from public.alertes_deja where cle = 'o2:' || new.id::text;
    return new;
  end if;
  if new.pression_bar is null or new.pression_bar > 50 then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.pression_bar is not null and old.pression_bar <= 50 then
    return new;
  end if;
  select * into c from public.stock_catalogue where id = new.catalogue_id;
  if c.mode is distinct from 'oxygene' or new.etat is distinct from 'dispo' then
    return new;
  end if;
  if exists (select 1 from public.alertes_deja d where d.cle = 'o2:' || new.id::text) then
    return new;
  end if;
  select * into l from public.stock_lieux where id = new.lieu_id;
  corps := c.nom
    || coalesce(' ' || trim(to_char(coalesce(new.volume_l, c.volume_l), 'FM999')) || ' L', '')
    || E'\nPression : ' || trim(to_char(new.pression_bar, 'FM999.9')) || ' bar'
    || E'\nLieu : ' || coalesce(l.nom, 'non rangée')
    || case when new.date_peremption is not null
         then E'\nPéremption : ' || to_char(new.date_peremption, 'DD/MM/YYYY') else '' end
    || E'\n\nCette bouteille doit partir en recharge.';
  if public.alerter_logistique('o2:' || new.id::text, 'Oxygène ≤ 50 bar — ' || c.nom, corps) > 0 then
    insert into public.alertes_deja (cle) values ('o2:' || new.id::text) on conflict do nothing;
    perform public.stock_ping_envoi();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_stock_o2_mail on public.stock_unites;
create trigger trg_stock_o2_mail
  after insert or update of pression_bar, etat on public.stock_unites
  for each row execute function public.trg_stock_o2_mail();

-- ── Chaque matin : J-15, J-7, jour J, et bouteilles déjà sous 50 bar ───────
-- Le jour est celui de Bruxelles. Une bouteille ou un article ajouté plus tard
-- le même jour reçoit son propre courrier : on ne réécrit pas un envoi déjà parti.
create or replace function public.preparer_alertes_stock()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  e record;
  corps text;
  n int;
  ins int;
  ids uuid[];
  cle_envoi text;
  bte record;
  a_qui boolean;
  jour date := (timezone('Europe/Brussels', now()))::date;
begin
  select exists (
    select 1 from public.profiles p
    where coalesce(p.actif, true)
      and p.email is not null
      and length(trim(p.email)) > 3
      and coalesce(p.fiche, '{}'::jsonb)->'roles_asbl' ?| array['resp_logistique', 'resp_logistique_adjoint']
  ) into a_qui;
  if not a_qui then
    return;
  end if;

  for e in
    select * from (values
      ('j15'::text, 15, 'Péremption dans 15 jours'::text),
      ('j7', 7, 'Péremption dans 7 jours'),
      ('j0', 0, 'Péremption aujourd''hui')
    ) as v(code, delta, titre)
  loop
    select count(*), string_agg(
      c.nom
        || case when coalesce(un.lot, '') <> '' then ' · lot ' || un.lot else '' end
        || ' · DLC ' || to_char(un.date_peremption, 'DD/MM/YYYY')
        || ' · ' || coalesce(l.nom, 'non rangé')
        || case when c.mode = 'oxygene'
             then ' · ' || coalesce(trim(to_char(un.pression_bar, 'FM999.9')), '?') || ' bar' else '' end,
      E'\n' order by c.nom, un.lot
    ), array_agg(un.id order by un.id)
      into n, corps, ids
    from public.stock_unites un
    join public.stock_catalogue c on c.id = un.catalogue_id
    left join public.stock_lieux l on l.id = un.lieu_id
    where un.etat = 'dispo'
      and un.qte_restante > 0
      and un.date_peremption = jour + e.delta
      and not exists (
        select 1 from public.alertes_deja d
        where d.cle = 'dlc:' || e.code || ':' || un.id::text || ':' || to_char(un.date_peremption, 'YYYYMMDD')
      );
    if coalesce(n, 0) > 0 then
      corps := corps || case e.code
        when 'j0' then E'\n\nCes articles arrivent à péremption aujourd''hui. Retirez-les du stock utilisable.'
        when 'j7' then E'\n\nIl reste 7 jours avant la date limite.'
        else E'\n\nIl reste 15 jours avant la date limite.'
      end;
      cle_envoi := 'dlc:' || e.code || ':' || to_char(jour, 'YYYYMMDD') || ':' || md5(ids::text);
      ins := public.alerter_logistique(cle_envoi, e.titre, corps);
      if ins > 0 or exists (select 1 from public.alertes_mail m where m.cle = cle_envoi) then
        insert into public.alertes_deja (cle)
        select 'dlc:' || e.code || ':' || x::text || ':' || to_char(jour + e.delta, 'YYYYMMDD')
        from unnest(ids) as x
        on conflict do nothing;
      end if;
    end if;
  end loop;

  for bte in
    select un.id, un.pression_bar, un.volume_l, un.date_peremption,
           c.nom, c.volume_l as vol_cat, l.nom as lieu
    from public.stock_unites un
    join public.stock_catalogue c on c.id = un.catalogue_id
    left join public.stock_lieux l on l.id = un.lieu_id
    where c.mode = 'oxygene'
      and un.etat = 'dispo'
      and un.pression_bar is not null
      and un.pression_bar <= 50
      and not exists (
        select 1 from public.alertes_deja d where d.cle = 'o2:' || un.id::text
      )
  loop
    if exists (select 1 from public.alertes_mail m where m.cle = 'o2:' || bte.id::text) then
      insert into public.alertes_deja (cle) values ('o2:' || bte.id::text) on conflict do nothing;
      continue;
    end if;
    corps := bte.nom
      || coalesce(' ' || trim(to_char(coalesce(bte.volume_l, bte.vol_cat), 'FM999')) || ' L', '')
      || E'\nPression : ' || trim(to_char(bte.pression_bar, 'FM999.9')) || ' bar'
      || E'\nLieu : ' || coalesce(bte.lieu, 'non rangée')
      || case when bte.date_peremption is not null
           then E'\nPéremption : ' || to_char(bte.date_peremption, 'DD/MM/YYYY') else '' end
      || E'\n\nCette bouteille doit partir en recharge.';
    if public.alerter_logistique('o2:' || bte.id::text, 'Oxygène ≤ 50 bar — ' || bte.nom, corps) > 0 then
      insert into public.alertes_deja (cle) values ('o2:' || bte.id::text) on conflict do nothing;
    end if;
  end loop;
end;
$$;
revoke all on function public.preparer_alertes_stock() from public, anon, authenticated;
grant execute on function public.preparer_alertes_stock() to service_role;

-- ── Cron 05:00 UTC (06:00 en hiver, 07:00 en été à Bruxelles) ──────────────
do $$
declare
  pret boolean;
begin
  create schema if not exists extensions;
  create extension if not exists pg_cron;
  create extension if not exists pg_net with schema extensions;
  select exists (select 1 from vault.decrypted_secrets where name = 'project_url')
     and exists (select 1 from vault.decrypted_secrets where name = 'anon_key')
     and exists (select 1 from vault.decrypted_secrets where name = 'alertes_secret')
    into pret;
  if not pret then
    raise notice 'Alertes stock : Vault incomplet, cron du matin non posé.';
    return;
  end if;
  if exists (select 1 from cron.job where jobname = 'alertes-stock-matin') then
    perform cron.unschedule('alertes-stock-matin');
  end if;
  perform cron.schedule(
    'alertes-stock-matin',
    '0 5 * * *',
    $cron$
    select public.preparer_alertes_stock();
    select net.http_post(
      url := rtrim((select decrypted_secret from vault.decrypted_secrets where name = 'project_url' limit 1), '/')
             || '/functions/v1/alertes-stock',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key' limit 1),
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key' limit 1),
        'x-alertes-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'alertes_secret' limit 1)
      ),
      body := '{"action":"envoyer"}'::jsonb,
      timeout_milliseconds := 120000
    );
    $cron$
  );
exception when others then
  raise notice 'Alertes stock : cron non posé (%).', sqlerrm;
end;
$$;
