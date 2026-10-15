-- ════════════════════════════════════════════════════════════════════════════
--  Suivi interne de tous les souhaits encodés : journal des changements de
--  colonne / statut (de → vers, prénom, nom, horodatage) et des messages
--  (prénom, nom, texte). Les notes déjà présentes restent. Idempotent.
--  Après 83_demo_rejeu_formation.sql.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.souhait_suivi
  add column if not exists auteur_prenom text,
  add column if not exists auteur_nom text,
  add column if not exists de_statut text,
  add column if not exists vers_statut text;

comment on column public.souhait_suivi.auteur_prenom is
  'Prénom figé au moment de l’écriture (le journal reste lisible si la fiche change).';
comment on column public.souhait_suivi.auteur_nom is
  'Nom figé au moment de l’écriture.';
comment on column public.souhait_suivi.de_statut is
  'Ancien statut (journal automatique des colonnes).';
comment on column public.souhait_suivi.vers_statut is
  'Nouveau statut (journal automatique des colonnes).';

create or replace function public.libelle_statut_souhait(p text)
returns text
language sql
immutable
as $$
  select case p
    when 'nouveau' then 'Nouveau'
    when 'en_attente' then 'En attente'
    when 'pret' then 'Prêt à réaliser'
    when 'en_cours' then 'En cours'
    when 'realise' then 'Réalisé'
    when 'demande_info_externe' then 'En attente d''informations'
    when 'non_realise' then 'Non réalisé'
    when 'annule' then 'Annulé'
    when 'planifie' then 'Planifié'
    when 'urgent' then 'Urgent'
    else coalesce(nullif(p, ''), '?')
  end
$$;

grant execute on function public.libelle_statut_souhait(text) to authenticated;

-- Complète prénom / nom / profile_id à l’insert, sans écraser une saisie.
create or replace function public.trg_souhait_suivi_auteur()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.profiles;
begin
  if new.profile_id is null then
    new.profile_id := auth.uid();
  end if;
  if new.profile_id is not null
     and (coalesce(new.auteur_prenom, '') = '' or coalesce(new.auteur_nom, '') = '')
  then
    select * into p from public.profiles where id = new.profile_id;
    if found then
      if coalesce(new.auteur_prenom, '') = '' then new.auteur_prenom := p.prenom; end if;
      if coalesce(new.auteur_nom, '') = '' then new.auteur_nom := p.nom; end if;
    end if;
  end if;
  return new;
end
$$;

drop trigger if exists trg_souhait_suivi_auteur on public.souhait_suivi;
create trigger trg_souhait_suivi_auteur
  before insert on public.souhait_suivi
  for each row execute function public.trg_souhait_suivi_auteur();

-- Qui a déplacé la colonne / changé le statut de préparation.
create or replace function public.trg_souhait_suivi_statut()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  prenom text;
  nom text;
begin
  if tg_op <> 'UPDATE' then return new; end if;
  if old.statut is not distinct from new.statut then return new; end if;

  if uid is not null then
    select pr.prenom, pr.nom into prenom, nom
      from public.profiles pr where pr.id = uid;
  end if;

  insert into public.souhait_suivi (
    souhait_id, profile_id, type_contact, contenu,
    auteur_prenom, auteur_nom, de_statut, vers_statut
  ) values (
    new.id,
    uid,
    'statut',
    'Statut : '
      || public.libelle_statut_souhait(old.statut::text)
      || ' → '
      || public.libelle_statut_souhait(new.statut::text),
    coalesce(prenom, ''),
    coalesce(nullif(nom, ''), case when uid is null then 'Système' else '' end),
    old.statut::text,
    new.statut::text
  );
  return new;
end
$$;

drop trigger if exists trg_souhait_suivi_statut on public.souhaits;
create trigger trg_souhait_suivi_statut
  after update on public.souhaits
  for each row
  when (old.statut is distinct from new.statut)
  execute function public.trg_souhait_suivi_statut();

-- Notes déjà présentes : on complète prénom/nom sans rien effacer.
update public.souhait_suivi su
   set auteur_prenom = coalesce(nullif(su.auteur_prenom, ''), p.prenom),
       auteur_nom    = coalesce(nullif(su.auteur_nom, ''), p.nom)
  from public.profiles p
 where su.profile_id = p.id
   and (coalesce(su.auteur_prenom, '') = '' or coalesce(su.auteur_nom, '') = '');

-- RLS : le personnel lit et écrit le journal ; les anciennes politiques restent.
alter table public.souhait_suivi enable row level security;

drop policy if exists suivi_staff_all on public.souhait_suivi;
create policy suivi_staff_all on public.souhait_suivi for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

notify pgrst, 'reload schema';
