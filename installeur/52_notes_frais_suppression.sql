-- ════════════════════════════════════════════════════════════════════════════
--  Suppression complète d’une note de frais par le responsable informatique.
--  Idempotent. Après 51_partenaire_fictif.sql.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.est_informatique_notes()
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
             'resp_informatique', 'resp_informatique_adjoint',
             'president', 'vice_president', 'administrateur_asbl'
           ], false)
    from me
  ), false)
$$;

comment on function public.est_informatique_notes() is
  'Présidence, administration ASBL et équipe informatique : suppression définitive des notes de frais.';

create or replace function public.supprimer_note_frais(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  n public.notes_frais;
begin
  if auth.uid() is null then
    raise exception 'Non authentifié.';
  end if;
  if not public.est_informatique_notes() then
    raise exception 'La suppression complète est réservée au responsable informatique.';
  end if;
  select * into n from public.notes_frais where id = p_id for update;
  if n.id is null then
    raise exception 'Note introuvable.';
  end if;
  delete from public.notes_frais where id = p_id;
  return true;
end $$;

comment on function public.supprimer_note_frais(uuid) is
  'Efface définitivement une note de frais, quel que soit son statut. Équipe informatique uniquement.';

drop policy if exists notes_frais_delete on public.notes_frais;
create policy notes_frais_delete on public.notes_frais
  for delete to authenticated
  using (
    (user_id = auth.uid() and statut in ('en_attente', 'refuse'))
    or public.est_informatique_notes()
  );

grant execute on function public.est_informatique_notes() to authenticated;
grant execute on function public.supprimer_note_frais(uuid) to authenticated;

notify pgrst, 'reload schema';
