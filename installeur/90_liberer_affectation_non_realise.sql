-- Quand un souhait passe en non réalisé, l’équipage est libéré.
-- Les disponibilités des volontaires restent en place.

create or replace function public.trg_liberer_affectation_non_realise()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;
  if new.statut::text is distinct from 'non_realise' then
    return new;
  end if;
  if old.statut::text is not distinct from 'non_realise' then
    return new;
  end if;

  delete from public.souhait_personnel where souhait_id = new.id;

  new.mission := jsonb_set(
    coalesce(new.mission, '{}'::jsonb),
    '{attente}',
    coalesce(new.mission->'attente', '{}'::jsonb) || jsonb_build_object('equipage', true),
    true
  );
  return new;
end
$$;

drop trigger if exists trg_liberer_affectation_non_realise on public.souhaits;
create trigger trg_liberer_affectation_non_realise
  before update of statut on public.souhaits
  for each row
  execute function public.trg_liberer_affectation_non_realise();

delete from public.souhait_personnel sp
using public.souhaits s
where sp.souhait_id = s.id
  and s.statut::text = 'non_realise';
