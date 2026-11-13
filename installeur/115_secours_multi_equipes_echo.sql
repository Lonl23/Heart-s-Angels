-- Multi-équipes sur une activité secours (préventif) + type Écho.
-- dispositifs[] porte 1..n équipes ; dispositif reste le premier (compat lecture).

alter table public.activites_secours
  drop constraint if exists activites_secours_dispositif;

alter table public.activites_secours
  add column if not exists dispositifs text[] not null default '{}'::text[];

update public.activites_secours
set dispositifs = array[dispositif]
where dispositif is not null
  and (dispositifs is null or cardinality(dispositifs) = 0);

alter table public.activites_secours
  add constraint activites_secours_dispositif
  check (
    dispositif is null
    or dispositif in (
      'paps', 'ps', 'echo', 'pma_cat2', 'pma_cat1', 'pma_cat0', 'ambu_112', 'ambu'
    )
  );

alter table public.activites_secours
  drop constraint if exists activites_secours_dispositifs_connus;

alter table public.activites_secours
  add constraint activites_secours_dispositifs_connus
  check (
    dispositifs <@ array[
      'paps', 'ps', 'echo', 'pma_cat2', 'pma_cat1', 'pma_cat0', 'ambu_112', 'ambu'
    ]::text[]
  );

comment on column public.activites_secours.dispositifs is
  'Équipes du préventif (PAPS, PS, Écho, PMA, AMBU…). Plusieurs possibles.';
comment on column public.activites_secours.dispositif is
  'Première équipe (compat). Préférer dispositifs[].';

notify pgrst, 'reload schema';
