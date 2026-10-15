-- ════════════════════════════════════════════════════════════════════════════
--  PIN archives : les récolteurs de souhait peuvent ouvrir un dossier classé,
--  comme le président, la vice-présidente et le responsable informatique
--  (pas l’adjoint IT). Idempotent. Après 63_smtp_vault.sql.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.peut_ouvrir_archives()
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select coalesce((
    select public.profil_a_role_asbl(coalesce(fiche, '{}'::jsonb), 'president')
        or public.profil_a_role_asbl(coalesce(fiche, '{}'::jsonb), 'vice_president')
        or public.profil_a_role_asbl(coalesce(fiche, '{}'::jsonb), 'resp_informatique')
        or public.profil_a_role_asbl(coalesce(fiche, '{}'::jsonb), 'recolteur_souhait')
    from public.profiles
    where id = auth.uid() and coalesce(actif, true)
  ), false)
$$;

create or replace function public.trg_revoquer_pin_si_plus_eligible()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if tg_op = 'UPDATE' then
    if not (
         coalesce(new.actif, true)
         and (
           public.profil_a_role_asbl(coalesce(new.fiche, '{}'::jsonb), 'president')
           or public.profil_a_role_asbl(coalesce(new.fiche, '{}'::jsonb), 'vice_president')
           or public.profil_a_role_asbl(coalesce(new.fiche, '{}'::jsonb), 'resp_informatique')
           or public.profil_a_role_asbl(coalesce(new.fiche, '{}'::jsonb), 'recolteur_souhait')
         )
       ) then
      new.archive_pin_hash := null;
      new.archive_pin_at := null;
      new.archive_pin_echecs := 0;
      new.archive_pin_bloque_jusqua := null;
    end if;
  end if;
  return new;
end $$;

create or replace function public.definir_pin_archive(p_pin text, p_ancien text default null)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  err text;
  h text;
  a text;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'error', 'Non authentifié.');
  end if;
  if not public.peut_ouvrir_archives() then
    return json_build_object('ok', false, 'error', 'Seul le président, la vice-présidente, le responsable informatique ou un récolteur peuvent créer ce code.');
  end if;
  err := public.pin_archive_invalide(p_pin);
  if err is not null then
    return json_build_object('ok', false, 'error', err);
  end if;
  select archive_pin_hash into h from public.profiles where id = auth.uid();
  if h is not null then
    if p_ancien is null or crypt(regexp_replace(p_ancien, '\D', '', 'g'), h) is distinct from h then
      return json_build_object('ok', false, 'error', 'Indiquez d’abord l’ancien code pour le remplacer.');
    end if;
  end if;
  a := regexp_replace(p_pin, '\D', '', 'g');
  update public.profiles set
    archive_pin_hash = crypt(a, gen_salt('bf', 8)),
    archive_pin_at = now(),
    archive_pin_echecs = 0,
    archive_pin_bloque_jusqua = null
  where id = auth.uid();
  return json_build_object('ok', true);
end $$;

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
    return json_build_object('ok', false, 'error', 'Accès réservé au président, à la vice-présidente, au responsable informatique et aux récolteurs.');
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

grant execute on function public.peut_ouvrir_archives() to authenticated;
grant execute on function public.definir_pin_archive(text, text) to authenticated;
grant execute on function public.ouvrir_souhait_archive(uuid, text) to authenticated;

notify pgrst, 'reload schema';
