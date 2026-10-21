-- Rappel de mission la veille, matin et soir (push seul).
-- L’affectation ouvre le récapitulatif dans Mes souhaits.
-- Le DAR devient un tableau D / A / R par problème ou plainte.

alter table public.notifications
  add column if not exists dans_appli boolean not null default true;

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications for select to authenticated
  using (destinataire_id = auth.uid() and public.is_staff() and dans_appli);

create or replace function public.notification_push_seulement(p_type text)
returns boolean
language sql
immutable
as $$
  select coalesce(p_type, '') in ('rappel_mission')
$$;

revoke all on function public.notification_push_seulement(text) from public, anon, authenticated;

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
set search_path = public, extensions
as $$
declare
  ids uuid[] := '{}';
  n int := 0;
  dest uuid;
  nid uuid;
  partage boolean;
  gid uuid;
  minutes int;
  sans boolean;
begin
  partage := public.notification_est_partagee(p_type);
  sans := coalesce((p_payload->>'sans_dedup')::boolean, false);
  minutes := coalesce((p_payload->>'dedup_minutes')::int, 7 * 24 * 60);
  if partage then gid := gen_random_uuid(); end if;

  for dest in select d.id from public.destinataires_notification(p_type, p_cibles) d
  loop
    if not sans and p_ref is null and exists (
      select 1 from public.notifications x
      where x.destinataire_id = dest and x.type = p_type
        and x.created_at::date = current_date
    ) then
      continue;
    end if;
    if not sans and p_ref is not null and exists (
      select 1 from public.notifications x
      where x.destinataire_id = dest and x.type = p_type and x.ref_id = p_ref
        and coalesce(x.payload->>'creneau', '') = coalesce(p_payload->>'creneau', '')
        and x.created_at > now() - make_interval(mins => minutes)
    ) then
      continue;
    end if;

    insert into public.notifications(destinataire_id, type, titre, message, lien, priorite, ref_id, payload, groupe_id, dans_appli)
      values (
        dest, p_type, p_titre, p_message, p_lien, p_priorite, p_ref, coalesce(p_payload, '{}'::jsonb), gid,
        not (
          public.notification_push_seulement(p_type)
          or coalesce((p_payload->>'push_seulement')::boolean, false)
        )
      )
      returning id into nid;

    ids := ids || nid;
    n := n + 1;
  end loop;

  perform public._declencher_push(ids);
  return n;
end
$$;

create or replace function public.notifier_rappels_mission(p_creneau text default 'matin')
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.souhaits;
  cibles uuid[];
  creneau text := case when p_creneau = 'soir' then 'soir' else 'matin' end;
  n int := 0;
begin
  for s in
    select so.*
    from public.souhaits so
    where coalesce(so.fictif, false) = false
      and coalesce(so.mission->>'demo_cle', '') = ''
      and so.statut::text not in ('annule', 'non_realise', 'realise', 'demande_info_externe')
      and public.souhait_commence_le(so, current_date + 1)
  loop
    select coalesce(array_agg(sp.user_id), '{}') into cibles
    from public.souhait_personnel sp
    where sp.souhait_id = s.id and coalesce(sp.publie, true);
    if cardinality(cibles) = 0 then continue; end if;
    perform public.notifier_evenement(
      'rappel_mission',
      'Mission demain',
      trim(both ' ' from (case when creneau = 'soir' then 'Rappel du soir. ' else 'Rappel du matin. ' end)
        || trim(both ' · ' from public.fmt_dates_souhait(s)
          || coalesce(' · ' || to_char(s.heure_depart, 'HH24:MI'), '')
          || coalesce(' · ' || nullif(s.localisation, ''), '')
          || coalesce(' · ' || nullif(s.beneficiaire_prenom, ''), ''))),
      '/app/missions/' || s.id::text || '?volet=recap',
      'normale',
      cibles,
      s.id,
      jsonb_build_object('souhait_id', s.id, 'dedup_minutes', 1200, 'creneau', creneau, 'push_seulement', true)
    );
    n := n + 1;
  end loop;
  return n;
end
$$;

revoke all on function public.notifier_rappels_mission(text) from public, anon;
grant execute on function public.notifier_rappels_mission(text) to service_role;

create or replace function public.notifier_digest_notifications()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.souhaits;
  lignes text;
  n int := 0;
  p record;
begin
  n := n + public.notifier_rappels_mission('matin');

  for s in
    select so.*
    from public.souhaits so
    where coalesce(so.fictif, false) = false
      and coalesce(so.mission->>'demo_cle', '') = ''
      and so.statut::text in ('nouveau', 'en_attente', 'pret', 'en_cours')
      and public.souhait_croise_plage(so, current_date, current_date + 3)
      and (
        not exists (
          select 1 from public.souhait_personnel sp
          where sp.souhait_id = so.id and coalesce(sp.publie, true)
        )
        or exists (
          select 1
          from jsonb_array_elements(coalesce(so.mission->'vecteurs', '[]'::jsonb)) v
          where not exists (
            select 1 from public.souhait_personnel sp
            where sp.souhait_id = so.id
              and coalesce(sp.publie, true)
              and sp.vecteur_id = v->>'id'
          )
        )
      )
  loop
    perform public.notifier_evenement(
      'equipage_incomplet',
      'Équipage incomplet',
      trim(both ' · ' from coalesce(s.beneficiaire_prenom, 'Souhait')
        || ' · ' || public.fmt_dates_souhait(s)
        || coalesce(' · ' || nullif(s.localisation, ''), '')),
      '/app/souhaits/' || s.id::text,
      'haute',
      null,
      s.id,
      jsonb_build_object('souhait_id', s.id, 'dedup_minutes', 1200)
    );
    n := n + 1;
  end loop;

  for p in
    select pr.id, pr.prenom, pr.nom, public.fiche_date_selection(pr.fiche) as echeance
    from public.profiles pr
    where coalesce(pr.actif, true)
      and pr.role::text is distinct from 'partenaire'
      and public.fiche_date_selection(pr.fiche) is not null
      and public.fiche_date_selection(pr.fiche) <= current_date + 30
  loop
    perform public.notifier_evenement(
      'echeance_perso',
      case when p.echeance < current_date then 'Sélection médicale périmée' else 'Sélection médicale bientôt à échéance' end,
      'Valide jusqu’au ' || to_char(p.echeance, 'DD/MM/YYYY') || '.',
      '/app/profil',
      case when p.echeance < current_date then 'haute' else 'normale' end,
      array[p.id],
      null,
      jsonb_build_object('echeance', p.echeance)
    );
  end loop;

  select string_agg(
    trim(coalesce(pr.prenom, '') || ' ' || coalesce(pr.nom, ''))
      || ' · ' || to_char(public.fiche_date_selection(pr.fiche), 'DD/MM/YYYY'),
    E'\n' order by public.fiche_date_selection(pr.fiche)
  ) into lignes
  from public.profiles pr
  where coalesce(pr.actif, true)
    and pr.role::text is distinct from 'partenaire'
    and public.fiche_date_selection(pr.fiche) is not null
    and public.fiche_date_selection(pr.fiche) <= current_date + 30;
  if lignes is not null then
    perform public.notifier_evenement(
      'echeance_staff',
      'Sélections médicales à échéance',
      lignes,
      '/app/volontaires',
      'normale',
      null,
      null,
      jsonb_build_object('jour', current_date)
    );
  end if;

  select string_agg(c.nom || ' · ' || coalesce(u.pression_bar, 0)::text || ' bar', E'\n' order by u.pression_bar, c.nom)
    into lignes
  from public.stock_unites u
  join public.stock_catalogue c on c.id = u.catalogue_id
  where u.etat = 'dispo' and c.mode = 'oxygene' and coalesce(u.pression_bar, 0) <= 50;
  if lignes is not null then
    perform public.notifier_evenement(
      'oxygene_basse',
      'Oxygène bas',
      lignes,
      '/app/stock',
      'haute',
      null,
      null,
      jsonb_build_object('jour', current_date)
    );
  end if;

  select string_agg(
    c.nom || coalesce(' · ' || nullif(u.numero_serie, ''), '') || ' · ' || to_char(e.date_prochain, 'DD/MM/YYYY'),
    E'\n' order by e.date_prochain, c.nom
  ) into lignes
  from public.stock_unites u
  join public.stock_catalogue c on c.id = u.catalogue_id
  join lateral (
    select date_prochain
    from public.stock_unite_entretiens
    where unite_id = u.id
    order by date_fait desc, created_at desc
    limit 1
  ) e on true
  where u.etat = 'dispo'
    and e.date_prochain is not null
    and e.date_prochain <= current_date + 30
    and (c.nature = 'materiel' or (c.nature is null and c.mode in ('durable', 'oxygene')));
  if lignes is not null then
    perform public.notifier_evenement(
      'entretien_materiel',
      'Entretien de matériel',
      lignes,
      '/app/stock',
      'haute',
      null,
      null,
      jsonb_build_object('jour', current_date)
    );
  end if;

  select string_agg(
    c.nom || coalesce(' · ' || f.nom, '') || coalesce(' · rappel ' || to_char(cmd.date_rappel, 'DD/MM/YYYY'), ''),
    E'\n' order by cmd.date_rappel nulls first, c.nom
  ) into lignes
  from public.stock_commandes cmd
  join public.stock_catalogue c on c.id = cmd.catalogue_id
  left join public.stock_fournisseurs f on f.id = cmd.fournisseur_id
  where cmd.statut in ('a_commander', 'commandee')
    and (cmd.date_rappel is null or cmd.date_rappel <= current_date + 7);
  if lignes is not null then
    perform public.notifier_evenement(
      'commande_rappel',
      'Commande à relancer',
      lignes,
      '/app/stock',
      'normale',
      null,
      null,
      jsonb_build_object('jour', current_date)
    );
  end if;

  delete from public.notification_jetons where expire < now() - interval '2 days';
  delete from public.notifications
   where dans_appli = false
     and created_at < now() - interval '3 days';
  return json_build_object('ok', true, 'passes', n);
end
$$;

revoke all on function public.notifier_digest_notifications() from public, anon;
grant execute on function public.notifier_digest_notifications() to service_role;

do $$
begin
  perform cron.unschedule(j.jobid) from cron.job j where j.jobname = 'ha-notifs-matin';
exception when others then
  null;
end $$;

do $$
begin
  perform cron.schedule('ha-notifs-matin', '25 6 * * *', $c$select public.notifier_digest_notifications()$c$);
exception when others then
  null;
end $$;

do $$
begin
  perform cron.unschedule(j.jobid) from cron.job j where j.jobname = 'ha-notifs-soir';
exception when others then
  null;
end $$;

do $$
begin
  -- 17:00 UTC : 19 h en heure d’été, 18 h en heure d’hiver.
  perform cron.schedule('ha-notifs-soir', '0 17 * * *', $c$select public.notifier_rappels_mission('soir')$c$);
exception when others then
  null;
end $$;

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
  if coalesce(new.publie, true) is not true then
    return new;
  end if;
  if tg_op = 'UPDATE' and coalesce(old.publie, true) is true then
    return new;
  end if;
  select * into s from public.souhaits where id = new.souhait_id;
  if not found then return new; end if;
  if coalesce(s.fictif, false) then return new; end if;
  if coalesce(s.mission->>'demo_cle', '') <> '' then return new; end if;
  lieu := coalesce(nullif(s.localisation, ''), s.mission->>'lieu', s.mission->>'activite', 'Mission');
  perform public.notifier_evenement(
    'assignation_souhait',
    'Affectation à un souhait',
    public.fmt_dates_souhait(s) || ' · ' || lieu,
    '/app/missions/' || new.souhait_id::text || '?volet=recap',
    'haute',
    array[new.user_id],
    new.id,
    jsonb_build_object('souhait_id', new.souhait_id)
  );
  return new;
end
$$;

-- ── Transmission ciblée : un tableau D / A / R par problème ────────────────
create table if not exists public.souhait_dar_cibles (
  id uuid primary key default gen_random_uuid(),
  souhait_id uuid not null references public.souhaits(id) on delete cascade,
  auteur_id uuid not null references public.profiles(id),
  probleme text not null check (char_length(btrim(probleme)) > 0),
  donnee text not null default '',
  action text not null default '',
  resultat text not null default '',
  individuel boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists souhait_dar_cibles_souhait_idx
  on public.souhait_dar_cibles (souhait_id, created_at);

alter table public.souhait_dar_cibles enable row level security;
revoke all on public.souhait_dar_cibles from anon;
grant select, insert, update, delete on public.souhait_dar_cibles to authenticated, service_role;

drop policy if exists souhait_dar_cibles_select on public.souhait_dar_cibles;
create policy souhait_dar_cibles_select on public.souhait_dar_cibles
  for select to authenticated
  using (
    (not individuel and public.peut_lire_dar(souhait_id))
    or (individuel and auteur_id = auth.uid())
  );

drop policy if exists souhait_dar_cibles_insert on public.souhait_dar_cibles;
create policy souhait_dar_cibles_insert on public.souhait_dar_cibles
  for insert to authenticated
  with check (
    auteur_id = auth.uid()
    and public.dar_auteur_medical(souhait_id)
    and (
      (individuel and public.est_souhait_demo(souhait_id))
      or (not individuel and not public.est_souhait_demo(souhait_id))
    )
  );

drop policy if exists souhait_dar_cibles_update on public.souhait_dar_cibles;
create policy souhait_dar_cibles_update on public.souhait_dar_cibles
  for update to authenticated
  using (
    public.dar_auteur_medical(souhait_id)
    and (
      (individuel and auteur_id = auth.uid())
      or not individuel
    )
  )
  with check (
    public.dar_auteur_medical(souhait_id)
    and (
      (individuel and auteur_id = auth.uid())
      or not individuel
    )
  );

drop policy if exists souhait_dar_cibles_delete on public.souhait_dar_cibles;
create policy souhait_dar_cibles_delete on public.souhait_dar_cibles
  for delete to authenticated
  using (
    public.dar_auteur_medical(souhait_id)
    and (
      (individuel and auteur_id = auth.uid())
      or not individuel
    )
  );

insert into public.souhait_dar_cibles (
  souhait_id, auteur_id, probleme, donnee, action, resultat, individuel, created_at, updated_at
)
select
  d.souhait_id,
  (array_agg(d.auteur_id order by d.created_at))[1],
  'Transmissions déjà notées',
  coalesce(string_agg(d.texte, E'\n' order by d.created_at) filter (where d.genre = 'donnee'), ''),
  coalesce(string_agg(d.texte, E'\n' order by d.created_at) filter (where d.genre = 'action'), ''),
  coalesce(string_agg(d.texte, E'\n' order by d.created_at) filter (where d.genre = 'resultat'), ''),
  d.individuel,
  min(d.created_at),
  now()
from public.souhait_dar d
where d.genre in ('donnee', 'action', 'resultat')
  and not exists (
    select 1 from public.souhait_dar_cibles c
    where c.souhait_id = d.souhait_id
      and c.probleme = 'Transmissions déjà notées'
      and c.individuel = d.individuel
  )
group by d.souhait_id, d.individuel;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'souhait_dar_cibles'
  ) then
    alter publication supabase_realtime add table public.souhait_dar_cibles;
  end if;
end $$;


notify pgrst, 'reload schema';
