-- Notifications : toutes les alertes, « Traitée » pour l’équipe (dans l’appli).
-- La montre reçoit la même notification que le téléphone, sans bouton de statut.
-- L’affectation reste personnelle, au moment où l’équipage est publié.

alter table public.notifications
  add column if not exists groupe_id uuid;

create index if not exists notifications_groupe_idx
  on public.notifications (groupe_id)
  where groupe_id is not null;

alter table public.notifications replica identity full;

create table if not exists public.notification_jetons (
  jeton text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  notification_id uuid references public.notifications(id) on delete set null,
  souhait_id uuid,
  groupe_id uuid,
  genre text not null check (genre in ('traiter', 'sur_place', 'en_route')),
  expire timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.notification_jetons enable row level security;
revoke all on public.notification_jetons from public, anon, authenticated;

create extension if not exists pgcrypto;

create or replace function public.notification_est_partagee(p_type text)
returns boolean
language sql
immutable
as $$
  select coalesce(p_type, '') in (
    'demande_souhait', 'equipage_incomplet', 'rapport_materiel', 'peremption_stock',
    'stock_bas', 'oxygene_basse', 'entretien_materiel', 'commande_rappel',
    'ticket_plein', 'protocole_detresse', 'helpdesk_nouveau', 'dispo_retiree',
    'echeance_staff'
  )
$$;

create or replace function public.roles_equipe_notification(p_type text)
returns text[]
language sql
immutable
as $$
  select case p_type
    when 'demande_souhait' then array['recolteur_souhait']
    when 'equipage_incomplet' then array['coord_benevoles','coord_benevoles_adjoint','coord_transport','coord_transport_adjoint']
    when 'rapport_materiel' then array['resp_logistique','resp_logistique_adjoint']
    when 'peremption_stock' then array['resp_logistique','resp_logistique_adjoint']
    when 'stock_bas' then array['resp_logistique','resp_logistique_adjoint']
    when 'oxygene_basse' then array['resp_logistique','resp_logistique_adjoint']
    when 'entretien_materiel' then array['resp_logistique','resp_logistique_adjoint']
    when 'commande_rappel' then array['resp_logistique','resp_logistique_adjoint']
    when 'ticket_plein' then array['tresorier','tresorier_adjoint','president','vice_president']
    when 'protocole_detresse' then array['coord_medical','coord_medical_adjoint','coordinateur_medical']
    when 'helpdesk_nouveau' then array['resp_informatique','resp_informatique_adjoint']
    when 'dispo_retiree' then array['coord_benevoles','coord_benevoles_adjoint']
    when 'echeance_staff' then array['coord_benevoles','coord_benevoles_adjoint']
    else null
  end
$$;

create or replace function public.destinataires_notification(p_type text, p_cibles uuid[] default null)
returns table (id uuid)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  roles text[];
  partage boolean;
begin
  partage := public.notification_est_partagee(p_type);
  roles := public.roles_equipe_notification(p_type);
  return query
  select p.id
  from public.profiles p
  where coalesce(p.actif, true)
    and p.role::text is distinct from 'partenaire'
    and public.pref_notification(p.fiche, p_type)
    and (
      case
        when p_cibles is not null and not partage then p.id = any (p_cibles)
        when roles is not null then
          p.role::text = 'admin'
          or coalesce(p.fiche->'roles_asbl' ?| roles, false)
        when p_type = 'souhait_agenda' then true
        else false
      end
    )
    and (not partage or p.id is distinct from auth.uid());
end
$$;

create or replace function public._poser_jeton_montre(
  p_user uuid,
  p_notif uuid,
  p_souhait uuid,
  p_groupe uuid,
  p_genre text
)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  j text;
begin
  j := encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.notification_jetons (jeton, user_id, notification_id, souhait_id, groupe_id, genre, expire)
  values (j, p_user, p_notif, p_souhait, p_groupe, p_genre, now() + interval '36 hours');
  return j;
end
$$;

revoke all on function public._poser_jeton_montre(uuid, uuid, uuid, uuid, text) from public, anon, authenticated;

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
        and x.created_at > now() - make_interval(mins => minutes)
    ) then
      continue;
    end if;

    insert into public.notifications(destinataire_id, type, titre, message, lien, priorite, ref_id, payload, groupe_id)
      values (dest, p_type, p_titre, p_message, p_lien, p_priorite, p_ref, coalesce(p_payload, '{}'::jsonb), gid)
      returning id into nid;

    ids := ids || nid;
    n := n + 1;
  end loop;

  perform public._declencher_push(ids);
  return n;
end
$$;

create or replace function public.traiter_notification(p_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  g uuid;
  dest uuid;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'error', 'non authentifié');
  end if;
  select groupe_id, destinataire_id into g, dest
  from public.notifications
  where id = p_id;
  if dest is null or dest is distinct from auth.uid() then
    return json_build_object('ok', false, 'error', 'introuvable');
  end if;
  if g is null then
    update public.notifications set lu = true, lu_a = now() where id = p_id;
    return json_build_object('ok', true, 'personnelle', true);
  end if;
  delete from public.notifications where groupe_id = g;
  return json_build_object('ok', true, 'equipe', true);
end
$$;

revoke all on function public.traiter_notification(uuid) from public, anon;
grant execute on function public.traiter_notification(uuid) to authenticated;

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
     and groupe_id is null
     and lu = false
     and (p_ids is null or id = any (p_ids));
  return json_build_object('ok', true);
end
$$;

create or replace function public.montre_appliquer(p_jeton text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  j public.notification_jetons;
begin
  if coalesce(trim(p_jeton), '') = '' then
    return json_build_object('ok', false, 'error', 'jeton vide');
  end if;
  update public.notification_jetons
     set used_at = now()
   where jeton = trim(p_jeton)
     and used_at is null
     and expire > now()
   returning * into j;
  if not found then
    return json_build_object('ok', false, 'error', 'jeton invalide');
  end if;

  -- Ancien bouton « Traitée » encore en cache sur une montre : on retire l’alerte,
  -- on ne touche jamais au statut de mission.
  if j.genre = 'traiter' then
    if j.groupe_id is not null then
      delete from public.notifications where groupe_id = j.groupe_id;
    elsif j.notification_id is not null then
      delete from public.notifications where id = j.notification_id;
    end if;
    return json_build_object('ok', true, 'fait', 'traiter');
  end if;

  return json_build_object('ok', true, 'ignore', j.genre);
end
$$;

revoke all on function public.montre_appliquer(text) from public;
grant execute on function public.montre_appliquer(text) to anon, authenticated;

-- ── Dates d’un souhait ──────────────────────────────────────────────────────
create or replace function public.souhait_croise_plage(s public.souhaits, p0 date, p1 date)
returns boolean
language plpgsql
stable
as $$
declare
  d0 date;
  d1 date;
  e jsonb;
begin
  if p0 is null or p1 is null then return false; end if;
  if s.date_souhaitee is not null then
    d0 := s.date_souhaitee;
    d1 := coalesce(s.date_fin, s.date_souhaitee);
    if d0 <= p1 and d1 >= p0 then return true; end if;
  end if;
  for e in select value from jsonb_array_elements(coalesce(s.dates_possibles, '[]'::jsonb))
  loop
    begin
      d0 := coalesce(nullif(e->>'debut', ''), nullif(e->>'date_debut', ''))::date;
      d1 := coalesce(nullif(e->>'fin', ''), nullif(e->>'date_fin', ''), nullif(e->>'debut', ''), nullif(e->>'date_debut', ''))::date;
      if d0 is not null and d0 <= p1 and coalesce(d1, d0) >= p0 then return true; end if;
    exception when others then
      null;
    end;
  end loop;
  return false;
exception when others then
  return false;
end
$$;

create or replace function public.souhait_commence_le(s public.souhaits, p date)
returns boolean
language plpgsql
stable
as $$
declare
  e jsonb;
  d0 date;
begin
  if p is null then return false; end if;
  if s.date_souhaitee is not null then
    return s.date_souhaitee = p;
  end if;
  for e in select value from jsonb_array_elements(coalesce(s.dates_possibles, '[]'::jsonb))
  loop
    begin
      d0 := coalesce(nullif(e->>'debut', ''), nullif(e->>'date_debut', ''))::date;
      if d0 = p then return true; end if;
    exception when others then
      null;
    end;
  end loop;
  return false;
exception when others then
  return false;
end
$$;

create or replace function public.fiche_date_selection(p jsonb)
returns date
language plpgsql
immutable
as $$
begin
  return nullif(p->'permis'->>'selection_validite', '')::date;
exception when others then
  return null;
end
$$;

-- ── Changement de date, d’heure ou de lieu ──────────────────────────────────
create or replace function public.trg_changement_souhait_notif()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cibles uuid[];
  msg text;
begin
  if coalesce(new.fictif, false) then return new; end if;
  if coalesce(new.mission->>'demo_cle', '') <> '' then return new; end if;
  if new.date_souhaitee is not distinct from old.date_souhaitee
     and new.date_fin is not distinct from old.date_fin
     and new.dates_possibles is not distinct from old.dates_possibles
     and new.localisation is not distinct from old.localisation
     and new.heure_depart is not distinct from old.heure_depart
     and new.heure_retour is not distinct from old.heure_retour then
    return new;
  end if;
  select coalesce(array_agg(sp.user_id), '{}') into cibles
  from public.souhait_personnel sp
  where sp.souhait_id = new.id and coalesce(sp.publie, true);
  if cardinality(cibles) = 0 then return new; end if;
  msg := trim(both ' · ' from
    public.fmt_dates_souhait(new)
    || coalesce(' · ' || to_char(new.heure_depart, 'HH24:MI'), '')
    || coalesce(' · ' || nullif(new.localisation, ''), '')
  );
  perform public.notifier_evenement(
    'changement_souhait',
    'Votre souhait a changé',
    msg,
    '/app/missions/' || new.id::text,
    'haute',
    cibles,
    new.id,
    jsonb_build_object('souhait_id', new.id, 'dedup_minutes', 10)
  );
  return new;
end
$$;

drop trigger if exists trg_changement_souhait_notif on public.souhaits;
create trigger trg_changement_souhait_notif
  after update of date_souhaitee, date_fin, dates_possibles, localisation, heure_depart, heure_retour
  on public.souhaits
  for each row execute function public.trg_changement_souhait_notif();

-- ── Annulé ou non réalisé : le volontaire est prévenu, sa dispo reste ──────
create or replace function public.trg_liberation_souhait_notif()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cibles uuid[];
begin
  if new.statut is not distinct from old.statut then return new; end if;
  if coalesce(new.statut::text, '') not in ('annule', 'non_realise') then return new; end if;
  if coalesce(new.fictif, false) then return new; end if;
  if coalesce(new.mission->>'demo_cle', '') <> '' then return new; end if;
  select coalesce(array_agg(sp.user_id), '{}') into cibles
  from public.souhait_personnel sp
  where sp.souhait_id = new.id and coalesce(sp.publie, true);
  if cardinality(cibles) = 0 then return new; end if;
  perform public.notifier_evenement(
    'liberation_souhait',
    case when new.statut::text = 'annule' then 'Souhait annulé' else 'Souhait non réalisé' end,
    public.fmt_dates_souhait(new) || ' · vous êtes libéré, votre disponibilité reste.',
    '/app/missions',
    'haute',
    cibles,
    new.id,
    jsonb_build_object('souhait_id', new.id, 'sans_dedup', true)
  );
  return new;
end
$$;

drop trigger if exists trg_liberation_souhait_notif on public.souhaits;
create trigger trg_liberation_souhait_notif
  after update of statut on public.souhaits
  for each row execute function public.trg_liberation_souhait_notif();

-- ── Disponibilité retirée alors que la personne est affectée ───────────────
create or replace function public.trg_dispo_retiree_notif()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  qui text;
  s public.souhaits;
  touche boolean;
  uid uuid;
begin
  uid := old.user_id;
  select nullif(trim(coalesce(p.prenom, '') || ' ' || coalesce(p.nom, '')), '')
    into qui
  from public.profiles p where p.id = uid;
  for s in
    select so.*
    from public.souhaits so
    join public.souhait_personnel sp on sp.souhait_id = so.id
    where sp.user_id = uid
      and coalesce(sp.publie, true)
      and coalesce(so.fictif, false) = false
      and coalesce(so.mission->>'demo_cle', '') = ''
      and so.statut::text not in ('annule', 'non_realise', 'realise')
  loop
    if tg_op = 'DELETE' then
      touche := public.souhait_croise_plage(s, old.date_debut, old.date_fin);
    else
      touche := public.souhait_croise_plage(s, old.date_debut, old.date_fin)
            and not public.souhait_croise_plage(s, new.date_debut, new.date_fin);
    end if;
    if touche then
      perform public.notifier_evenement(
        'dispo_retiree',
        'Disponibilité retirée',
        coalesce(qui, 'Un volontaire') || ' n’est plus disponible · ' || public.fmt_dates_souhait(s) || '.',
        '/app/disponibilites',
        'haute',
        null,
        s.id,
        jsonb_build_object('souhait_id', s.id, 'user_id', uid, 'sans_dedup', true)
      );
    end if;
  end loop;
  return coalesce(new, old);
end
$$;

drop trigger if exists trg_dispo_retiree_notif on public.disponibilites;
create trigger trg_dispo_retiree_notif
  after delete or update of date_debut, date_fin
  on public.disponibilites
  for each row execute function public.trg_dispo_retiree_notif();

-- ── Helpdesk ────────────────────────────────────────────────────────────────
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
  perform public.notifier_evenement(
    'helpdesk_nouveau',
    case when p_type = 'bug' then 'Nouveau bug' else 'Nouvelle suggestion' end,
    left(v_titre, 180),
    '/app/it/helpdesk',
    'normale',
    null,
    v_id,
    jsonb_build_object('ticket_id', v_id)
  );
  return jsonb_build_object('ok', true, 'id', v_id, 'numero', v_num);
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
  if p_statut not in ('ouvert', 'en_cours', 'resolu', 'ferme') then
    return jsonb_build_object('ok', false, 'error', 'statut inconnu');
  end if;
  select coalesce(groupe_id, id) into v_id from public.helpdesk_tickets where id = p_id;
  if v_id is null then
    return jsonb_build_object('ok', false, 'error', 'ticket introuvable');
  end if;
  update public.helpdesk_tickets set statut = p_statut where id = v_id;
  if p_statut in ('resolu', 'ferme') then
    select auteur_id, titre into v_auteur, v_titre from public.helpdesk_tickets where id = v_id;
    if v_auteur is not null then
      perform public.notifier_evenement(
        'helpdesk_reponse',
        case when p_statut = 'resolu' then 'Demande résolue' else 'Demande fermée' end,
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

-- Ticket de plein et protocole : même envoi, avec le groupe d’équipe.
create or replace function public.notifier_ticket_plein(p_souhait uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.souhaits;
  n int;
begin
  if public.est_souhait_demo(p_souhait) then
    return json_build_object('ok', true, 'demo', true, 'envoyes', 0);
  end if;
  if not public.suis_affecte(p_souhait) then
    return json_build_object('ok', false, 'error', 'non affecté');
  end if;
  select * into s from public.souhaits where id = p_souhait;
  if not found then return json_build_object('ok', false, 'error', 'introuvable'); end if;
  n := public.notifier_evenement(
    'ticket_plein',
    'Ticket de plein à contrôler',
    coalesce(s.beneficiaire_prenom, 'Mission') || ' — le ticket du plein du matin est encodé.',
    '/app/souhaits/' || p_souhait::text,
    'normale',
    null,
    p_souhait,
    jsonb_build_object('souhait_id', p_souhait, 'dedup_minutes', 720)
  );
  return json_build_object('ok', true, 'envoyes', n);
end
$$;

create or replace function public.notifier_protocole_detresse(p_souhait uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.souhaits;
  n int;
begin
  if public.est_souhait_demo(p_souhait) then
    return json_build_object('ok', true, 'demo', true, 'envoyes', 0);
  end if;
  if not public.dar_auteur_medical(p_souhait) then
    return json_build_object('ok', false, 'error', 'réservé au médical');
  end if;
  select * into s from public.souhaits where id = p_souhait;
  if not found then return json_build_object('ok', false, 'error', 'introuvable'); end if;
  n := public.notifier_evenement(
    'protocole_detresse',
    'Protocole de détresse',
    'Protocole de détresse utilisé — ' || coalesce(s.beneficiaire_prenom, 'mission') || '. Ouvrez le rapport médical.',
    '/app/souhaits/' || p_souhait::text,
    'haute',
    null,
    p_souhait,
    jsonb_build_object('souhait_id', p_souhait, 'dedup_minutes', 2)
  );
  return json_build_object('ok', true, 'envoyes', n);
end
$$;

-- ── Digest du matin : rappel, échéances, équipage, oxygène, entretien, commandes
create or replace function public.notifier_digest_notifications()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.souhaits;
  cibles uuid[];
  qui text;
  lignes text;
  n int := 0;
  dsel date;
  p record;
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
      trim(both ' · ' from public.fmt_dates_souhait(s)
        || coalesce(' · ' || to_char(s.heure_depart, 'HH24:MI'), '')
        || coalesce(' · ' || nullif(s.localisation, ''), '')
        || coalesce(' · ' || nullif(s.beneficiaire_prenom, ''), '')),
      '/app/missions/' || s.id::text,
      'normale',
      cibles,
      s.id,
      jsonb_build_object('souhait_id', s.id, 'dedup_minutes', 1200)
    );
    n := n + 1;
  end loop;

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

notify pgrst, 'reload schema';
