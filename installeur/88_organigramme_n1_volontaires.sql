-- ════════════════════════════════════════════════════════════════════════════
--  Le volontaire est le N. Les N+1 cochés sont Yves, Fernand, Carine, Laurent.
--  Ludovic, au-dessus d’eux, est le N+2.
--  Idempotent. Après 87_organigramme_volontaires.sql.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.organigramme
  add column if not exists n1_volontaires boolean not null default false;

comment on column public.organigramme.n1_volontaires is
  'Vrai si cette personne est un N+1 des volontaires. Le N+2 est alors la personne au-dessus.';

update public.organigramme
   set n1_volontaires = true
 where profile_id in (
   'f66320ba-40ec-4175-bf5f-2249c65e4056',
   '4e0b054a-80f2-4338-80ba-51f3910efe0d',
   'c65277a7-305b-43e5-8e7f-5f8f60088899',
   '077185df-e5d9-43c7-b162-e3b87330489c'
 );

-- Sylvie reste sous Ludovic, après les quatre N+1.
update public.organigramme o
   set ordre = 50
  from public.profiles p
 where p.id = o.profile_id
   and p.prenom = 'Sylvie' and p.nom = 'Massez'
   and o.n1_id = '2630edce-7503-424d-80aa-d5c140b7aca1';
