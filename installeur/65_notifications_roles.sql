-- ════════════════════════════════════════════════════════════════════════════
--  Alertes par rôle + jetons push (web / iOS / Android).
--  Types : assignation_souhait, souhait_agenda, demande_souhait,
--          rapport_materiel, peremption_stock.
--  Président et responsable informatique : tous les types, cases à cocher
--  dans fiche.notif_prefs. Les autres ne reçoivent que ce qui les concerne.
--  Secrets Vault (hors git) : ha_vapid_public, ha_vapid_private, ha_push_hook_secret.
--  Optionnel : ha_fcm_service_account (JSON) pour FCM natif APK.
--  Idempotent. Après 64_pin_archives_recolteurs.sql.
-- ════════════════════════════════════════════════════════════════════════════

create extension if not exists pg_net;
create extension if not exists pg_cron;

alter table public.notifications
  add column if not exists ref_id uuid,
  add column if not exists payload jsonb default '{}'::jsonb;

create index if not exists notifications_dest_lu_idx
  on public.notifications (destinataire_id, lu, created_at desc);
create index if not exists notifications_type_ref_idx
  on public.notifications (type, ref_id, created_at desc);

create table if not exists public.push_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  plateforme  text not null check (plateforme in ('web', 'android', 'ios')),
  token       text not null,
  abonnement  jsonb,
  updated_at  timestamptz default now(),
  unique (user_id, token)
);
create index if not exists push_tokens_user_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;
drop policy if exists push_tokens_own on public.push_tokens;
create policy push_tokens_own on public.push_tokens for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.push_tokens to authenticated;

drop policy if exists notifications_staff_all on public.notifications;
drop policy if exists notifications_select_own on public.notifications;
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_select_own on public.notifications for select to authenticated
  using (destinataire_id = auth.uid() and public.is_staff());
create policy notifications_update_own on public.notifications for update to authenticated
  using (destinataire_id = auth.uid() and public.is_staff())
  with check (destinataire_id = auth.uid() and public.is_staff());

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    execute 'alter publication supabase_realtime add table public.notifications';
  end if;
exception when undefined_object then
  null;
end $$;

-- ── Helpers rôles / préférences ────────────────────────────────────────────
create or replace function public.est_pilote_notifications(p_role text, p_fiche jsonb)
returns boolean
language sql
immutable
as $$
  select coalesce(p_role, '') in ('admin', 'president')
      or coalesce(p_fiche->'roles_asbl' ?| array['president', 'resp_informatique'], false)
$$;

create or replace function public.pref_notification(p_fiche jsonb, p_type text)
returns boolean
language sql
immutable
as $$
  select case
    when p_fiche->'notif_prefs' ? p_type
      then coalesce((p_fiche->'notif_prefs'->>p_type)::boolean, true)
    else true
  end
$$;

create or replace function public.souhait_a_des_dates(s public.souhaits)
returns boolean
language sql
stable
as $$
  select s.date_souhaitee is not null
      or exists (
        select 1
        from jsonb_array_elements(coalesce(s.dates_possibles, '[]'::jsonb)) e
        where coalesce(nullif(e->>'debut', ''), nullif(e->>'date_debut', '')) is not null
      )
$$;

create or replace function public.fmt_dates_souhait(s public.souhaits)
returns text
language plpgsql
stable
as $$
declare
  d0 date;
  d1 date;
begin
  d0 := s.date_souhaitee;
  d1 := coalesce(s.date_fin, s.date_souhaitee);
  if d0 is null then
    select min((coalesce(nullif(e->>'debut', ''), nullif(e->>'date_debut', '')))::date),
           max((coalesce(nullif(e->>'fin', ''), nullif(e->>'date_fin', ''), nullif(e->>'debut', ''), nullif(e->>'date_debut', '')))::date)
      into d0, d1
    from jsonb_array_elements(coalesce(s.dates_possibles, '[]'::jsonb)) e
    where coalesce(nullif(e->>'debut', ''), nullif(e->>'date_debut', '')) is not null;
  end if;
  if d0 is null then return 'dates à préciser'; end if;
  if d1 is null or d1 = d0 then return to_char(d0, 'DD/MM/YYYY'); end if;
  return to_char(d0, 'DD/MM/YYYY') || ' → ' || to_char(d1, 'DD/MM/YYYY');
exception when others then
  return 'dates à préciser';
end
$$;

create or replace function public.destinataires_notification(p_type text, p_cibles uuid[] default null)
returns table (id uuid)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return query
  select p.id
  from public.profiles p
  where coalesce(p.actif, true)
    and p.role::text is distinct from 'partenaire'
    and p.id is distinct from auth.uid()
    and (
      case p_type
        when 'assignation_souhait' then
          (p_cibles is not null and p.id = any (p_cibles)
            and (not public.est_pilote_notifications(p.role::text, p.fiche)
                 or public.pref_notification(p.fiche, p_type)))
          or (public.est_pilote_notifications(p.role::text, p.fiche)
              and public.pref_notification(p.fiche, p_type))
        when 'souhait_agenda' then
          not public.est_pilote_notifications(p.role::text, p.fiche)
          or public.pref_notification(p.fiche, p_type)
        when 'demande_souhait' then
          (coalesce(p.fiche->'roles_asbl' ? 'recolteur_souhait', false)
            and not public.est_pilote_notifications(p.role::text, p.fiche))
          or (public.est_pilote_notifications(p.role::text, p.fiche)
              and public.pref_notification(p.fiche, p_type))
        when 'rapport_materiel' then
          ((p.role::text in ('admin', 'president', 'coordinateur')
              or coalesce(p.fiche->'roles_asbl' ?| array['resp_logistique', 'resp_logistique_adjoint'], false))
            and not public.est_pilote_notifications(p.role::text, p.fiche))
          or (public.est_pilote_notifications(p.role::text, p.fiche)
              and public.pref_notification(p.fiche, p_type))
        when 'peremption_stock' then
          ((p.role::text in ('admin', 'president', 'coordinateur')
              or coalesce(p.fiche->'roles_asbl' ?| array['resp_logistique', 'resp_logistique_adjoint'], false))
            and not public.est_pilote_notifications(p.role::text, p.fiche))
          or (public.est_pilote_notifications(p.role::text, p.fiche)
              and public.pref_notification(p.fiche, p_type))
        else false
      end
    );
end
$$;

create or replace function public.push_config()
returns jsonb
language plpgsql
security definer
set search_path = vault, public
as $$
declare
  pub text;
  priv text;
  hook text;
  fcm text;
begin
  if auth.role() is distinct from 'service_role' and current_user not in ('postgres', 'supabase_admin') then
    raise exception 'forbidden';
  end if;
  select decrypted_secret into pub  from vault.decrypted_secrets where name = 'ha_vapid_public' limit 1;
  select decrypted_secret into priv from vault.decrypted_secrets where name = 'ha_vapid_private' limit 1;
  select decrypted_secret into hook from vault.decrypted_secrets where name = 'ha_push_hook_secret' limit 1;
  select decrypted_secret into fcm  from vault.decrypted_secrets where name = 'ha_fcm_service_account' limit 1;
  return jsonb_build_object(
    'ok', (priv is not null and length(btrim(priv)) > 0),
    'vapid_public', coalesce(pub, ''),
    'vapid_private', coalesce(priv, ''),
    'hook_secret', coalesce(hook, ''),
    'fcm_service_account', coalesce(fcm, ''),
    'subject', 'mailto:laurent@heartsangels.be'
  );
end
$$;
revoke all on function public.push_config() from public, anon, authenticated;
grant execute on function public.push_config() to service_role;

create or replace function public.vapid_cle_publique()
returns text
language plpgsql
stable
security definer
set search_path = vault, public
as $$
declare
  pub text;
begin
  select decrypted_secret into pub from vault.decrypted_secrets where name = 'ha_vapid_public' limit 1;
  return coalesce(pub, '');
end
$$;
grant execute on function public.vapid_cle_publique() to authenticated, anon;

create or replace function public._declencher_push(p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public, net, extensions, vault
as $$
declare
  hook text;
begin
  if p_ids is null or cardinality(p_ids) = 0 then return; end if;
  select decrypted_secret into hook from vault.decrypted_secrets where name = 'ha_push_hook_secret' limit 1;
  if hook is null or length(btrim(hook)) = 0 then return; end if;
  begin
    perform net.http_post(
      url := 'https://vppmvjqbzdeftrhdoert.supabase.co/functions/v1/envoyer-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', 'sb_publishable_A_Bu4P4-Fn-sy3xF58U4Cg_kJ_aLSIH',
        'Authorization', 'Bearer sb_publishable_A_Bu4P4-Fn-sy3xF58U4Cg_kJ_aLSIH',
        'x-ha-push-secret', btrim(hook)
      ),
      body := jsonb_build_object('ids', p_ids)
    );
  exception when others then
    null;
  end;
end
$$;

create or replace function public.notifier_evenement(
  p_type text,
  p_titre text,
  p_message text,
  p_lien text default '/app',
  p_priorite text default 'normale',
  p_cibles uuid[] default null,
  p_ref uuid default null,
  p_payload jsonb default '{}'::jsonb
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  ids uuid[] := '{}';
  n int := 0;
  dest uuid;
  nid uuid;
begin
  for dest in select d.id from public.destinataires_notification(p_type, p_cibles) d
  loop
    if p_type = 'peremption_stock' and p_ref is null and exists (
      select 1 from public.notifications x
      where x.destinataire_id = dest and x.type = p_type
        and x.created_at::date = current_date
    ) then
      continue;
    end if;
    if p_ref is not null and exists (
      select 1 from public.notifications x
      where x.destinataire_id = dest and x.type = p_type and x.ref_id = p_ref
        and x.created_at > now() - interval '7 days'
    ) then
      continue;
    end if;
    insert into public.notifications(destinataire_id, type, titre, message, lien, priorite, ref_id, payload)
      values (dest, p_type, p_titre, p_message, p_lien, p_priorite, p_ref, coalesce(p_payload, '{}'::jsonb))
      returning id into nid;
    ids := ids || nid;
    n := n + 1;
  end loop;
  perform public._declencher_push(ids);
  return n;
end
$$;
grant execute on function public.notifier_evenement(text, text, text, text, text, uuid[], uuid, jsonb) to authenticated, service_role;

create or replace function public.enregistrer_push_token(
  p_plateforme text,
  p_token text,
  p_abonnement jsonb default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'error', 'non authentifié');
  end if;
  if p_plateforme not in ('web', 'android', 'ios') or coalesce(trim(p_token), '') = '' then
    return json_build_object('ok', false, 'error', 'jeton invalide');
  end if;
  insert into public.push_tokens (user_id, plateforme, token, abonnement, updated_at)
    values (auth.uid(), p_plateforme, trim(p_token), p_abonnement, now())
  on conflict (user_id, token) do update
    set plateforme = excluded.plateforme,
        abonnement = excluded.abonnement,
        updated_at = now();
  return json_build_object('ok', true);
end
$$;
grant execute on function public.enregistrer_push_token(text, text, jsonb) to authenticated;

create or replace function public.supprimer_push_token(p_token text)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return json_build_object('ok', false);
  end if;
  delete from public.push_tokens where user_id = auth.uid() and token = p_token;
  return json_build_object('ok', true);
end
$$;
grant execute on function public.supprimer_push_token(text) to authenticated;

create or replace function public.marquer_notifications_lues(p_ids uuid[] default null)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return json_build_object('ok', false);
  end if;
  update public.notifications
     set lu = true, lu_a = now()
   where destinataire_id = auth.uid()
     and lu = false
     and (p_ids is null or id = any (p_ids));
  return json_build_object('ok', true);
end
$$;
grant execute on function public.marquer_notifications_lues(uuid[]) to authenticated;

-- ── Déclencheurs métier ────────────────────────────────────────────────────
create or replace function public.trg_assignation_notif()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.souhaits;
  lieu text;
begin
  select * into s from public.souhaits where id = new.souhait_id;
  if not found then return new; end if;
  lieu := coalesce(nullif(s.localisation, ''), s.mission->>'lieu', s.mission->>'activite', 'Mission');
  perform public.notifier_evenement(
    'assignation_souhait',
    'Affectation à un souhait',
    public.fmt_dates_souhait(s) || ' · ' || lieu,
    '/app/missions/' || new.souhait_id::text,
    'haute',
    array[new.user_id],
    new.id,
    jsonb_build_object('souhait_id', new.souhait_id)
  );
  return new;
end
$$;
drop trigger if exists trg_assignation_notif on public.souhait_personnel;
create trigger trg_assignation_notif
  after insert on public.souhait_personnel
  for each row execute function public.trg_assignation_notif();

create or replace function public.trg_souhait_agenda_notif()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  lieu text;
begin
  if tg_op = 'UPDATE' and public.souhait_a_des_dates(old) then
    return new;
  end if;
  if not public.souhait_a_des_dates(new) then
    return new;
  end if;
  if coalesce(new.statut::text, '') in ('annule', 'non_realise') then
    return new;
  end if;
  lieu := coalesce(nullif(new.localisation, ''), new.mission->>'lieu', new.mission->>'activite', 'Souhait');
  perform public.notifier_evenement(
    'souhait_agenda',
    'Nouveau souhait à l’agenda',
    public.fmt_dates_souhait(new) || ' · ' || lieu,
    '/app/disponibilites',
    'normale',
    null,
    new.id,
    jsonb_build_object('souhait_id', new.id)
  );
  return new;
end
$$;
drop trigger if exists trg_souhait_agenda_notif on public.souhaits;
create trigger trg_souhait_agenda_notif
  after insert or update of date_souhaitee, date_fin, dates_possibles, statut
  on public.souhaits
  for each row execute function public.trg_souhait_agenda_notif();

create or replace function public.trg_demande_souhait_notif()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  qui text;
  ou text;
begin
  if coalesce(new.fictif, false) then return new; end if;
  if coalesce(new.statut, 'nouvelle') not in ('nouvelle', 'en_cours') then return new; end if;
  qui := nullif(trim(coalesce(new.patient_prenom, '')), '');
  ou := nullif(trim(coalesce(new.souhait_lieu, new.etablissement, '')), '');
  perform public.notifier_evenement(
    'demande_souhait',
    case when coalesce(new.urgence, false) then 'Demande de souhait urgente' else 'Nouvelle demande de souhait' end,
    trim(both ' · ' from coalesce(qui, 'Nouveau dossier') || coalesce(' · ' || ou, '')),
    '/app/souhaits',
    case when coalesce(new.urgence, false) then 'haute' else 'normale' end,
    null,
    new.id,
    jsonb_build_object('demande_id', new.id)
  );
  return new;
end
$$;
drop trigger if exists trg_demande_souhait_notif on public.demandes_souhaits;
create trigger trg_demande_souhait_notif
  after insert on public.demandes_souhaits
  for each row execute function public.trg_demande_souhait_notif();

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
  perform public.notifier_evenement(
    'rapport_materiel',
    'Nouveau rapport d’utilisation de matériel',
    coalesce(lieu_txt, 'Mission') || E'\n' || lignes,
    '/app/stock',
    'normale',
    null,
    p_souhait,
    jsonb_build_object('souhait_id', p_souhait)
  );
  return json_build_object('ok', true, 'message', lignes);
end
$$;
grant execute on function public.notifier_conso_souhait(uuid) to authenticated;

create or replace function public.notifier_peremptions_stock()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  n_perimes int;
  n_proches int;
  lignes text;
begin
  select count(*) into n_perimes
  from public.stock_unites u
  where u.etat = 'dispo' and coalesce(u.qte_restante, 0) > 0
    and u.date_peremption is not null and u.date_peremption < current_date;
  select count(*) into n_proches
  from public.stock_unites u
  where u.etat = 'dispo' and coalesce(u.qte_restante, 0) > 0
    and u.date_peremption is not null
    and u.date_peremption >= current_date
    and u.date_peremption <= current_date + 90;
  if coalesce(n_perimes, 0) = 0 and coalesce(n_proches, 0) = 0 then
    return json_build_object('ok', true, 'rien', true);
  end if;
  select string_agg(x.ligne, E'\n')
    into lignes
  from (
    select c.nom || ' · ' || to_char(u.date_peremption, 'DD/MM/YYYY') as ligne
    from public.stock_unites u
    join public.stock_catalogue c on c.id = u.catalogue_id
    where u.etat = 'dispo' and coalesce(u.qte_restante, 0) > 0
      and u.date_peremption is not null
      and u.date_peremption <= current_date + 90
    order by u.date_peremption, c.nom
    limit 12
  ) x;
  perform public.notifier_evenement(
    'peremption_stock',
    'Alertes de péremption',
    trim(both E'\n' from
      case when n_perimes > 0 then n_perimes::text || ' lot(s) périmé(s). ' else '' end ||
      case when n_proches > 0 then n_proches::text || ' lot(s) à ≤ 90 jours.' else '' end
    ) || coalesce(E'\n' || lignes, ''),
    '/app/stock',
    case when n_perimes > 0 then 'haute' else 'normale' end,
    null,
    null,
    jsonb_build_object('jour', current_date)
  );
  return json_build_object('ok', true, 'perimes', n_perimes, 'proches', n_proches);
end
$$;
grant execute on function public.notifier_peremptions_stock() to authenticated, service_role;

create or replace function public.trg_stock_peremption_notif()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  nom text;
begin
  if new.date_peremption is null then return new; end if;
  if new.etat is distinct from 'dispo' then return new; end if;
  if coalesce(new.qte_restante, 0) <= 0 then return new; end if;
  if new.date_peremption > current_date + 90 then return new; end if;
  if tg_op = 'UPDATE'
     and old.date_peremption is not distinct from new.date_peremption
     and old.etat is not distinct from new.etat then
    return new;
  end if;
  select c.nom into nom from public.stock_catalogue c where c.id = new.catalogue_id;
  perform public.notifier_evenement(
    'peremption_stock',
    case when new.date_peremption < current_date then 'Matériel périmé' else 'Péremption proche' end,
    coalesce(nom, 'Article') || ' · ' || to_char(new.date_peremption, 'DD/MM/YYYY'),
    '/app/stock',
    case when new.date_peremption < current_date then 'haute' else 'normale' end,
    null,
    new.id,
    jsonb_build_object('unite_id', new.id)
  );
  return new;
end
$$;
drop trigger if exists trg_stock_peremption_notif on public.stock_unites;
create trigger trg_stock_peremption_notif
  after insert or update of date_peremption, etat, qte_restante
  on public.stock_unites
  for each row execute function public.trg_stock_peremption_notif();

do $$
begin
  perform cron.unschedule(j.jobid) from cron.job j where j.jobname = 'ha-peremption-stock';
exception when others then
  null;
end $$;

do $$
begin
  perform cron.schedule('ha-peremption-stock', '15 6 * * *', $c$select public.notifier_peremptions_stock()$c$);
exception when others then
  null;
end $$;

notify pgrst, 'reload schema';
