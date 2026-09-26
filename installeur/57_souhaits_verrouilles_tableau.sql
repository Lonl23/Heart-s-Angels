-- ════════════════════════════════════════════════════════════════════════════
--  Souhaits réalisés verrouillés : restent dans le tableau (colonne Réalisé).
--  Le PIN ouvre le dossier ; la liste n’expose pas le médical ni le NISS.
--  Idempotent. Après 56_volontaires_sans_acces.sql.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.etat_souhait_archive(p_id uuid)
returns json
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  s public.souhaits;
begin
  select * into s from public.souhaits where id = p_id;
  if s.id is null then
    return json_build_object('ok', false, 'existe', false);
  end if;
  return json_build_object(
    'ok', true,
    'existe', true,
    'archive', public.souhait_est_archive(s),
    'peut_ouvrir', public.peut_ouvrir_archives(),
    'a_pin', public.mon_pin_archive_defini(),
    'verrouille_au', public.date_verrouillage_souhait(s.date_realisee, s.updated_at),
    'beneficiaire', nullif(btrim(concat_ws(' ', s.beneficiaire_prenom, s.beneficiaire_nom)), '')
  );
end $$;

-- Cartes du tableau : champs d’affichage seulement (pas de NISS ni notes médicales).
create or replace function public.lister_souhaits_verrouilles()
returns table (
  id uuid,
  beneficiaire_prenom text,
  beneficiaire_nom text,
  description text,
  localisation text,
  date_souhaitee date,
  date_fin date,
  date_realisee date,
  dates_possibles jsonb,
  statut text,
  priorite smallint,
  fictif boolean,
  verrouille boolean,
  mission jsonb
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    s.id,
    s.beneficiaire_prenom,
    s.beneficiaire_nom,
    s.description,
    s.localisation,
    s.date_souhaitee,
    s.date_fin,
    s.date_realisee,
    s.dates_possibles,
    s.statut::text,
    coalesce(s.priorite, 2),
    coalesce(s.fictif, false),
    true,
    jsonb_strip_nulls(jsonb_build_object(
      'recolteur', s.mission->>'recolteur',
      'recolteurs', s.mission->'recolteurs',
      'attente', s.mission->'attente',
      'motif_non_realise', s.mission->>'motif_non_realise'
    ))
  from public.souhaits s
  where public.peut_voir_souhaits()
    and public.souhait_est_archive(s)
  order by s.date_realisee desc nulls last, s.updated_at desc
$$;

create or replace function public.ouvrir_souhait_archive(p_id uuid, p_pin text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  s public.souhaits;
  h text;
  a text;
  bloq timestamptz;
  n int;
  err text;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'error', 'Non authentifié.');
  end if;
  if not public.peut_ouvrir_archives() then
    return json_build_object('ok', false, 'error', 'Accès réservé au président, à la vice-présidente et au responsable informatique.');
  end if;
  select * into s from public.souhaits where id = p_id;
  if s.id is null then
    return json_build_object('ok', false, 'error', 'Dossier introuvable.');
  end if;
  if not public.souhait_est_archive(s) then
    return json_build_object('ok', false, 'error', 'Ce dossier n’est pas verrouillé.');
  end if;

  select archive_pin_hash, archive_pin_bloque_jusqua, archive_pin_echecs
    into h, bloq, n
  from public.profiles where id = auth.uid();
  if h is null then
    return json_build_object('ok', false, 'error', 'Créez d’abord votre code PIN dans votre fiche volontaire.');
  end if;
  if bloq is not null and bloq > now() then
    return json_build_object('ok', false, 'error', 'Trop d’essais. Réessayez plus tard.');
  end if;
  err := public.pin_archive_invalide(p_pin);
  a := regexp_replace(coalesce(p_pin, ''), '\D', '', 'g');
  if crypt(a, h) is distinct from h then
    n := coalesce(n, 0) + 1;
    update public.profiles set
      archive_pin_echecs = n,
      archive_pin_bloque_jusqua = case when n >= 5 then now() + interval '15 minutes' else archive_pin_bloque_jusqua end
    where id = auth.uid();
    return json_build_object('ok', false, 'error', 'Code incorrect.');
  end if;

  update public.profiles set archive_pin_echecs = 0, archive_pin_bloque_jusqua = null
  where id = auth.uid();

  insert into public.archive_sessions (user_id, souhait_id, expires_at)
  values (auth.uid(), p_id, now() + interval '30 minutes')
  on conflict (user_id, souhait_id) do update
    set opened_at = now(), expires_at = now() + interval '30 minutes';

  insert into public.archive_ouvertures (user_id, souhait_id) values (auth.uid(), p_id);

  return json_build_object('ok', true, 'expires_at', (now() + interval '30 minutes'));
end $$;

grant execute on function public.etat_souhait_archive(uuid) to authenticated;
grant execute on function public.lister_souhaits_verrouilles() to authenticated;
grant execute on function public.ouvrir_souhait_archive(uuid, text) to authenticated;

notify pgrst, 'reload schema';
