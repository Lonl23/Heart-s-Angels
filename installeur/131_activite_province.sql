-- ════════════════════════════════════════════════════════════════════════════
--  Province du préventif (lien RescueTrack).
--  Idempotent. Après 130_candidatures_volontariat.sql.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.activites_secours
  add column if not exists adresse_province text;

alter table public.activites_secours
  drop constraint if exists activites_secours_adresse_province;

alter table public.activites_secours
  add constraint activites_secours_adresse_province
  check (
    adresse_province is null
    or adresse_province = any (array[
      'Anvers',
      'Brabant flamand',
      'Brabant wallon',
      'Bruxelles-Capitale',
      'Flandre occidentale',
      'Flandre orientale',
      'Hainaut',
      'Liège',
      'Limbourg',
      'Luxembourg',
      'Namur'
    ]::text[])
  );

comment on column public.activites_secours.adresse_province is
  'Province belge du site (préventif) — facilite le lien RescueTrack.';

notify pgrst, 'reload schema';
