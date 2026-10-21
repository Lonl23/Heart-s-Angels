-- Le souhait de formation (mission.demo_cle) doit accepter un DAR individuel.
-- Le drapeau fictif était remis à faux dès que le partenaire était retiré,
-- donc la base ne le reconnaissait plus comme une formation et refusait
-- l'insertion (row-level security sur souhait_dar_cibles).

create or replace function public.est_souhait_demo(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.souhaits s
    where s.id = p_id
      and coalesce(s.mission->>'demo_cle', '') <> ''
  )
$$;

create or replace function public.est_souhait_demo_ouvert(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.souhaits s
    where s.id = p_id
      and coalesce(s.mission->>'demo_cle', '') <> ''
      and s.statut::text not in ('non_realise', 'annule', 'demande_info_externe')
  )
$$;

create or replace function public.appliquer_fictif_depuis_partenaire()
returns trigger
language plpgsql
as $$
declare
  v boolean := false;
begin
  if tg_table_name = 'souhaits'
     and coalesce(new.mission->>'demo_cle', '') <> '' then
    new.fictif := true;
    return new;
  end if;
  if new.partenaire_id is not null then
    select coalesce(p.fictif, false) into v
      from public.partenaires p where p.id = new.partenaire_id;
  end if;
  new.fictif := coalesce(v, false);
  return new;
end $$;

update public.souhaits
set fictif = true
where coalesce(mission->>'demo_cle', '') <> ''
  and fictif is distinct from true;

notify pgrst, 'reload schema';
