-- ════════════════════════════════════════════════════════════════════════════
--  Équipe pluridisciplinaire ↔ annuaire : recherche / dédoublonnage
--  (nom, prénom, n°). Idempotent. Après 37_equipe_pluridisciplinaire.sql.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.digits_tel(t text)
returns text
language plpgsql
immutable
parallel safe
set search_path = public
as $$
declare s text;
begin
  s := regexp_replace(coalesce(t, ''), '\D', '', 'g');
  if s like '00%' then s := substring(s from 3); end if;
  if s like '32%' then s := substring(s from 3); end if;
  if left(s, 1) = '0' then s := substring(s from 2); end if;
  return s;
end;
$$;

create index if not exists annuaire_pluri_nom_idx
  on public.annuaire (lower(nom), lower(prenom))
  where categorie in ('medical', 'point_contact');

create or replace function public.chercher_contacts_pluri(p_q text default '')
returns json
language sql
stable
security invoker
set search_path = public
as $$
  with q as (
    select
      nullif(btrim(coalesce(p_q, '')), '') as raw,
      public.digits_tel(p_q) as digits
  ),
  base as (
    select
      a.id,
      a.categorie,
      a.prenom,
      a.nom,
      a.telephone,
      a.tel_gsm,
      a.tel_fixe,
      a.institution_id,
      a.data,
      coalesce(nullif(btrim(inst.nom), ''), nullif(btrim(a.data->>'organisme'), ''), '') as organisme,
      coalesce(
        nullif(btrim(a.data->>'type_medical'), ''),
        nullif(btrim(a.lien), ''),
        nullif(btrim(a.data->>'fonction'), ''),
        ''
      ) as type_lib
    from public.annuaire a
    left join public.annuaire inst on inst.id = a.institution_id
    where a.categorie in ('medical', 'point_contact')
  ),
  hits as (
    select b.*
    from base b, q
    where
      q.raw is null
      or b.nom ilike '%' || q.raw || '%'
      or b.prenom ilike '%' || q.raw || '%'
      or concat_ws(' ', b.prenom, b.nom) ilike '%' || q.raw || '%'
      or concat_ws(' ', b.nom, b.prenom) ilike '%' || q.raw || '%'
      or coalesce(b.telephone, '') ilike '%' || q.raw || '%'
      or coalesce(b.tel_gsm, '') ilike '%' || q.raw || '%'
      or coalesce(b.tel_fixe, '') ilike '%' || q.raw || '%'
      or coalesce(b.organisme, '') ilike '%' || q.raw || '%'
      or coalesce(b.type_lib, '') ilike '%' || q.raw || '%'
      or (
        length(q.digits) >= 6
        and (
          public.digits_tel(b.telephone) like '%' || q.digits || '%'
          or public.digits_tel(b.tel_gsm) like '%' || q.digits || '%'
          or public.digits_tel(b.tel_fixe) like '%' || q.digits || '%'
          or public.digits_tel(b.data->>'telephone') like '%' || q.digits || '%'
          or public.digits_tel(b.data->>'tel_gsm') like '%' || q.digits || '%'
        )
      )
    order by b.nom nulls last, b.prenom nulls last
    limit 50
  )
  select coalesce((
    select json_agg(json_build_object(
      'id', h.id,
      'categorie', h.categorie,
      'prenom', h.prenom,
      'nom', h.nom,
      'telephone', coalesce(nullif(btrim(h.telephone), ''), nullif(btrim(h.tel_gsm), ''), nullif(btrim(h.tel_fixe), ''), h.data->>'telephone', h.data->>'tel_gsm'),
      'tel_gsm', h.tel_gsm,
      'tel_fixe', h.tel_fixe,
      'organisme', h.organisme,
      'type_lib', h.type_lib,
      'institution_id', h.institution_id
    ) order by h.nom nulls last, h.prenom nulls last)
    from hits h
  ), '[]'::json)
$$;

grant execute on function public.digits_tel(text) to authenticated;
grant execute on function public.chercher_contacts_pluri(text) to authenticated;

notify pgrst, 'reload schema';
