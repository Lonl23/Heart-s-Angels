-- Menu mission : DAR, contacts, plein partiel, formation individuelle,
-- notifications (plein, détresse), trace des envois du rapport médical,
-- statistiques des souhaits. Après 95 (enum terminee_terrain).

-- ── Étape « départ pour aller faire le plein » ──────────────────────────────
create or replace function public.etape_terrain_ok(p_etape text)
returns boolean language sql immutable as $$
  select public.normaliser_etape_terrain(p_etape) in (
    'a_la_base',
    'depart_plein',
    'depart_pec', 'pec_sur_place',
    'depart_dest', 'dest_sur_place',
    'depart_retour', 'retour_sur_place',
    'depart_base', 'base_rentre'
  )
  or public.normaliser_etape_terrain(p_etape) ~* '^(depart_lieu|lieu_sur_place):(hotel|parking|restaurant|autre):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
$$;

-- ── Formation : une session par compte, jamais le dossier partagé ───────────
create table if not exists public.formation_sessions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  souhait_id uuid not null references public.souhaits(id) on delete cascade,
  etat jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, souhait_id)
);

alter table public.formation_sessions enable row level security;

drop policy if exists formation_sessions_soi on public.formation_sessions;
create policy formation_sessions_soi on public.formation_sessions
  for select to authenticated
  using (user_id = auth.uid());

create or replace function public._formation_lire(p_souhait uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select etat from public.formation_sessions where user_id = auth.uid() and souhait_id = p_souhait),
    '{}'::jsonb
  )
$$;

create or replace function public._formation_ecrire(p_souhait uuid, p_etat jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.formation_sessions (user_id, souhait_id, etat, updated_at)
  values (auth.uid(), p_souhait, coalesce(p_etat, '{}'::jsonb), now())
  on conflict (user_id, souhait_id) do update
    set etat = excluded.etat, updated_at = now();
end
$$;

create or replace function public._photo_dans(
  p_photos jsonb, p_slot text, p_meta jsonb, p_action text
)
returns jsonb
language plpgsql
immutable
as $$
declare
  photos jsonb := coalesce(p_photos, '{}'::jsonb);
  coins text[] := array['avant','arriere','gauche','droit','avant_gauche','avant_droit','arriere_gauche','arriere_droit'];
  arr jsonb;
  i int;
  found boolean := false;
  coin_key text;
begin
  if p_slot = any(coins) then
    return public._jsonb_set_path(photos, array['coins', p_slot], coalesce(p_meta, 'null'::jsonb));
  elsif p_slot in ('ticket_carburant', 'ticket_carburant_matin') then
    return public._jsonb_set_path(photos, array[p_slot], coalesce(p_meta, 'null'::jsonb));
  elsif p_slot like 'r\_%' escape '\' then
    coin_key := substr(p_slot, 3);
    if not (coin_key = any(coins)) then
      return photos;
    end if;
    return public._jsonb_set_path(photos, array['coins_retour', coin_key], coalesce(p_meta, 'null'::jsonb));
  end if;
  arr := coalesce(photos->p_slot, '[]'::jsonb);
  if jsonb_typeof(arr) <> 'array' then arr := '[]'::jsonb; end if;
  if p_action = 'add' then
    arr := arr || jsonb_build_array(p_meta);
  elsif p_action = 'delete' then
    arr := coalesce((
      select jsonb_agg(x) from jsonb_array_elements(arr) x
      where x->>'id' is distinct from p_meta->>'id'
    ), '[]'::jsonb);
  else
    for i in 0 .. jsonb_array_length(arr) - 1 loop
      if (arr -> i) ->> 'id' = p_meta->>'id' then
        arr := jsonb_set(arr, array[i::text], p_meta, false);
        found := true;
      end if;
    end loop;
    if not found then arr := arr || jsonb_build_array(p_meta); end if;
  end if;
  return public._jsonb_set_path(photos, array[p_slot], arr);
end
$$;

create or replace function public.formation_appliquer(
  p_souhait uuid,
  p_op text,
  p_a text default null,
  p_b text default null,
  p_flag boolean default null,
  p_meta jsonb default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  e jsonb;
  checks jsonb;
  photos jsonb;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'error', 'non authentifié');
  end if;
  if not public.est_souhait_demo(p_souhait) then
    return json_build_object('ok', false, 'error', 'pas une formation');
  end if;
  if not public.suis_affecte(p_souhait) then
    return json_build_object('ok', false, 'error', 'non affecté');
  end if;
  e := public._formation_lire(p_souhait);

  if p_op = 'lire' then
    return json_build_object('ok', true, 'etat', e);
  elsif p_op = 'reset' then
    delete from public.formation_sessions where user_id = auth.uid() and souhait_id = p_souhait;
    return json_build_object('ok', true, 'etat', '{}'::jsonb);
  elsif p_op = 'etape' then
    if not public.etape_terrain_ok(p_a) then
      return json_build_object('ok', false, 'error', 'étape interdite');
    end if;
    e := e || jsonb_build_object('etape', public.normaliser_etape_terrain(p_a));
  elsif p_op = 'cocher' then
    if p_a not in ('base', 'retour_base', 'pec', 'retour_pec') then
      return json_build_object('ok', false, 'error', 'section interdite');
    end if;
    checks := coalesce(e->'checks', '{}'::jsonb);
    checks := public._jsonb_set_path(checks, array[p_a, p_b], to_jsonb(coalesce(p_flag, false)));
    e := public._jsonb_set_path(e, array['checks'], checks);
  elsif p_op = 'photo' then
    photos := public._photo_dans(coalesce(e->'photos', '{}'::jsonb), p_a, p_meta, coalesce(p_b, 'set'));
    e := public._jsonb_set_path(e, array['photos'], photos);
  elsif p_op = 'releves' then
    e := public._jsonb_set_path(e, array['releves'], coalesce(e->'releves', '{}'::jsonb) || coalesce(p_meta, '{}'::jsonb));
  elsif p_op = 'plaque' then
    e := e || jsonb_build_object('plaque', coalesce(p_a, ''));
  elsif p_op = 'noter' then
    e := e || jsonb_build_object('observations', coalesce(p_a, ''));
  elsif p_op = 'patch' then
    if p_a = 'injections_detresse' and coalesce(p_b, 'set') = 'append' then
      e := public._jsonb_set_path(
        e, array['injections'],
        coalesce(e->'injections', '[]'::jsonb) || jsonb_build_array(coalesce(p_meta, '{}'::jsonb))
      );
    elsif p_a = 'rapport_medical' then
      e := e || jsonb_build_object('rapport_medical', coalesce(p_meta #>> '{}', p_meta->>0, ''));
    elsif p_a = 'rapport_observations' then
      e := e || jsonb_build_object('observations', coalesce(p_meta #>> '{}', ''));
    else
      return json_build_object('ok', false, 'error', 'clé interdite');
    end if;
  elsif p_op = 'statut_base' then
    e := e || jsonb_build_object('statut_base', coalesce(p_a, ''));
  elsif p_op = 'avancer' then
    if p_a = 'en_cours' then
      e := e || jsonb_build_object('statut', 'en_cours', 'vecteur_statut', 'en_cours');
      if coalesce(p_b, '') <> '' then
        e := e || jsonb_build_object('etape', public.normaliser_etape_terrain(p_b));
      end if;
    elsif p_a = 'realise' then
      e := e || jsonb_build_object(
        'statut', 'terminee_terrain',
        'vecteur_statut', 'terminee_terrain',
        'etape', 'base_rentre'
      );
    else
      return json_build_object('ok', false, 'error', 'statut interdit');
    end if;
  else
    return json_build_object('ok', false, 'error', 'opération inconnue');
  end if;

  perform public._formation_ecrire(p_souhait, e);
  return json_build_object(
    'ok', true,
    'etat', e,
    'etape', e->>'etape',
    'statut', coalesce(e->>'statut', 'pret'),
    'vecteur_statut', e->>'vecteur_statut',
    'vecteur_id', null
  );
end
$$;

revoke all on function public.formation_appliquer(uuid, text, text, text, boolean, jsonb) from public;
grant execute on function public.formation_appliquer(uuid, text, text, text, boolean, jsonb) to authenticated;

create or replace function public.lire_session_formation(p_souhait uuid)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.est_souhait_demo(p_souhait) then
    return json_build_object('ok', true, 'demo', false, 'etat', '{}'::jsonb);
  end if;
  if not (public.suis_affecte(p_souhait) or public.is_staff()) then
    return json_build_object('ok', false, 'error', 'non autorisé');
  end if;
  return json_build_object('ok', true, 'demo', true, 'etat', public._formation_lire(p_souhait));
end
$$;

grant execute on function public.lire_session_formation(uuid) to authenticated;

create or replace function public.mes_sessions_formation()
returns table(souhait_id uuid, statut text, etape text)
language sql
stable
security definer
set search_path = public
as $$
  select
    fs.souhait_id,
    coalesce(nullif(fs.etat->>'statut', ''), 'pret'),
    coalesce(nullif(fs.etat->>'etape', ''), 'a_la_base')
  from public.formation_sessions fs
  where fs.user_id = auth.uid()
$$;

grant execute on function public.mes_sessions_formation() to authenticated;

-- Rejouer : uniquement la session du compte connecté. Le dossier partagé ne bouge pas.
create or replace function public.recommencer_mission_demo(p_souhait uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.est_souhait_demo(p_souhait) then
    return json_build_object('ok', false, 'error', 'pas une mission de formation');
  end if;
  if not (public.suis_affecte(p_souhait) or public.is_staff()) then
    return json_build_object('ok', false, 'error', 'non autorisé');
  end if;
  delete from public.formation_sessions
   where user_id = auth.uid() and souhait_id = p_souhait;
  return json_build_object('ok', true, 'statut', 'pret');
end
$$;

comment on function public.recommencer_mission_demo(uuid) is
  'Remet à zéro la session de formation du compte connecté. Les autres comptes et le dossier partagé ne changent pas.';

-- Le dossier de formation partagé ne garde plus l’avancement d’un compte.
update public.souhaits
   set statut = 'pret',
       date_realisee = null,
       mission = public.nettoyer_execution_mission_demo(coalesce(mission, '{}'::jsonb)) - 'rapport_observations'
 where coalesce(fictif, false)
   and coalesce(mission->>'demo_cle', '') <> ''
   and statut::text in ('en_cours', 'realise', 'terminee_terrain');

-- ── Retour base = terminée terrain, pas une clôture ─────────────────────────
create or replace function public.avancer_mission(p_souhait uuid, p_statut text)
returns json language plpgsql security definer set search_path = public as $$
declare
  s public.souhaits;
  m jsonb;
  vid text;
  maintenant text := to_char(now() at time zone 'Europe/Brussels', 'YYYY-MM-DD"T"HH24:MI');
  iso text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  vids text[];
  x text;
  tous_rentes boolean := true;
  wish_statut text;
  est_demo boolean := false;
  vec_ferme boolean := false;
  marque text;
begin
  if p_statut not in ('en_cours', 'realise') then
    return json_build_object('ok', false, 'error', 'statut interdit');
  end if;
  if public.est_souhait_demo(p_souhait) then
    return public.formation_appliquer(p_souhait, 'avancer', p_statut, null, null, null);
  end if;
  if not (public.suis_affecte(p_souhait) or public.peut_voir_souhaits()) then
    return json_build_object('ok', false, 'error', 'non autorisé');
  end if;
  select * into s from public.souhaits where id = p_souhait for update;
  if not found then return json_build_object('ok', false, 'error', 'introuvable'); end if;
  est_demo := false;

  if s.statut::text = 'non_realise' then
    return json_build_object('ok', false, 'error', 'souhait non réalisé');
  end if;
  if s.statut::text = 'realise' then
    return json_build_object('ok', false, 'error', 'mission déjà clôturée');
  end if;
  if p_statut = 'en_cours' and s.statut::text = 'terminee_terrain' then
    return json_build_object('ok', false, 'error', 'terrain déjà terminé');
  end if;

  m := coalesce(s.mission, '{}'::jsonb);
  vid := public.vid_session_terrain(p_souhait, m);

  if p_statut = 'en_cours' then
    if vid is not null then
      m := public._jsonb_set_path(m, array['vecteur_statuts', vid], to_jsonb('en_cours'::text));
    end if;
    if m->>'demarre_le' is null then
      m := public._jsonb_set_path(m, array['demarre_le'], to_jsonb(maintenant));
    end if;
    update public.souhaits set statut = 'en_cours', mission = m where id = p_souhait;
    return json_build_object('ok', true, 'statut', 'en_cours', 'vecteur_statut', 'en_cours', 'vecteur_id', vid);
  end if;

  -- Le retour base marque le véhicule « terminée terrain ». Le personnel clôture plus tard.
  marque := 'terminee_terrain';
  if vid is not null then
    m := public._jsonb_set_path(m, array['vecteur_statuts', vid], to_jsonb(marque));
    m := public._jsonb_set_path(m, array['vecteur_etapes', vid], to_jsonb('base_rentre'::text));
    m := public._jsonb_set_path(m, array['etape_terrain'], to_jsonb('base_rentre'::text));
    m := public._jsonb_set_path(m, array['vecteur_clotures', vid], to_jsonb(maintenant));
    m := public._marquer_heure_etape(m, vid, 'base_rentre', iso);
  end if;

  select coalesce(array_agg(distinct nullif(vecteur_id, '')), '{}'::text[])
    into vids
    from public.souhait_personnel
    where souhait_id = p_souhait and nullif(vecteur_id, '') is not null;

  if (vids is null or vids = '{}'::text[]) and vid is not null then
    vids := array[vid];
  end if;

  if vids is null or vids = '{}'::text[] then
    tous_rentes := true;
  else
    foreach x in array vids loop
      if coalesce(m->'vecteur_statuts'->>x, '') not in ('realise', 'terminee_terrain') then
        tous_rentes := false;
      end if;
    end loop;
  end if;

  if tous_rentes then
    m := public._jsonb_set_path(m, array['terrain_termine_le'], to_jsonb(maintenant));
    update public.souhaits set statut = 'terminee_terrain', mission = m where id = p_souhait;
    wish_statut := 'terminee_terrain';
  else
    if s.statut::text is distinct from 'en_cours' and s.statut::text is distinct from 'terminee_terrain' then
      update public.souhaits set statut = 'en_cours', mission = m where id = p_souhait;
      wish_statut := 'en_cours';
    else
      update public.souhaits set mission = m where id = p_souhait;
      wish_statut := s.statut::text;
    end if;
  end if;

  return json_build_object(
    'ok', true,
    'statut', wish_statut,
    'vecteur_statut', case when vid is null and tous_rentes then 'terminee_terrain' else coalesce(m->'vecteur_statuts'->>vid, 'terminee_terrain') end,
    'vecteur_id', vid
  );
end $$;

-- Les écritures terrain d’une formation restent dans la session du compte.
create or replace function public.set_etape_terrain(p_souhait uuid, p_etape text)
returns json language plpgsql security definer set search_path = public as $$
declare
  m jsonb;
  vid text;
  e text;
  lieu_id text;
  etape_prec text;
  iso text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
begin
  if public.est_souhait_demo(p_souhait) then
    return public.formation_appliquer(p_souhait, 'etape', p_etape, null, null, null);
  end if;
  if not public.suis_affecte(p_souhait) then
    return json_build_object('ok', false, 'error', 'non affecté');
  end if;
  e := public.normaliser_etape_terrain(p_etape);
  if not public.etape_terrain_ok(e) then
    return json_build_object('ok', false, 'error', 'étape interdite');
  end if;
  select coalesce(mission, '{}'::jsonb) into m from public.souhaits where id = p_souhait for update;
  if e ~* '^(depart_lieu|lieu_sur_place):' then
    lieu_id := split_part(e, ':', 3);
    if not exists (
      select 1
      from jsonb_array_elements(coalesce(m->'lieux_annexes', '[]'::jsonb)) x
      where x->>'id' = lieu_id
    ) then
      return json_build_object('ok', false, 'error', 'lieu inconnu');
    end if;
  end if;
  vid := public.vid_session_terrain(p_souhait, m);
  if vid is not null then
    etape_prec := coalesce(nullif(m->'vecteur_etapes'->>vid, ''), m->>'etape_terrain');
    if etape_prec is not null and etape_prec <> e then
      m := public._jsonb_set_path(m, array['vecteur_etape_prec', vid], to_jsonb(etape_prec));
    end if;
  end if;
  m := public._jsonb_set_path(m, array['etape_terrain'], to_jsonb(e));
  if vid is not null then
    m := public._jsonb_set_path(m, array['vecteur_etapes', vid], to_jsonb(e));
    m := public._marquer_heure_etape(m, vid, e, iso);
  end if;
  update public.souhaits set mission = m where id = p_souhait;
  return json_build_object('ok', true, 'vecteur_id', vid, 'etape', e);
end $$;

create or replace function public.cocher_terrain(
  p_souhait uuid, p_section text, p_item text, p_val boolean
)
returns json language plpgsql security definer set search_path = public as $$
declare
  m jsonb;
  sp public.souhait_personnel;
  vid text;
  moi_med boolean;
  vec_med boolean;
  a_sp boolean;
begin
  if not public.suis_affecte(p_souhait) then
    return json_build_object('ok', false, 'error', 'non affecté');
  end if;
  if p_section not in ('base', 'retour_base', 'pec', 'retour_pec') then
    return json_build_object('ok', false, 'error', 'section interdite');
  end if;
  select * into sp from public.souhait_personnel
    where souhait_id = p_souhait and user_id = auth.uid() limit 1;
  a_sp := found;
  select coalesce(mission, '{}'::jsonb) into m from public.souhaits where id = p_souhait for update;
  vid := public.vid_session_terrain(p_souhait, m);

  if public.item_checklist_est_medical(p_section, p_item) then
    select public.profil_est_medical(
      p.role::text,
      coalesce(p.fiche, '{}'::jsonb),
      case when a_sp then sp.role_mission else null end
    )
      into moi_med
      from public.profiles p where p.id = auth.uid();
    vec_med := public.vecteur_a_medical(p_souhait, vid);
    if not coalesce(moi_med, false) or not vec_med then
      return json_build_object('ok', false, 'error', 'checklist médicale : réservée au médical de ce véhicule');
    end if;
  end if;

  if public.est_souhait_demo(p_souhait) then
    return public.formation_appliquer(p_souhait, 'cocher', p_section, p_item, p_val, null);
  end if;

  m := public._jsonb_set_path(m, array['checklists', p_section, p_item], to_jsonb(p_val));
  if vid is not null then
    m := public._jsonb_set_path(m, array['vecteur_checklists', vid, p_section, p_item], to_jsonb(p_val));
  end if;
  update public.souhaits set mission = m where id = p_souhait;
  return json_build_object('ok', true);
end $$;

create or replace function public.sauver_photo_terrain(
  p_souhait uuid, p_vecteur text, p_slot text, p_meta jsonb, p_action text default 'set'
)
returns json language plpgsql security definer set search_path = public as $$
declare
  m jsonb;
  coins text[] := array['avant','arriere','gauche','droit','avant_gauche','avant_droit','arriere_gauche','arriere_droit'];
  extras text[] := array['pec','retour_pec','retour_base','ticket_carburant','ticket_carburant_matin','photos_supp'];
  arr jsonb;
  i int;
  found boolean := false;
  coin_key text;
begin
  if public.est_souhait_demo(p_souhait) then
    return public.formation_appliquer(p_souhait, 'photo', p_slot, p_action, null, p_meta);
  end if;
  if not public.suis_affecte(p_souhait) then
    return json_build_object('ok', false, 'error', 'non affecté');
  end if;
  if p_vecteur is null or p_vecteur = '' then
    return json_build_object('ok', false, 'error', 'vecteur requis');
  end if;
  if not (p_slot = any(coins) or p_slot = any(extras) or p_slot like 'r\_%' escape '\') then
    return json_build_object('ok', false, 'error', 'slot interdit');
  end if;
  select coalesce(mission, '{}'::jsonb) into m from public.souhaits where id = p_souhait for update;

  if p_slot = any(coins) then
    m := public._jsonb_set_path(m, array['terrain_photos', p_vecteur, 'coins', p_slot], coalesce(p_meta, 'null'::jsonb));
  elsif p_slot in ('ticket_carburant', 'ticket_carburant_matin') then
    m := public._jsonb_set_path(m, array['terrain_photos', p_vecteur, p_slot], coalesce(p_meta, 'null'::jsonb));
  elsif p_slot like 'r\_%' escape '\' then
    coin_key := substr(p_slot, 3);
    if coin_key = any(coins) then
      m := public._jsonb_set_path(m, array['terrain_photos', p_vecteur, 'coins_retour', coin_key], coalesce(p_meta, 'null'::jsonb));
    else
      return json_build_object('ok', false, 'error', 'slot interdit');
    end if;
  else
    arr := coalesce(m->'terrain_photos'->p_vecteur->p_slot, '[]'::jsonb);
    if jsonb_typeof(arr) <> 'array' then arr := '[]'::jsonb; end if;
    if p_action = 'add' then
      arr := arr || jsonb_build_array(p_meta);
    elsif p_action = 'delete' then
      arr := coalesce((
        select jsonb_agg(x) from jsonb_array_elements(arr) x
        where x->>'id' is distinct from p_meta->>'id'
      ), '[]'::jsonb);
    else
      for i in 0 .. jsonb_array_length(arr) - 1 loop
        if (arr -> i) ->> 'id' = p_meta->>'id' then
          arr := jsonb_set(arr, array[i::text], p_meta, false);
          found := true;
        end if;
      end loop;
      if not found then arr := arr || jsonb_build_array(p_meta); end if;
    end if;
    m := public._jsonb_set_path(m, array['terrain_photos', p_vecteur, p_slot], arr);
  end if;

  update public.souhaits set mission = m where id = p_souhait;
  return json_build_object('ok', true);
end $$;

create or replace function public.maj_releves_vehicule(p_souhait uuid, p_patch jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare
  m jsonb; vid text; arr jsonb; i int; e jsonb; k text; garde jsonb := '{}'::jsonb;
begin
  if public.est_souhait_demo(p_souhait) then
    foreach k in array array['kms_depart','kms_retour','essence_pct'] loop
      if p_patch ? k then
        garde := garde || jsonb_build_object(k, p_patch -> k);
      end if;
    end loop;
    return public.formation_appliquer(p_souhait, 'releves', null, null, null, garde);
  end if;
  if not public.suis_affecte(p_souhait) then
    return json_build_object('ok', false, 'error', 'non affecté');
  end if;
  select coalesce(mission, '{}'::jsonb) into m from public.souhaits where id = p_souhait for update;
  vid := public.vid_session_terrain(p_souhait, m);
  if vid is null then
    return json_build_object('ok', false, 'error', 'pas de vecteur');
  end if;
  arr := coalesce(m->'vecteurs', '[]'::jsonb);
  for i in 0 .. jsonb_array_length(arr) - 1 loop
    e := arr -> i;
    if e->>'id' = vid then
      foreach k in array array['kms_depart','kms_retour','essence_pct'] loop
        if p_patch ? k then
          e := e || jsonb_build_object(k, p_patch -> k);
        end if;
      end loop;
      arr := jsonb_set(arr, array[i::text], e, false);
    end if;
  end loop;
  m := jsonb_set(m, array['vecteurs'], arr, true);
  update public.souhaits set mission = m where id = p_souhait;
  return json_build_object('ok', true);
end $$;

create or replace function public.maj_plaque_vecteur(p_souhait uuid, p_vecteur text, p_plaque text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  m jsonb;
  vs jsonb;
  i int;
  plaque text := trim(coalesce(p_plaque, ''));
begin
  if public.est_souhait_demo(p_souhait) then
    return public.formation_appliquer(p_souhait, 'plaque', plaque, null, null, null);
  end if;
  if p_souhait is null or p_vecteur is null or p_vecteur = '' then
    return json_build_object('ok', false, 'error', 'vecteur manquant');
  end if;
  if not (public.suis_affecte(p_souhait) or public.peut_voir_souhaits()) then
    return json_build_object('ok', false, 'error', 'non autorisé');
  end if;
  select coalesce(mission, '{}'::jsonb) into m from public.souhaits where id = p_souhait for update;
  if not found then
    return json_build_object('ok', false, 'error', 'souhait introuvable');
  end if;
  vs := coalesce(m->'vecteurs', '[]'::jsonb);
  if jsonb_typeof(vs) <> 'array' then vs := '[]'::jsonb; end if;
  for i in 0 .. coalesce(jsonb_array_length(vs), 0) - 1 loop
    if vs->i->>'id' = p_vecteur then
      vs := jsonb_set(vs, array[i::text, 'plaque'], to_jsonb(plaque), true);
    end if;
  end loop;
  m := jsonb_set(m, '{vecteurs}', vs, true);
  update public.souhaits set mission = m where id = p_souhait;
  if plaque <> '' and not exists (
    select 1 from public.plaques_vehicules pv where lower(pv.plaque) = lower(plaque)
  ) then
    begin
      insert into public.plaques_vehicules (plaque) values (plaque);
    exception when unique_violation then
      null;
    end;
  end if;
  return json_build_object('ok', true, 'plaque', plaque);
end $$;

create or replace function public.noter_mission(p_souhait uuid, p_observations text)
returns json language plpgsql security definer set search_path = public as $$
declare m jsonb;
begin
  if public.est_souhait_demo(p_souhait) then
    return public.formation_appliquer(p_souhait, 'noter', coalesce(p_observations, ''), null, null, null);
  end if;
  if not public.suis_affecte(p_souhait) then
    return json_build_object('ok', false, 'error', 'non affecté');
  end if;
  select coalesce(mission, '{}'::jsonb) into m from public.souhaits where id = p_souhait for update;
  m := public._jsonb_set_path(m, array['rapport_observations'], to_jsonb(coalesce(p_observations, '')));
  update public.souhaits set mission = m where id = p_souhait;
  return json_build_object('ok', true);
end $$;

create or replace function public.patch_mission_cle(
  p_souhait uuid, p_cle text, p_valeur jsonb, p_mode text default 'set'
)
returns json language plpgsql security definer set search_path = public as $$
declare
  m jsonb;
  sp public.souhait_personnel;
  allowed text[] := array['rapport_medical', 'rapport_observations', 'injections_detresse'];
  voir_med boolean;
  a_sp boolean;
  texte text;
begin
  if not public.suis_affecte(p_souhait) then
    return json_build_object('ok', false, 'error', 'non affecté');
  end if;
  if not (p_cle = any(allowed)) then
    return json_build_object('ok', false, 'error', 'clé interdite');
  end if;
  select * into sp from public.souhait_personnel
    where souhait_id = p_souhait and user_id = auth.uid() limit 1;
  a_sp := found;
  voir_med := public.session_profil_est_medical(case when a_sp then sp.role_mission else null end);
  if p_cle in ('rapport_medical', 'injections_detresse') and not voir_med then
    return json_build_object('ok', false, 'error', 'réservé au médical');
  end if;
  if public.est_souhait_demo(p_souhait) then
    if p_cle = 'rapport_medical' then
      texte := coalesce(p_valeur #>> '{}', '');
      return public.formation_appliquer(p_souhait, 'patch', p_cle, p_mode, null, to_jsonb(texte));
    end if;
    return public.formation_appliquer(p_souhait, 'patch', p_cle, p_mode, null, p_valeur);
  end if;
  select coalesce(mission, '{}'::jsonb) into m from public.souhaits where id = p_souhait for update;
  if p_cle = 'injections_detresse' and coalesce(p_mode, 'set') = 'append' then
    m := public._jsonb_set_path(
      m,
      array[p_cle],
      coalesce(m->p_cle, '[]'::jsonb) || jsonb_build_array(coalesce(p_valeur, '{}'::jsonb))
    );
  else
    m := public._jsonb_set_path(m, array[p_cle], coalesce(p_valeur, 'null'::jsonb));
  end if;
  update public.souhaits set mission = m where id = p_souhait;
  return json_build_object('ok', true);
end $$;

create or replace function public.set_statut_base(p_souhait uuid, p_statut text)
returns json language plpgsql security definer set search_path = public as $$
declare
  m jsonb;
  uid uuid := auth.uid();
  iso text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
begin
  if not public.suis_affecte(p_souhait) then
    return json_build_object('ok', false, 'error', 'non affecté');
  end if;
  if p_statut is not null and p_statut not in ('en_route', 'arrive', 'pret') then
    return json_build_object('ok', false, 'error', 'statut interdit');
  end if;
  if public.est_souhait_demo(p_souhait) then
    return public.formation_appliquer(p_souhait, 'statut_base', coalesce(p_statut, ''), null, null, null);
  end if;
  select coalesce(mission, '{}'::jsonb) into m from public.souhaits where id = p_souhait for update;
  update public.souhait_personnel
    set statut_base = nullif(p_statut, '')
    where souhait_id = p_souhait and user_id = uid;
  m := public._jsonb_set_path(m, array['personnel_statuts', uid::text], to_jsonb(coalesce(p_statut, '')));
  if p_statut = 'arrive' and coalesce(m #>> array['personnel_heures', uid::text], '') = '' then
    m := public._jsonb_set_path(m, array['personnel_heures', uid::text], to_jsonb(iso));
  end if;
  update public.souhaits set mission = m where id = p_souhait;
  return json_build_object('ok', true, 'statut_base', p_statut);
end $$;

-- ── DAR (données, actions, résultats) et notes pour l’équipage ──────────────
create table if not exists public.souhait_dar (
  id uuid primary key default gen_random_uuid(),
  souhait_id uuid not null references public.souhaits(id) on delete cascade,
  auteur_id uuid not null references public.profiles(id),
  genre text not null check (genre in ('donnee', 'action', 'resultat', 'note')),
  texte text not null check (char_length(btrim(texte)) > 0),
  individuel boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists souhait_dar_souhait_idx on public.souhait_dar (souhait_id, created_at);

create or replace function public.est_coordination_medicale(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_user
      and coalesce(p.actif, true)
      and coalesce(p.fiche->'roles_asbl' ?| array[
        'coord_medical', 'coord_medical_adjoint', 'coordinateur_medical'
      ], false)
  )
$$;

create or replace function public.est_partenaire_du_souhait(p_souhait uuid, p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.souhaits s
    join public.profiles p on p.id = p_user
    where s.id = p_souhait
      and p.role::text = 'partenaire'
      and s.partenaire_id is not null
      and p.partenaire_id = s.partenaire_id
  )
$$;

create or replace function public.peut_lire_dar(p_souhait uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.suis_affecte(p_souhait)
      or public.est_coordination_medicale()
      or public.est_partenaire_du_souhait(p_souhait)
$$;

create or replace function public.dar_auteur_medical(p_souhait uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.est_coordination_medicale()
      or exists (
        select 1
        from public.profiles p
        left join public.souhait_personnel sp
          on sp.user_id = p.id and sp.souhait_id = p_souhait
        where p.id = auth.uid()
          and public.profil_est_medical(p.role::text, coalesce(p.fiche, '{}'::jsonb), sp.role_mission)
          and (sp.user_id is not null or public.est_souhait_demo(p_souhait))
      )
$$;

alter table public.souhait_dar enable row level security;

drop policy if exists souhait_dar_select on public.souhait_dar;
create policy souhait_dar_select on public.souhait_dar
  for select to authenticated
  using (
    (not individuel and public.peut_lire_dar(souhait_id))
    or (individuel and auteur_id = auth.uid())
  );

drop policy if exists souhait_dar_insert on public.souhait_dar;
create policy souhait_dar_insert on public.souhait_dar
  for insert to authenticated
  with check (
    auteur_id = auth.uid()
    and (
      (individuel and public.est_souhait_demo(souhait_id) and public.suis_affecte(souhait_id))
      or (
        not individuel
        and not public.est_souhait_demo(souhait_id)
        and (
          (genre = 'note' and (public.peut_lire_dar(souhait_id)))
          or (genre in ('donnee', 'action', 'resultat') and public.dar_auteur_medical(souhait_id))
        )
      )
    )
  );

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'souhait_dar'
  ) then
    alter publication supabase_realtime add table public.souhait_dar;
  end if;
end $$;

-- ── Contacts ajoutés sur la mission ─────────────────────────────────────────
create table if not exists public.souhait_contacts_extra (
  id uuid primary key default gen_random_uuid(),
  souhait_id uuid not null references public.souhaits(id) on delete cascade,
  auteur_id uuid not null references public.profiles(id),
  libelle text not null,
  nom text not null default '',
  telephone text not null default '',
  email text not null default '',
  individuel boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.souhait_contacts_extra enable row level security;

drop policy if exists souhait_contacts_extra_select on public.souhait_contacts_extra;
create policy souhait_contacts_extra_select on public.souhait_contacts_extra
  for select to authenticated
  using (
    (not individuel and public.peut_lire_dar(souhait_id))
    or (individuel and auteur_id = auth.uid())
  );

drop policy if exists souhait_contacts_extra_insert on public.souhait_contacts_extra;
create policy souhait_contacts_extra_insert on public.souhait_contacts_extra
  for insert to authenticated
  with check (
    auteur_id = auth.uid()
    and char_length(btrim(libelle)) > 0
    and (
      (individuel and public.est_souhait_demo(souhait_id) and public.suis_affecte(souhait_id))
      or (not individuel and not public.est_souhait_demo(souhait_id) and public.peut_lire_dar(souhait_id))
    )
  );

create or replace function public.contacts_mission(p_souhait uuid)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  s public.souhaits;
  crew jsonb;
  coords jsonb;
begin
  if not public.peut_lire_dar(p_souhait) then
    return json_build_object('ok', false, 'error', 'non autorisé');
  end if;
  select * into s from public.souhaits where id = p_souhait;
  if not found then return json_build_object('ok', false, 'error', 'introuvable'); end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'prenom', p.prenom,
    'nom', p.nom,
    'role', sp.role_mission,
    'telephone', coalesce(p.fiche->>'telephone', '')
  ) order by p.prenom), '[]'::jsonb)
    into crew
  from public.souhait_personnel sp
  join public.profiles p on p.id = sp.user_id
  where sp.souhait_id = p_souhait;

  select coalesce(jsonb_agg(jsonb_build_object(
    'prenom', p.prenom,
    'nom', p.nom,
    'telephone', coalesce(p.fiche->>'telephone', ''),
    'email', coalesce(p.email, '')
  ) order by p.prenom), '[]'::jsonb)
    into coords
  from public.profiles p
  where coalesce(p.actif, true)
    and coalesce(p.fiche->'roles_asbl' ?| array[
      'coord_medical', 'coord_medical_adjoint', 'coordinateur_medical'
    ], false);

  return json_build_object(
    'ok', true,
    'beneficiaire', json_build_object(
      'prenom', s.beneficiaire_prenom,
      'nom', s.beneficiaire_nom,
      'tel_gsm', s.beneficiaire_tel_gsm,
      'tel_fixe', s.beneficiaire_tel_fixe,
      'email', s.beneficiaire_email
    ),
    'contacts', coalesce(s.contacts, '[]'::jsonb),
    'equipe_pluri', coalesce(s.mission->'equipe_pluri', '[]'::jsonb),
    'institution', json_build_object(
      'nom', s.mission->>'pec_institution',
      'service', s.mission->>'pec_service',
      'telephone', coalesce(s.mission->>'pec_telephone', '')
    ),
    'equipage', crew,
    'coordinateurs', coords
  );
end
$$;

grant execute on function public.contacts_mission(uuid) to authenticated;

create or replace function public.recap_mission(p_souhait uuid)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  s public.souhaits;
  m jsonb;
  pec jsonb;
begin
  if not (public.suis_affecte(p_souhait) or public.peut_voir_souhaits() or public.est_partenaire_du_souhait(p_souhait)) then
    return json_build_object('ok', false, 'error', 'non autorisé');
  end if;
  select * into s from public.souhaits where id = p_souhait;
  if not found then return json_build_object('ok', false); end if;
  m := coalesce(s.mission, '{}'::jsonb);
  if (m->>'pec_type') = 'Domicile du patient' then pec := m->'patient_adresse';
  else pec := m->'pec_adresse';
  end if;
  return json_build_object(
    'ok', true,
    'description', s.description,
    'dates', json_build_object('debut', s.date_souhaitee, 'fin', s.date_fin),
    'dates_possibles', coalesce(s.dates_possibles, '[]'::jsonb),
    'heure_depart', s.heure_depart,
    'heure_retour', s.heure_retour,
    'base', json_build_object(
      'nom', m->>'base_nom', 'adresse', m->'base_adresse',
      'rdv', m->>'rdv_base', 'depart', m->>'depart_base'
    ),
    'pec', json_build_object(
      'type', m->>'pec_type', 'institution', m->>'pec_institution', 'adresse', pec,
      'service', m->>'pec_service', 'etage', m->>'pec_etage', 'aile', m->>'pec_aile',
      'chambre', m->>'pec_chambre', 'heure', m->>'arrivee_pec', 'depart', m->>'depart_pec',
      'precisions', m->>'pec_precisions'
    ),
    'destination', json_build_object(
      'adresse', m->'dest_adresse', 'precisions', m->>'dest_precisions', 'heure', m->>'arrivee_destination'
    ),
    'activites', coalesce(m->'activites_sur_place', '[]'::jsonb),
    'lieux', coalesce(m->'lieux_annexes', '[]'::jsonb),
    'retour', json_build_object(
      'type', m->>'retour_type', 'heure', m->>'retour_heure', 'precisions', m->>'retour_precisions'
    )
  );
end
$$;

grant execute on function public.recap_mission(uuid) to authenticated;

-- ── Notifications : ticket de plein, protocole de détresse ───────────────────
create or replace function public._notifier_roles(
  p_type text,
  p_roles text[],
  p_titre text,
  p_message text,
  p_lien text,
  p_priorite text,
  p_ref uuid,
  p_fenetre interval
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  dest uuid;
  nid uuid;
  ids uuid[] := '{}';
  n int := 0;
begin
  for dest in
    select p.id
    from public.profiles p
    where coalesce(p.actif, true)
      and p.role::text is distinct from 'partenaire'
      and p.id is distinct from auth.uid()
      and public.pref_notification(p.fiche, p_type)
      and (
        p.role::text = any (p_roles)
        or coalesce(p.fiche->'roles_asbl' ?| p_roles, false)
      )
  loop
    if p_ref is not null and exists (
      select 1 from public.notifications x
      where x.destinataire_id = dest and x.type = p_type and x.ref_id = p_ref
        and x.created_at > now() - p_fenetre
    ) then
      continue;
    end if;
    insert into public.notifications(destinataire_id, type, titre, message, lien, priorite, ref_id)
      values (dest, p_type, p_titre, p_message, p_lien, p_priorite, p_ref)
      returning id into nid;
    ids := ids || nid;
    n := n + 1;
  end loop;
  perform public._declencher_push(ids);
  return n;
end
$$;

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
  n := public._notifier_roles(
    'ticket_plein',
    array['tresorier', 'tresorier_adjoint', 'president', 'vice_president'],
    'Ticket de plein à contrôler',
    coalesce(s.beneficiaire_prenom, 'Mission') || ' — le ticket du plein du matin est encodé.',
    '/app/souhaits/' || p_souhait::text,
    'normale',
    p_souhait,
    interval '12 hours'
  );
  return json_build_object('ok', true, 'envoyes', n);
end
$$;

grant execute on function public.notifier_ticket_plein(uuid) to authenticated;

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
  n := public._notifier_roles(
    'protocole_detresse',
    array['coord_medical', 'coord_medical_adjoint', 'coordinateur_medical'],
    'Protocole de détresse',
    'Protocole de détresse utilisé — ' || coalesce(s.beneficiaire_prenom, 'mission') || '. Ouvrez le rapport médical.',
    '/app/souhaits/' || p_souhait::text,
    'haute',
    p_souhait,
    interval '2 minutes'
  );
  return json_build_object('ok', true, 'envoyes', n);
end
$$;

grant execute on function public.notifier_protocole_detresse(uuid) to authenticated;

-- ── Envoi tracé du rapport médical ──────────────────────────────────────────
create table if not exists public.envois_rapport_medical (
  id uuid primary key default gen_random_uuid(),
  souhait_id uuid not null references public.souhaits(id) on delete cascade,
  expediteur_id uuid not null references public.profiles(id),
  email text not null,
  envoye_le timestamptz not null default now()
);

create index if not exists envois_rapport_souhait_idx
  on public.envois_rapport_medical (souhait_id, envoye_le desc);

create or replace function public._user_peut_envoyer_rapport(p_user uuid, p_souhait uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.est_coordination_medicale(p_user)
      or exists (
        select 1
        from public.profiles p
        join public.souhait_personnel sp on sp.user_id = p.id and sp.souhait_id = p_souhait
        where p.id = p_user
          and public.profil_est_medical(p.role::text, coalesce(p.fiche, '{}'::jsonb), sp.role_mission)
      )
$$;

create or replace function public.autoriser_envoi_rapport(p_souhait uuid, p_user uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_user is null or p_souhait is null then return false; end if;
  if coalesce(auth.role(), '') is distinct from 'service_role' then
    if auth.uid() is null or auth.uid() is distinct from p_user then
      return false;
    end if;
  end if;
  if public.est_souhait_demo(p_souhait) then return false; end if;
  return public._user_peut_envoyer_rapport(p_user, p_souhait);
end
$$;

grant execute on function public.autoriser_envoi_rapport(uuid, uuid) to authenticated, service_role;

alter table public.envois_rapport_medical enable row level security;

drop policy if exists envois_rapport_select on public.envois_rapport_medical;
create policy envois_rapport_select on public.envois_rapport_medical
  for select to authenticated
  using (public.autoriser_envoi_rapport(souhait_id, auth.uid()) or expediteur_id = auth.uid());

-- ── Statistiques des souhaits (présidence et informatique) ──────────────────
create or replace function public.stats_souhaits()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.peut_gerer_app() then
    return jsonb_build_object('ok', false, 'error', 'réservé à la présidence et à l’informatique');
  end if;
  return jsonb_build_object(
    'ok', true,
    'lignes', coalesce((
      select jsonb_agg(to_jsonb(t))
      from (
        select
          s.id,
          s.statut::text as statut,
          coalesce(s.date_realisee, s.date_souhaitee) as jour,
          coalesce(
            nullif(s.mission->'dest_adresse'->>'localite', ''),
            nullif(s.mission->'pec_adresse'->>'localite', ''),
            nullif(s.localisation, ''),
            ''
          ) as lieu,
          coalesce(s.mission->'categories'->'activites', '[]'::jsonb) as activites,
          coalesce(s.mission->'categories'->'pathologies', '[]'::jsonb) as pathologies,
          coalesce(s.beneficiaire_genre, '') as genre,
          coalesce(nullif(s.mission->>'pec_institution', ''), '') as institution,
          coalesce(nullif(s.mission->>'pec_service', ''), '') as service,
          s.beneficiaire_ddn as ddn,
          (
            select coalesce(sum(
              case
                when (v->>'kms_retour') ~ '^[0-9]+([.,][0-9]+)?$'
                 and (v->>'kms_depart') ~ '^[0-9]+([.,][0-9]+)?$'
                 and replace(v->>'kms_retour', ',', '.')::numeric >= replace(v->>'kms_depart', ',', '.')::numeric
                then replace(v->>'kms_retour', ',', '.')::numeric - replace(v->>'kms_depart', ',', '.')::numeric
                else 0
              end
            ), 0)
            from jsonb_array_elements(coalesce(s.mission->'vecteurs', '[]'::jsonb)) v
          ) as km,
          coalesce((
            select jsonb_agg(jsonb_build_object(
              'id', sp.user_id,
              'nom', trim(both ' ' from coalesce(p.prenom, '') || ' ' || coalesce(p.nom, ''))
            ))
            from public.souhait_personnel sp
            join public.profiles p on p.id = sp.user_id
            where sp.souhait_id = s.id
          ), '[]'::jsonb) as volontaires
        from public.souhaits s
        where coalesce(s.fictif, false) = false
          and s.statut::text in ('realise', 'terminee_terrain')
      ) t
    ), '[]'::jsonb)
  );
end
$$;

grant execute on function public.stats_souhaits() to authenticated;

grant execute on function public.est_coordination_medicale(uuid) to authenticated;
grant execute on function public.peut_lire_dar(uuid) to authenticated;

notify pgrst, 'reload schema';
