-- ════════════════════════════════════════════════════════════════════════════
--  ERP échelle ASBL — flotte (plaque sur lieux véhicule) + RLS défraiements
--  Idempotent. Après 21_statuts_terrain.sql.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.stock_lieux
  add column if not exists plaque text;

comment on column public.stock_lieux.plaque is
  'Plaque d’immatriculation si type = vehicule (flotte ERP).';

-- RLS défraiements (table créée dans 01_rebuild_interne.sql)
alter table public.defraiements enable row level security;

create or replace function public.peut_valider_defraiement_n1()
returns boolean language sql stable security definer set search_path = public as $$
  with me as (select role::text as role, fiche from public.profiles where id = auth.uid())
  select coalesce((
    select role in ('admin','president','coordinateur','tresorier')
        or coalesce(fiche->'roles_asbl' ?| array[
             'president','vice_president',
             'coord_benevoles','coord_benevoles_adjoint',
             'coord_transport','coord_transport_adjoint',
             'tresorier','tresorier_adjoint'
           ], false)
    from me
  ), false)
$$;

create or replace function public.peut_valider_defraiement_n2()
returns boolean language sql stable security definer set search_path = public as $$
  with me as (select role::text as role, fiche from public.profiles where id = auth.uid())
  select coalesce((
    select role in ('admin','president','tresorier')
        or coalesce(fiche->'roles_asbl' ?| array[
             'president','vice_president','tresorier','tresorier_adjoint','administrateur_asbl'
           ], false)
    from me
  ), false)
$$;

grant execute on function public.peut_valider_defraiement_n1() to authenticated;
grant execute on function public.peut_valider_defraiement_n2() to authenticated;

drop policy if exists defraiements_select on public.defraiements;
create policy defraiements_select on public.defraiements for select to authenticated
  using (
    user_id = auth.uid()
    or public.peut_valider_defraiement_n1()
    or public.peut_valider_defraiement_n2()
  );

drop policy if exists defraiements_insert on public.defraiements;
create policy defraiements_insert on public.defraiements for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists defraiements_update on public.defraiements;
create policy defraiements_update on public.defraiements for update to authenticated
  using (
    (user_id = auth.uid() and statut = 'en_attente')
    or public.peut_valider_defraiement_n1()
    or public.peut_valider_defraiement_n2()
  );

drop policy if exists defraiements_delete on public.defraiements;
create policy defraiements_delete on public.defraiements for delete to authenticated
  using (user_id = auth.uid() and statut = 'en_attente');
