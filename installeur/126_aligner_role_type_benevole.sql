-- ════════════════════════════════════════════════════════════════════════════
--  Aligne rôle de compte médical / non médical avec fiche.type_benevole.
--  Les coordinateurs bénévoles peuvent basculer volontaire_medical ↔
--  volontaire_non_medical quand le type de la fiche correspond.
--  Idempotent. Après 125_modules_maintenance.sql.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.protege_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  type_b text;
  bascule_volontaire boolean;
begin
  if coalesce(current_setting('app.role_guard_off', true), '') = 'on' then
    return NEW;
  end if;

  type_b := coalesce(NEW.fiche->>'type_benevole', '');
  bascule_volontaire :=
    OLD.role::text in ('volontaire_medical', 'volontaire_non_medical')
    and NEW.role::text in ('volontaire_medical', 'volontaire_non_medical')
    and OLD.role is distinct from NEW.role
    and (
      (NEW.role::text = 'volontaire_medical' and type_b = 'medical')
      or (NEW.role::text = 'volontaire_non_medical' and type_b = 'non_medical')
    )
    and public.peut_gerer_fiches();

  if (coalesce(NEW.fiche->'roles_asbl', '[]'::jsonb)
        is distinct from coalesce(OLD.fiche->'roles_asbl', '[]'::jsonb))
     or (NEW.role is distinct from OLD.role and not bascule_volontaire)
  then
    if not public.is_admin() then
      raise exception 'Seul un administrateur peut modifier le rôle ou les rôles ASBL.';
    end if;
  end if;
  return NEW;
end
$$;

-- Répare les écarts déjà présents (TEST Test, etc.).
do $$
begin
  perform set_config('app.role_guard_off', 'on', true);
  update public.profiles
     set role = 'volontaire_medical'
   where role = 'volontaire_non_medical'
     and coalesce(fiche->>'type_benevole', '') = 'medical';
  update public.profiles
     set role = 'volontaire_non_medical'
   where role = 'volontaire_medical'
     and coalesce(fiche->>'type_benevole', '') = 'non_medical';
end
$$;

notify pgrst, 'reload schema';
