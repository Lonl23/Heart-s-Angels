-- ════════════════════════════════════════════════════════════════════════════
--  Souhait de formation : jamais archivé, déplaçable dans n’importe quelle
--  colonne (y compris depuis Réalisé / Non réalisé). L’encodage (protocole,
--  trajet, institutions, traitements, vecteurs) reste.
--  Idempotent. Après 73_sejour_documents.sql.
--  Réutilise public.est_souhait_demo (72) : fictif AND mission.demo_cle <> ''.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.souhait_est_archive(s public.souhaits)
returns boolean
language sql stable as $$
  select
    not public.est_souhait_demo(s.id)
    and (
      s.statut::text = 'non_realise'
      or (
        s.statut::text = 'realise'
        and public.date_verrouillage_souhait(s.date_realisee, s.updated_at) <= public.date_bruxelles()
      )
    )
$$;

comment on function public.souhait_est_archive(public.souhaits) is
  'Dossier verrouillé (non réalisé immédiat, réalisé +1 mois). Les souhaits de formation (est_souhait_demo) ne sont jamais archivés.';

create or replace function public.trg_demo_sortie_realise()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not public.est_souhait_demo(new.id) then
    return new;
  end if;
  if old.statut::text = 'realise' and new.statut::text is distinct from 'realise' then
    new.date_realisee := null;
    if new.mission is not null then
      new.mission := new.mission - array['cloture_le', 'demarre_le'];
    end if;
  end if;
  return new;
end
$$;

drop trigger if exists trg_demo_sortie_realise on public.souhaits;
create trigger trg_demo_sortie_realise
  before update on public.souhaits
  for each row execute function public.trg_demo_sortie_realise();

grant execute on function public.souhait_est_archive(public.souhaits) to authenticated;

notify pgrst, 'reload schema';
