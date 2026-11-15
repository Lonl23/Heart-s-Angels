-- ════════════════════════════════════════════════════════════════════════════
--  Helpdesk : cycle de vie (résolu → fermé après 48 h), notes bloquées,
--  statut en direct (realtime). Idempotent. Après 128_helpdesk_captures.sql.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.helpdesk_tickets
  add column if not exists resolu_le timestamptz;

-- Ferme automatiquement les dossiers résolus depuis plus de 48 h.
create or replace function public.helpdesk_fermer_expires()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer := 0;
begin
  with maj as (
    update public.helpdesk_tickets
       set statut = 'ferme',
           updated_at = now()
     where statut = 'resolu'
       and resolu_le is not null
       and resolu_le <= now() - interval '48 hours'
    returning id
  )
  select count(*) into n from maj;
  return n;
end
$$;

revoke all on function public.helpdesk_fermer_expires() from public, anon;
grant execute on function public.helpdesk_fermer_expires() to authenticated, service_role;

create or replace function public.helpdesk_statut(p_id uuid, p_statut text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_auteur uuid;
  v_titre text;
begin
  if not public.peut_gerer_helpdesk() then
    return jsonb_build_object('ok', false, 'error', 'réservé à l’informatique');
  end if;
  -- L’IT choisit ouvert / en_cours / résolu. « Fermé » est automatique après 48 h.
  if p_statut not in ('ouvert', 'en_cours', 'resolu') then
    return jsonb_build_object('ok', false, 'error', 'statut inconnu (fermé = automatique après 48 h)');
  end if;
  select coalesce(groupe_id, id) into v_id from public.helpdesk_tickets where id = p_id;
  if v_id is null then
    return jsonb_build_object('ok', false, 'error', 'ticket introuvable');
  end if;
  update public.helpdesk_tickets
     set statut = p_statut,
         resolu_le = case when p_statut = 'resolu' then coalesce(resolu_le, now()) else null end,
         updated_at = now()
   where id = v_id
      or groupe_id = v_id;
  if p_statut = 'resolu' then
    select auteur_id, titre into v_auteur, v_titre from public.helpdesk_tickets where id = v_id;
    if v_auteur is not null then
      perform public.notifier_evenement(
        'helpdesk_reponse',
        'Demande résolue',
        coalesce(v_titre, 'Votre demande'),
        '/app/it/helpdesk',
        'normale',
        array[v_auteur],
        v_id,
        jsonb_build_object('ticket_id', v_id, 'dedup_minutes', 5)
      );
    end if;
  end if;
  return jsonb_build_object('ok', true);
end
$$;

create or replace function public.commenter_mon_ticket(p_id uuid, p_message text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_msg text := nullif(trim(p_message), '');
  v_statut text;
  v_root uuid;
begin
  perform public.helpdesk_fermer_expires();
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'non autorisé');
  end if;
  if v_msg is null then
    return jsonb_build_object('ok', false, 'error', 'message vide');
  end if;
  select
    coalesce(t.groupe_id, t.id),
    coalesce(p.statut, t.statut)
  into v_root, v_statut
  from public.helpdesk_tickets t
  left join public.helpdesk_tickets p on p.id = t.groupe_id
  where t.id = p_id and t.auteur_id = auth.uid();
  if v_root is null then
    return jsonb_build_object('ok', false, 'error', 'ticket introuvable');
  end if;
  if v_statut = 'ferme' then
    return jsonb_build_object('ok', false, 'error', 'dossier fermé — plus de message possible');
  end if;
  insert into public.helpdesk_suivi (ticket_id, auteur_id, message, origine, interne)
  values (p_id, auth.uid(), left(v_msg, 2000), 'auteur', false);
  return jsonb_build_object('ok', true);
end
$$;

create or replace function public.helpdesk_note(p_id uuid, p_message text, p_interne boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_msg text := nullif(trim(p_message), '');
  v_auteur uuid;
  v_titre text;
  v_statut text;
begin
  perform public.helpdesk_fermer_expires();
  if not public.peut_gerer_helpdesk() then
    return jsonb_build_object('ok', false, 'error', 'réservé à l’informatique');
  end if;
  if v_msg is null then
    return jsonb_build_object('ok', false, 'error', 'message vide');
  end if;
  select coalesce(t.groupe_id, t.id), coalesce(p.statut, t.statut)
    into v_id, v_statut
  from public.helpdesk_tickets t
  left join public.helpdesk_tickets p on p.id = t.groupe_id
  where t.id = p_id;
  if v_id is null then
    return jsonb_build_object('ok', false, 'error', 'ticket introuvable');
  end if;
  if v_statut = 'ferme' then
    return jsonb_build_object('ok', false, 'error', 'dossier fermé — plus de note possible');
  end if;
  insert into public.helpdesk_suivi (ticket_id, auteur_id, message, origine, interne)
  values (v_id, auth.uid(), left(v_msg, 2000), 'informatique', coalesce(p_interne, false));
  if coalesce(p_interne, false) is not true then
    select auteur_id, titre into v_auteur, v_titre from public.helpdesk_tickets where id = v_id;
    if v_auteur is not null then
      perform public.notifier_evenement(
        'helpdesk_reponse',
        'Réponse du helpdesk',
        left(coalesce(v_titre, 'Votre demande') || ' — ' || v_msg, 180),
        '/app/it/helpdesk',
        'normale',
        array[v_auteur],
        v_id,
        jsonb_build_object('ticket_id', v_id, 'sans_dedup', true)
      );
    end if;
  end if;
  return jsonb_build_object('ok', true);
end
$$;

-- mes_tickets : statut effectif (ferme auto) + resolu_le
create or replace function public.mes_tickets()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.helpdesk_fermer_expires();
  if auth.uid() is null then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(x order by x.created_at desc)
    from (
      select
        t.id,
        t.numero,
        t.type,
        t.titre,
        t.description,
        coalesce(p.statut, t.statut) as statut,
        coalesce(p.resolu_le, t.resolu_le) as resolu_le,
        t.created_at,
        coalesce((
          select jsonb_agg(jsonb_build_object(
            'message', m.message,
            'created_at', m.created_at,
            'qui', case when m.auteur_id = auth.uid() then 'moi' else 'informatique' end
          ) order by m.created_at)
          from public.helpdesk_suivi m
          where m.interne = false
            and (
              (m.ticket_id = t.id and m.auteur_id = auth.uid())
              or (m.ticket_id = coalesce(t.groupe_id, t.id) and m.origine = 'informatique')
            )
        ), '[]'::jsonb) as messages,
        coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', pe.id,
            'path', pe.path,
            'nom', pe.nom
          ) order by pe.created_at)
          from public.helpdesk_pieces pe
          where pe.ticket_id = t.id
        ), '[]'::jsonb) as pieces
      from public.helpdesk_tickets t
      left join public.helpdesk_tickets p on p.id = t.groupe_id
      where t.auteur_id = auth.uid()
    ) x
  ), '[]'::jsonb);
end
$$;

create or replace function public.helpdesk_file()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.helpdesk_fermer_expires();
  if not public.peut_gerer_helpdesk() then
    return jsonb_build_object('ok', false, 'error', 'réservé à l’informatique');
  end if;
  return jsonb_build_object(
    'ok', true,
    'bugs_ouverts', (
      select count(*) from public.helpdesk_tickets
      where type = 'bug' and groupe_id is null and statut not in ('resolu', 'ferme')
    ),
    'suggestions_ouvertes', (
      select count(*) from public.helpdesk_tickets
      where type = 'suggestion' and groupe_id is null and statut not in ('resolu', 'ferme')
    ),
    'tickets', coalesce((
      select jsonb_agg(row order by row.created_at desc)
      from (
        select
          t.id,
          t.numero,
          t.type,
          t.titre,
          t.description,
          t.statut,
          t.resolu_le,
          t.created_at,
          nullif(trim(coalesce(a.prenom, '') || ' ' || coalesce(a.nom, '')), '') as auteur_nom,
          coalesce(a.email, '') as auteur_email,
          (
            select count(*) from public.helpdesk_tickets c
            where c.groupe_id = t.id
          ) as n_lies,
          coalesce((
            select jsonb_agg(jsonb_build_object(
              'id', c.id,
              'numero', c.numero,
              'titre', c.titre,
              'description', c.description,
              'auteur_nom', nullif(trim(coalesce(pa.prenom, '') || ' ' || coalesce(pa.nom, '')), ''),
              'created_at', c.created_at
            ) order by c.created_at)
            from public.helpdesk_tickets c
            left join public.profiles pa on pa.id = c.auteur_id
            where c.groupe_id = t.id
          ), '[]'::jsonb) as lies,
          coalesce((
            select jsonb_agg(jsonb_build_object(
              'message', m.message,
              'created_at', m.created_at,
              'origine', m.origine,
              'interne', m.interne,
              'auteur_nom', nullif(trim(coalesce(pm.prenom, '') || ' ' || coalesce(pm.nom, '')), '')
            ) order by m.created_at)
            from public.helpdesk_suivi m
            left join public.profiles pm on pm.id = m.auteur_id
            where m.ticket_id = t.id
               or m.ticket_id in (select c.id from public.helpdesk_tickets c where c.groupe_id = t.id)
          ), '[]'::jsonb) as messages,
          coalesce((
            select jsonb_agg(jsonb_build_object(
              'id', pe.id,
              'path', pe.path,
              'nom', pe.nom
            ) order by pe.created_at)
            from public.helpdesk_pieces pe
            where pe.ticket_id = t.id
               or pe.ticket_id in (select c.id from public.helpdesk_tickets c where c.groupe_id = t.id)
          ), '[]'::jsonb) as pieces
        from public.helpdesk_tickets t
        left join public.profiles a on a.id = t.auteur_id
        where t.groupe_id is null
      ) row
    ), '[]'::jsonb)
  );
end
$$;

-- Realtime : le volontaire voit le statut changer tout de suite.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'helpdesk_tickets'
  ) then
    execute 'alter publication supabase_realtime add table public.helpdesk_tickets';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'helpdesk_suivi'
  ) then
    execute 'alter publication supabase_realtime add table public.helpdesk_suivi';
  end if;
exception when undefined_object then
  null;
end $$;

-- Cron horaire : ferme les dossiers résolus depuis 48 h.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      perform cron.unschedule('helpdesk-fermer-expires');
    exception when others then
      null;
    end;
    perform cron.schedule(
      'helpdesk-fermer-expires',
      '15 * * * *',
      $cron$ select public.helpdesk_fermer_expires(); $cron$
    );
  end if;
exception when others then
  raise notice 'pg_cron helpdesk: %', sqlerrm;
end $$;

notify pgrst, 'reload schema';
