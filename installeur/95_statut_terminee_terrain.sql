-- Statut « terminée terrain » : le retour base ne clôture plus le souhait.
-- Le personnel clôture ensuite dans le module Souhaits (Réalisé).
-- ALTER TYPE est isolé : la valeur ne peut pas servir dans la même transaction.

alter type public.statut_souhait add value if not exists 'terminee_terrain';

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
    when 'terminee_terrain' then 'Terminée terrain'
    when 'realise' then 'Réalisé'
    when 'demande_info_externe' then 'En attente d''informations'
    when 'non_realise' then 'Non réalisé'
    when 'annule' then 'Annulé'
    when 'planifie' then 'Planifié'
    when 'urgent' then 'Urgent'
    else coalesce(nullif(p, ''), '?')
  end
$$;

notify pgrst, 'reload schema';
