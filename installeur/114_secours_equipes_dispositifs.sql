-- Équipes de dispositifs secours (ASBL) : PAPS, PS, PMA CAT 2/1/0, AMBU 112, AMBU.
-- Remplace l’ancienne contrainte pe/me/ge. Les anciennes valeurs sont migrées.
-- Colonne armement (jsonb) : checklist + plaque pour l’étape « Armer ».

alter table public.activites_secours
  drop constraint if exists activites_secours_dispositif;

update public.activites_secours set dispositif = 'ps' where dispositif = 'pe';
update public.activites_secours set dispositif = 'pma_cat2' where dispositif = 'me';
update public.activites_secours set dispositif = 'pma_cat0' where dispositif = 'ge';

alter table public.activites_secours
  add constraint activites_secours_dispositif
  check (
    dispositif is null
    or dispositif in (
      'paps', 'ps', 'pma_cat2', 'pma_cat1', 'pma_cat0', 'ambu_112', 'ambu'
    )
  );

comment on column public.activites_secours.dispositif is
  'Type d’équipe / dispositif secours : paps, ps, pma_cat2, pma_cat1, pma_cat0, ambu_112, ambu. Choisi, pas calculé.';

alter table public.activites_secours
  add column if not exists armement jsonb not null default '{}'::jsonb;

comment on column public.activites_secours.armement is
  'État d’armement : { plaque, items:[{id,label,ok}], note }. Pas de données patients.';

notify pgrst, 'reload schema';
