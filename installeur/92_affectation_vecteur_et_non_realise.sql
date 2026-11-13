-- Une affectation sur un souhait non réalisé ne compte pas.
-- Un équipier rattaché à un vecteur supprimé revient sur le vecteur restant.

create or replace function public.trg_refus_affectation_non_realise()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  st text;
begin
  select s.statut::text into st from public.souhaits s where s.id = new.souhait_id;
  if st = 'non_realise' then
    raise exception 'Ce souhait est non réalisé.';
  end if;
  return new;
end
$$;

drop trigger if exists trg_refus_affectation_non_realise on public.souhait_personnel;
create trigger trg_refus_affectation_non_realise
  before insert on public.souhait_personnel
  for each row
  execute function public.trg_refus_affectation_non_realise();

delete from public.souhait_personnel sp
using public.souhaits s
where sp.souhait_id = s.id
  and s.statut::text = 'non_realise';

update public.souhait_personnel sp
set vecteur_id = s.mission->'vecteurs'->0->>'id'
from public.souhaits s
where sp.souhait_id = s.id
  and jsonb_typeof(s.mission->'vecteurs') = 'array'
  and jsonb_array_length(s.mission->'vecteurs') = 1
  and coalesce(s.mission->'vecteurs'->0->>'id', '') <> ''
  and not exists (
    select 1
    from jsonb_array_elements(s.mission->'vecteurs') v
    where v->>'id' = sp.vecteur_id
  );
