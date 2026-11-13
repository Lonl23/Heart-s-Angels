-- Type d'une activité secours : activité, garde, manœuvre ou formation.
-- Les activités déjà créées restent des activités.

alter table public.activites_secours
  add column if not exists type text;

update public.activites_secours
  set type = 'activite'
  where type is null or btrim(type) = '';

alter table public.activites_secours
  alter column type set default 'activite';

alter table public.activites_secours
  alter column type set not null;

do $$ begin
  alter table public.activites_secours
    add constraint activites_secours_type
    check (type in ('activite', 'garde', 'manoeuvre', 'formation'));
exception when duplicate_object then null;
end $$;

comment on column public.activites_secours.type is
  'activite, garde, manoeuvre ou formation. Pas un rôle de compte.';

notify pgrst, 'reload schema';
