-- ════════════════════════════════════════════════════════════════════════════
--  Motif de non-réalisation : visible dans la liste uniquement pour les rôles
--  qui peuvent rouvrir un souhait verrouillé (PIN). Les autres ne le voient pas.
--  Idempotent. Après 60_verrou_non_realise.sql.
-- ════════════════════════════════════════════════════════════════════════════

drop function if exists public.lister_souhaits_verrouilles();
create function public.lister_souhaits_verrouilles()
returns table (
  id uuid,
  beneficiaire_prenom text,
  description text,
  localisation text,
  date_souhaitee date,
  date_realisee date,
  statut text,
  verrouille boolean,
  motif_non_realise text
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    s.id,
    s.beneficiaire_prenom,
    s.description,
    s.localisation,
    s.date_souhaitee,
    s.date_realisee,
    s.statut::text,
    true,
    case
      when s.statut::text = 'non_realise' and public.peut_ouvrir_archives()
        then nullif(btrim(s.mission->>'motif_non_realise'), '')
      else null
    end
  from public.souhaits s
  where public.peut_voir_souhaits()
    and public.souhait_est_archive(s)
  order by
    case s.statut::text when 'non_realise' then 1 else 0 end,
    s.date_realisee desc nulls last,
    s.updated_at desc
$$;

grant execute on function public.lister_souhaits_verrouilles() to authenticated;

notify pgrst, 'reload schema';
