-- ════════════════════════════════════════════════════════════════════════════
--  Helpdesk : captures d’écran + pièces liées aux tickets.
--  Idempotent. Après 127_webauthn_biometrie.sql.
-- ════════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'helpdesk-captures',
  'helpdesk-captures',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.helpdesk_pieces (
  id         uuid primary key default gen_random_uuid(),
  ticket_id  uuid not null references public.helpdesk_tickets(id) on delete cascade,
  path       text not null,
  nom        text,
  mime       text,
  taille     integer,
  created_at timestamptz not null default now(),
  unique (ticket_id, path)
);

create index if not exists helpdesk_pieces_ticket_idx
  on public.helpdesk_pieces (ticket_id);

alter table public.helpdesk_pieces enable row level security;

drop policy if exists helpdesk_pieces_select on public.helpdesk_pieces;
create policy helpdesk_pieces_select on public.helpdesk_pieces
  for select to authenticated
  using (
    public.peut_gerer_helpdesk()
    or exists (
      select 1 from public.helpdesk_tickets t
      where t.id = ticket_id and t.auteur_id = auth.uid()
    )
  );

grant select on public.helpdesk_pieces to authenticated;

-- Chemin storage : {ticket_id}/{fichier}
create or replace function public._helpdesk_capture_ticket(p_name text)
returns uuid
language plpgsql
immutable
as $$
declare
  id uuid;
begin
  begin
    id := split_part(p_name, '/', 1)::uuid;
  exception when others then
    return null;
  end;
  return id;
end
$$;

drop policy if exists helpdesk_captures_select on storage.objects;
drop policy if exists helpdesk_captures_insert on storage.objects;
drop policy if exists helpdesk_captures_update on storage.objects;
drop policy if exists helpdesk_captures_delete on storage.objects;

create policy helpdesk_captures_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'helpdesk-captures'
    and (
      public.peut_gerer_helpdesk()
      or exists (
        select 1 from public.helpdesk_tickets t
        where t.id = public._helpdesk_capture_ticket(name)
          and t.auteur_id = auth.uid()
      )
    )
  );

create policy helpdesk_captures_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'helpdesk-captures'
    and exists (
      select 1 from public.helpdesk_tickets t
      where t.id = public._helpdesk_capture_ticket(name)
        and t.auteur_id = auth.uid()
    )
  );

create policy helpdesk_captures_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'helpdesk-captures'
    and exists (
      select 1 from public.helpdesk_tickets t
      where t.id = public._helpdesk_capture_ticket(name)
        and t.auteur_id = auth.uid()
    )
  );

create policy helpdesk_captures_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'helpdesk-captures'
    and (
      public.peut_gerer_helpdesk()
      or exists (
        select 1 from public.helpdesk_tickets t
        where t.id = public._helpdesk_capture_ticket(name)
          and t.auteur_id = auth.uid()
      )
    )
  );

create or replace function public.lier_pieces_helpdesk(p_ticket uuid, p_pieces jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auteur uuid;
  piece jsonb;
  v_path text;
  v_nom text;
  v_mime text;
  v_taille integer;
  n integer := 0;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'non autorisé');
  end if;
  select auteur_id into v_auteur from public.helpdesk_tickets where id = p_ticket;
  if v_auteur is null then
    return jsonb_build_object('ok', false, 'error', 'ticket introuvable');
  end if;
  if v_auteur is distinct from auth.uid() and not public.peut_gerer_helpdesk() then
    return jsonb_build_object('ok', false, 'error', 'non autorisé');
  end if;
  if p_pieces is null or jsonb_typeof(p_pieces) <> 'array' then
    return jsonb_build_object('ok', false, 'error', 'pièces invalides');
  end if;
  if jsonb_array_length(p_pieces) > 5 then
    return jsonb_build_object('ok', false, 'error', '5 captures maximum');
  end if;
  for piece in select * from jsonb_array_elements(p_pieces)
  loop
    v_path := nullif(trim(piece->>'path'), '');
    if v_path is null then
      continue;
    end if;
    if split_part(v_path, '/', 1) is distinct from p_ticket::text then
      return jsonb_build_object('ok', false, 'error', 'chemin invalide');
    end if;
    if v_path !~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]+$' then
      return jsonb_build_object('ok', false, 'error', 'chemin invalide');
    end if;
    v_nom := left(coalesce(nullif(trim(piece->>'nom'), ''), 'capture.jpg'), 120);
    v_mime := left(coalesce(nullif(trim(piece->>'mime'), ''), 'image/jpeg'), 80);
    begin
      v_taille := greatest(0, least(8388608, coalesce((piece->>'taille')::integer, 0)));
    exception when others then
      v_taille := 0;
    end;
    insert into public.helpdesk_pieces (ticket_id, path, nom, mime, taille)
    values (p_ticket, v_path, v_nom, v_mime, v_taille)
    on conflict (ticket_id, path) do update
      set nom = excluded.nom,
          mime = excluded.mime,
          taille = excluded.taille;
    n := n + 1;
  end loop;
  return jsonb_build_object('ok', true, 'n', n);
end
$$;

revoke all on function public.lier_pieces_helpdesk(uuid, jsonb) from public, anon;
grant execute on function public.lier_pieces_helpdesk(uuid, jsonb) to authenticated;

-- Remplace mes_tickets / helpdesk_file pour inclure les captures.
create or replace function public.mes_tickets()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
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
stable
security definer
set search_path = public
as $$
begin
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

-- Lecture serveur (edge) : détail d’un bug pour le mail prioritaire.
create or replace function public.helpdesk_bug_pour_mail(p_ticket uuid, p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  t record;
begin
  if p_ticket is null or p_user is null then
    return jsonb_build_object('ok', false, 'error', 'paramètres manquants');
  end if;
  select
    ht.id,
    ht.numero,
    ht.type,
    ht.titre,
    ht.description,
    ht.auteur_id,
    nullif(trim(coalesce(pr.prenom, '') || ' ' || coalesce(pr.nom, '')), '') as auteur_nom,
    coalesce(pr.email, '') as auteur_email
  into t
  from public.helpdesk_tickets ht
  left join public.profiles pr on pr.id = ht.auteur_id
  where ht.id = p_ticket;
  if t.id is null then
    return jsonb_build_object('ok', false, 'error', 'ticket introuvable');
  end if;
  if t.type is distinct from 'bug' then
    return jsonb_build_object('ok', false, 'error', 'réservé aux bugs');
  end if;
  if t.auteur_id is distinct from p_user then
    return jsonb_build_object('ok', false, 'error', 'non autorisé');
  end if;
  return jsonb_build_object(
    'ok', true,
    'id', t.id,
    'numero', t.numero,
    'titre', t.titre,
    'description', t.description,
    'auteur_nom', t.auteur_nom,
    'auteur_email', t.auteur_email,
    'pieces', coalesce((
      select jsonb_agg(jsonb_build_object(
        'path', pe.path,
        'nom', pe.nom,
        'mime', pe.mime
      ) order by pe.created_at)
      from public.helpdesk_pieces pe
      where pe.ticket_id = t.id
    ), '[]'::jsonb)
  );
end
$$;

revoke all on function public.helpdesk_bug_pour_mail(uuid, uuid) from public, anon, authenticated;
grant execute on function public.helpdesk_bug_pour_mail(uuid, uuid) to service_role;

notify pgrst, 'reload schema';
