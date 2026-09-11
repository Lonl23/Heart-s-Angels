-- ════════════════════════════════════════════════════════════════════════════
--  Notes de frais : indemnité kilométrique (récolte / hors base)
--  + invitations membres pour les gestionnaires de fiches.
--  Idempotent. Après 46_notes_frais_signatures.sql.
-- ════════════════════════════════════════════════════════════════════════════

comment on table public.notes_frais is
  'Note de frais mensuelle : forfait journalier + km (récolte de souhaits ou souhait hors de la base de la semaine).';
comment on column public.notes_frais.lignes_km is
  'Lignes km : date, motif (recolte|hors_base), activite, lieux, km A/R, montant (km × 0,4326). Pas les km du véhicule de mission depuis la base de la semaine.';

create or replace function public.peut_gerer_app()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with me as (select role::text as role, fiche from public.profiles where id = auth.uid())
  select coalesce((
    select role in ('admin', 'president')
        or coalesce(fiche->'roles_asbl' ?| array[
             'president', 'vice_president',
             'resp_informatique', 'resp_informatique_adjoint'
           ], false)
    from me
  ), false)
$$;

create or replace function public.peut_gerer_fiches()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with me as (select role::text as role, fiche from public.profiles where id = auth.uid())
  select coalesce((
    select role in ('admin', 'president')
        or coalesce(fiche->'roles_asbl' ?| array[
             'president', 'vice_president',
             'resp_informatique', 'resp_informatique_adjoint',
             'administrateur_asbl',
             'coord_benevoles', 'coord_benevoles_adjoint'
           ], false)
    from me
  ), false)
$$;

grant execute on function public.peut_gerer_app() to authenticated;
grant execute on function public.peut_gerer_fiches() to authenticated;

drop policy if exists invitations_admin_all on public.invitations;
drop policy if exists invitations_membres on public.invitations;
create policy invitations_membres on public.invitations
  for all to authenticated
  using (public.peut_gerer_fiches() and partenaire_id is null)
  with check (public.peut_gerer_fiches() and partenaire_id is null);

notify pgrst, 'reload schema';
