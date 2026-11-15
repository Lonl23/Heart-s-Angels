-- ════════════════════════════════════════════════════════════════════════════
--  Formulaire « Devenir bénévole » du site WordPress.
--  L'e-mail part comme avant. La candidature est aussi enregistrée ici.
--  Elle n'ouvre pas de compte : l'équipe invite ensuite la personne.
--  Idempotent. Après 22_demande_site_web.sql.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.candidatures_benevoles (
  id              uuid primary key default gen_random_uuid(),
  prenom          text not null,
  nom             text not null,
  email           text not null,
  telephone       text,
  date_naissance  date,
  adresse         jsonb,
  registre        text,
  comites         text[] not null default '{}',
  profession      text,
  motivation      text,
  commentaires    text,
  photo_nom       text,
  diplome_nom     text,
  statut          text not null default 'nouvelle'
                  check (statut in ('nouvelle','contactee','acceptee','refusee')),
  notes_internes  text,
  source          text not null default 'wordpress',
  created_at      timestamptz not null default now()
);

create or replace function public.candidatures_externe_verrouille()
returns trigger
language plpgsql
as $$
begin
  if current_user = 'anon' or coalesce(auth.role(), '') = 'anon' then
    new.statut := 'nouvelle';
    new.notes_internes := null;
    new.source := 'wordpress';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_candidatures_externe_verrouille on public.candidatures_benevoles;
create trigger trg_candidatures_externe_verrouille
  before insert on public.candidatures_benevoles
  for each row execute function public.candidatures_externe_verrouille();

alter table public.candidatures_benevoles enable row level security;

drop policy if exists candidatures_staff_all on public.candidatures_benevoles;
create policy candidatures_staff_all on public.candidatures_benevoles
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists candidatures_insert_externe on public.candidatures_benevoles;
create policy candidatures_insert_externe on public.candidatures_benevoles
  for insert to anon
  with check (source = 'wordpress');

grant select, insert, update, delete on public.candidatures_benevoles to authenticated, service_role;
grant insert on public.candidatures_benevoles to anon;
