-- Dimensionnement d'une activité secours : public attendu et type de dispositif.
-- Le type est choisi. Il n'est pas déduit du public.
-- Les activités déjà créées restent sans dispositif.

alter table public.activites_secours
  add column if not exists public_attendu integer;

alter table public.activites_secours
  add column if not exists dispositif text;

do $$ begin
  alter table public.activites_secours
    add constraint activites_secours_public
    check (public_attendu is null or public_attendu between 0 and 500000);
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.activites_secours
    add constraint activites_secours_dispositif
    check (dispositif is null or dispositif in ('paps', 'pe', 'me', 'ge'));
exception when duplicate_object then null;
end $$;

comment on column public.activites_secours.public_attendu is
  'Public attendu, saisi à la main. N’entraîne pas un type de dispositif.';
comment on column public.activites_secours.dispositif is
  'paps, pe, me ou ge. Vide si l’activité n’est pas dimensionnée.';

-- Un chauffeur dont la sélection médicale est datée et échue ne s’inscrit pas
-- à une activité qui demande cette compétence.
create or replace function public.activites_secours_selection_chauffeur()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  demande boolean;
  validite text;
begin
  select 'chauffeur' = any(a.competences) into demande
  from public.activites_secours a
  where a.id = new.activite_id;
  if coalesce(demande, false) = false then
    return new;
  end if;
  select p.fiche #>> '{permis,selection_validite}' into validite
  from public.profiles p
  where p.id = new.user_id;
  if validite ~ '^\d{4}-\d{2}-\d{2}$' and validite::date < current_date then
    raise exception 'Sélection médicale échue : inscription impossible sur une activité qui demande un chauffeur';
  end if;
  return new;
end
$$;

revoke all on function public.activites_secours_selection_chauffeur() from public, anon;
grant execute on function public.activites_secours_selection_chauffeur() to authenticated, service_role;

drop trigger if exists trg_activites_secours_selection on public.activites_secours_inscrits;
create trigger trg_activites_secours_selection
  before insert on public.activites_secours_inscrits
  for each row execute function public.activites_secours_selection_chauffeur();

notify pgrst, 'reload schema';
