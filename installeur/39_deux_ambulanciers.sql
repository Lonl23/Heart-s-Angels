-- ════════════════════════════════════════════════════════════════════════════
--  Équipage : 2 ambulanciers possibles (rôles_requis avec doublons).
--  roles_couverts_par_personnes compte désormais chaque occurrence.
--  Idempotent. Après 38_equipe_pluri_annuaire.sql.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.roles_couverts_par_personnes(p_requis text[], p_user_ids uuid[])
returns text[] language plpgsql stable security definer set search_path = public as $$
declare
  n_infi int := 0;
  n_ambu int := 0;
  n_dual int := 0;
  n_need_infi int := 0;
  n_need_ambu int := 0;
  n_cov_infi int;
  n_cov_ambu int;
  rem_i int;
  rem_a int;
  couverts text[] := '{}';
  rec record;
  qs text[];
  q text;
  has_infi boolean;
  has_ambu boolean;
  requis text[];
  i int;
begin
  requis := public.roles_effectifs(p_requis);
  select count(*) into n_need_infi from unnest(requis) x where x = 'infirmier';
  select count(*) into n_need_ambu from unnest(requis) x where x = 'ambulancier';

  if p_user_ids is null or p_user_ids = '{}'::uuid[] then
    return '{}'::text[];
  end if;

  for rec in
    select p.role::text as role, coalesce(p.fiche, '{}'::jsonb) as fiche
    from public.profiles p
    where p.id = any (p_user_ids)
  loop
    qs := public.quals_d_un_profil(rec.role, rec.fiche);
    has_infi := 'infirmier' = any (qs);
    has_ambu := 'ambulancier' = any (qs);
    if has_infi and has_ambu then
      n_dual := n_dual + 1;
    elsif has_infi then
      n_infi := n_infi + 1;
    elsif has_ambu then
      n_ambu := n_ambu + 1;
    end if;
    foreach q in array qs loop
      if q = any (requis) and q not in ('infirmier','ambulancier') and not (q = any (couverts)) then
        couverts := couverts || array[q];
      end if;
    end loop;
  end loop;

  for i in 1..n_dual loop
    rem_i := n_need_infi - n_infi;
    rem_a := n_need_ambu - n_ambu;
    if rem_i > 0 and rem_a > 0 then
      if n_infi <= n_ambu then n_infi := n_infi + 1; else n_ambu := n_ambu + 1; end if;
    elsif rem_i > 0 then n_infi := n_infi + 1;
    elsif rem_a > 0 then n_ambu := n_ambu + 1;
    end if;
  end loop;

  n_cov_infi := least(n_infi, n_need_infi);
  n_cov_ambu := least(n_ambu, n_need_ambu);
  for i in 1..n_cov_infi loop
    couverts := couverts || array['infirmier'];
  end loop;
  for i in 1..n_cov_ambu loop
    couverts := couverts || array['ambulancier'];
  end loop;
  return couverts;
end $$;

grant execute on function public.roles_couverts_par_personnes(text[], uuid[]) to authenticated;

notify pgrst, 'reload schema';
