-- Date de parution : un article publié dans le futur reste invisible
-- jusqu’à cette date. Le helpdesk sépare les bugs et les suggestions.
-- Une fusion reste invisible pour les auteurs : pas d’autres noms, pas de compteur.

drop policy if exists actualites_select on public.actualites;
create policy actualites_select on public.actualites
  for select to authenticated
  using (
    public.is_staff()
    and (
      public.peut_publier_actualites()
      or (
        statut = 'publie'
        and (publie_le is null or publie_le <= now())
      )
    )
  );

create or replace function public.peut_gerer_helpdesk()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (
        p.role::text = 'admin'
        or coalesce(p.fiche->'roles_asbl' ?| array['resp_informatique', 'resp_informatique_adjoint'], false)
      )
  );
$$;

grant execute on function public.peut_gerer_helpdesk() to authenticated;

create table if not exists public.helpdesk_tickets (
  id          uuid primary key default gen_random_uuid(),
  numero      integer not null,
  type        text not null check (type in ('bug', 'suggestion')),
  titre       text not null,
  description text not null,
  statut      text not null default 'ouvert' check (statut in ('ouvert', 'en_cours', 'resolu', 'ferme')),
  auteur_id   uuid not null references public.profiles(id) on delete cascade,
  groupe_id   uuid references public.helpdesk_tickets(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (type, numero)
);

create index if not exists helpdesk_tickets_auteur_idx on public.helpdesk_tickets (auteur_id, created_at desc);
create index if not exists helpdesk_tickets_groupe_idx on public.helpdesk_tickets (groupe_id);

drop trigger if exists trg_helpdesk_tickets_updated on public.helpdesk_tickets;
create trigger trg_helpdesk_tickets_updated before update on public.helpdesk_tickets
  for each row execute function public.set_updated_at();

create table if not exists public.helpdesk_suivi (
  id         uuid primary key default gen_random_uuid(),
  ticket_id  uuid not null references public.helpdesk_tickets(id) on delete cascade,
  auteur_id  uuid references public.profiles(id) on delete set null,
  message    text not null,
  origine    text not null check (origine in ('auteur', 'informatique')),
  interne    boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists helpdesk_suivi_ticket_idx on public.helpdesk_suivi (ticket_id, created_at);

alter table public.helpdesk_tickets enable row level security;
alter table public.helpdesk_suivi enable row level security;

drop policy if exists helpdesk_tickets_select on public.helpdesk_tickets;
create policy helpdesk_tickets_select on public.helpdesk_tickets
  for select to authenticated
  using (auteur_id = auth.uid() or public.peut_gerer_helpdesk());

drop policy if exists helpdesk_suivi_select on public.helpdesk_suivi;
create policy helpdesk_suivi_select on public.helpdesk_suivi
  for select to authenticated
  using (
    public.peut_gerer_helpdesk()
    or (
      interne = false
      and (
        auteur_id = auth.uid()
        or (
          origine = 'informatique'
          and ticket_id in (
            select coalesce(t.groupe_id, t.id)
            from public.helpdesk_tickets t
            where t.auteur_id = auth.uid()
          )
        )
      )
    )
  );

grant select on public.helpdesk_tickets to authenticated;
grant select on public.helpdesk_suivi to authenticated;

create or replace function public.deposer_ticket(p_type text, p_titre text, p_description text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_num integer;
  v_titre text := nullif(trim(p_titre), '');
  v_desc text := nullif(trim(p_description), '');
begin
  if auth.uid() is null or not public.is_staff() then
    return jsonb_build_object('ok', false, 'error', 'non autorisé');
  end if;
  if p_type not in ('bug', 'suggestion') or v_titre is null or v_desc is null then
    return jsonb_build_object('ok', false, 'error', 'titre et description requis');
  end if;
  select coalesce(max(numero), 0) + 1 into v_num
  from public.helpdesk_tickets where type = p_type;
  insert into public.helpdesk_tickets (numero, type, titre, description, auteur_id)
  values (v_num, p_type, left(v_titre, 180), left(v_desc, 4000), auth.uid())
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id, 'numero', v_num);
end
$$;

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
        ), '[]'::jsonb) as messages
      from public.helpdesk_tickets t
      left join public.helpdesk_tickets p on p.id = t.groupe_id
      where t.auteur_id = auth.uid()
    ) x
  ), '[]'::jsonb);
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
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'non autorisé');
  end if;
  if v_msg is null then
    return jsonb_build_object('ok', false, 'error', 'message vide');
  end if;
  if not exists (
    select 1 from public.helpdesk_tickets
    where id = p_id and auteur_id = auth.uid()
  ) then
    return jsonb_build_object('ok', false, 'error', 'ticket introuvable');
  end if;
  insert into public.helpdesk_suivi (ticket_id, auteur_id, message, origine, interne)
  values (p_id, auth.uid(), left(v_msg, 2000), 'auteur', false);
  return jsonb_build_object('ok', true);
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
          ), '[]'::jsonb) as messages
        from public.helpdesk_tickets t
        left join public.profiles a on a.id = t.auteur_id
        where t.groupe_id is null
      ) row
    ), '[]'::jsonb)
  );
end
$$;

create or replace function public.helpdesk_statut(p_id uuid, p_statut text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.peut_gerer_helpdesk() then
    return jsonb_build_object('ok', false, 'error', 'réservé à l’informatique');
  end if;
  if p_statut not in ('ouvert', 'en_cours', 'resolu', 'ferme') then
    return jsonb_build_object('ok', false, 'error', 'statut inconnu');
  end if;
  select coalesce(groupe_id, id) into v_id from public.helpdesk_tickets where id = p_id;
  if v_id is null then
    return jsonb_build_object('ok', false, 'error', 'ticket introuvable');
  end if;
  update public.helpdesk_tickets set statut = p_statut where id = v_id;
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
begin
  if not public.peut_gerer_helpdesk() then
    return jsonb_build_object('ok', false, 'error', 'réservé à l’informatique');
  end if;
  if v_msg is null then
    return jsonb_build_object('ok', false, 'error', 'message vide');
  end if;
  select coalesce(groupe_id, id) into v_id from public.helpdesk_tickets where id = p_id;
  if v_id is null then
    return jsonb_build_object('ok', false, 'error', 'ticket introuvable');
  end if;
  insert into public.helpdesk_suivi (ticket_id, auteur_id, message, origine, interne)
  values (v_id, auth.uid(), left(v_msg, 2000), 'informatique', coalesce(p_interne, false));
  return jsonb_build_object('ok', true);
end
$$;

create or replace function public.helpdesk_fusionner(p_principal uuid, p_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text;
  v_root uuid;
begin
  if not public.peut_gerer_helpdesk() then
    return jsonb_build_object('ok', false, 'error', 'réservé à l’informatique');
  end if;
  select coalesce(groupe_id, id), type into v_root, v_type
  from public.helpdesk_tickets where id = p_principal;
  if v_root is null then
    return jsonb_build_object('ok', false, 'error', 'ticket introuvable');
  end if;
  if exists (
    select 1 from public.helpdesk_tickets
    where id = any(p_ids) and type is distinct from v_type
  ) then
    return jsonb_build_object('ok', false, 'error', 'on ne fusionne pas un bug avec une suggestion');
  end if;
  update public.helpdesk_tickets
     set groupe_id = v_root
   where id = any(p_ids)
     and id <> v_root
     and type = v_type;
  update public.helpdesk_tickets
     set groupe_id = v_root
   where groupe_id = any(p_ids)
     and groupe_id is distinct from v_root;
  return jsonb_build_object('ok', true);
end
$$;

grant execute on function public.deposer_ticket(text, text, text) to authenticated;
grant execute on function public.mes_tickets() to authenticated;
grant execute on function public.commenter_mon_ticket(uuid, text) to authenticated;
grant execute on function public.helpdesk_file() to authenticated;
grant execute on function public.helpdesk_statut(uuid, text) to authenticated;
grant execute on function public.helpdesk_note(uuid, text, boolean) to authenticated;
grant execute on function public.helpdesk_fusionner(uuid, uuid[]) to authenticated;

notify pgrst, 'reload schema';
