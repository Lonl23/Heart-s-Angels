-- DPS : types d’activité élargis, adresse rue/n° ou CP/ville,
-- commandement préventif (responsable, disp alpha/bravo),
-- accès création réservé aux resp_dps / adjoints.

-- ── Types ──────────────────────────────────────────────────────────
alter table public.activites_secours
  drop constraint if exists activites_secours_type;

alter table public.activites_secours
  add constraint activites_secours_type check (type = any (array[
    'activite', 'garde', 'manoeuvre', 'formation',
    'preventif', 'intervention', 'permanence', 'exercice',
    'reunion', 'transport', 'autre'
  ]::text[]));

-- ── Adresse structurée ─────────────────────────────────────────────
alter table public.activites_secours
  add column if not exists adresse_mode text not null default 'exacte';

alter table public.activites_secours
  add column if not exists adresse_rue text;

alter table public.activites_secours
  add column if not exists adresse_numero text;

alter table public.activites_secours
  add column if not exists adresse_cp text;

alter table public.activites_secours
  add column if not exists adresse_ville text;

alter table public.activites_secours
  drop constraint if exists activites_secours_adresse_mode;

alter table public.activites_secours
  add constraint activites_secours_adresse_mode
  check (adresse_mode in ('exacte', 'approximative'));

alter table public.activites_secours
  drop constraint if exists activites_secours_adresse_rue;

alter table public.activites_secours
  add constraint activites_secours_adresse_rue
  check (adresse_rue is null or char_length(adresse_rue) <= 180);

alter table public.activites_secours
  drop constraint if exists activites_secours_adresse_numero;

alter table public.activites_secours
  add constraint activites_secours_adresse_numero
  check (adresse_numero is null or char_length(adresse_numero) <= 20);

alter table public.activites_secours
  drop constraint if exists activites_secours_adresse_cp;

alter table public.activites_secours
  add constraint activites_secours_adresse_cp
  check (adresse_cp is null or char_length(adresse_cp) <= 12);

alter table public.activites_secours
  drop constraint if exists activites_secours_adresse_ville;

alter table public.activites_secours
  add constraint activites_secours_adresse_ville
  check (adresse_ville is null or char_length(adresse_ville) <= 120);

comment on column public.activites_secours.adresse_mode is
  'exacte = rue + numéro ; approximative = code postal + ville.';
comment on column public.activites_secours.adresse is
  'Libellé composé pour affichage / cartes (dérivé des champs structurés).';

-- ── Commandement du préventif ──────────────────────────────────────
alter table public.activites_secours
  add column if not exists responsable_preventif_id uuid references public.profiles(id) on delete set null;

alter table public.activites_secours
  add column if not exists disp_alpha_id uuid references public.profiles(id) on delete set null;

alter table public.activites_secours
  add column if not exists disp_bravo_id uuid references public.profiles(id) on delete set null;

comment on column public.activites_secours.responsable_preventif_id is
  'Responsable du préventif pour cette activité.';
comment on column public.activites_secours.disp_alpha_id is
  'Dispositif Alpha (commandement). Si un resp DPS est inscrit, il prend Alpha d’office.';
comment on column public.activites_secours.disp_bravo_id is
  'Dispositif Bravo (gros préventifs).';

-- ── Accès : uniquement responsables / adjoints DPS ─────────────────
create or replace function public.peut_creer_activite_secours()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select role::text as role, fiche
    from public.profiles
    where id = auth.uid()
  )
  select coalesce((
    select role = 'admin'
        or coalesce(
          fiche->'roles_asbl' ?| array['resp_dps', 'resp_dps_adjoint'],
          false
        )
    from me
  ), false)
$$;

revoke all on function public.peut_creer_activite_secours() from public, anon;
grant execute on function public.peut_creer_activite_secours() to authenticated, service_role;

notify pgrst, 'reload schema';
