-- ════════════════════════════════════════════════════════════════════════════
--  Un volontaire n’a pas de rôle « simple volontaire » : soit il est
--  volontaire, soit il a un rôle dans l’ASBL.
--  Chaîne vue depuis le volontaire (N) :
--    N+1 Yves Jourdain, Fernand Hanssen, Carine Carlier, Laurent Noulin
--    N+2 Ludovic Whenham
--  Idempotent. Après 86_organigramme.sql.
-- ════════════════════════════════════════════════════════════════════════════

select set_config('app.role_guard_off', 'on', true);

update public.profiles
set fiche = jsonb_set(
  fiche,
  '{roles_asbl}',
  coalesce((
    select jsonb_agg(to_jsonb(r))
    from jsonb_array_elements_text(coalesce(fiche->'roles_asbl', '[]'::jsonb)) r
    where r <> 'simple_volontaire'
  ), '[]'::jsonb)
)
where coalesce(fiche->'roles_asbl', '[]'::jsonb) ? 'simple_volontaire';

do $$
declare
  src text;
begin
  select pg_get_functiondef('public.tampon_acteur_note()'::regprocedure) into src;
  src := replace(src, 'Responsable informatique', 'Coordinateur informatique');
  src := replace(src, 'Adjoint informatique', 'Coordinateur informatique adjoint');
  execute src;
exception
  when undefined_function then
    null;
end $$;

-- Ludovic en haut (N+2 des volontaires), puis les quatre N+1.
-- Ignoré si ces fiches ne sont pas dans cette base.
do $$
declare
  ludo uuid := '2630edce-7503-424d-80aa-d5c140b7aca1';
  n1s uuid[] := array[
    'f66320ba-40ec-4175-bf5f-2249c65e4056',
    '4e0b054a-80f2-4338-80ba-51f3910efe0d',
    'c65277a7-305b-43e5-8e7f-5f8f60088899',
    '077185df-e5d9-43c7-b162-e3b87330489c'
  ];
  i int;
begin
  if not exists (select 1 from public.profiles where id = ludo) then
    return;
  end if;
  if (select count(*) from public.profiles where id = any(n1s)) <> 4 then
    return;
  end if;
  insert into public.organigramme (profile_id, n1_id, ordre)
  values (ludo, null, 10)
  on conflict (profile_id) do update
    set n1_id = excluded.n1_id, ordre = excluded.ordre, updated_at = now();
  for i in 1..4 loop
    insert into public.organigramme (profile_id, n1_id, ordre)
    values (n1s[i], ludo, i * 10)
    on conflict (profile_id) do update
      set n1_id = excluded.n1_id, ordre = excluded.ordre, updated_at = now();
  end loop;
end $$;
