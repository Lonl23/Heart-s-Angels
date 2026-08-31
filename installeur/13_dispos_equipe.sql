-- ════════════════════════════════════════════════════════════════════════════
--  Responsables (transport, bénévoles, président, VP, informatique) :
--  encodage des disponibilités pour les autres volontaires.
--  Idempotent. Après 12_calendrier_dispos.sql.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.peut_gerer_dispos()
returns boolean language sql stable security definer set search_path = public as $$
  with me as (select role::text as role, fiche from public.profiles where id = auth.uid())
  select coalesce((
    select role in ('admin','president','coordinateur')
        or coalesce(fiche->'roles_asbl' ?| array[
             'president','vice_president',
             'coord_transport','coord_transport_adjoint',
             'coord_benevoles','coord_benevoles_adjoint',
             'resp_informatique','resp_informatique_adjoint','administrateur_asbl'
           ], false)
    from me
  ), false)
$$;

grant execute on function public.peut_gerer_dispos() to authenticated;

drop policy if exists dispos_insert on public.disponibilites;
drop policy if exists dispos_update on public.disponibilites;
drop policy if exists dispos_delete on public.disponibilites;

create policy dispos_insert on public.disponibilites for insert to authenticated
  with check (
    public.is_staff()
    and (user_id = auth.uid() or public.peut_gerer_dispos())
    and exists (select 1 from public.profiles p where p.id = user_id and p.role::text <> 'partenaire')
  );

create policy dispos_update on public.disponibilites for update to authenticated
  using (user_id = auth.uid() or public.peut_gerer_dispos())
  with check (
    public.is_staff()
    and (user_id = auth.uid() or public.peut_gerer_dispos())
    and exists (select 1 from public.profiles p where p.id = user_id and p.role::text <> 'partenaire')
  );

create policy dispos_delete on public.disponibilites for delete to authenticated
  using (user_id = auth.uid() or public.peut_gerer_dispos());

notify pgrst, 'reload schema';
