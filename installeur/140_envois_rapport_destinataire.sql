-- Traçabilité enrichie des envois de rapport médical : nom/prénom du destinataire.
-- Idempotent.

alter table public.envois_rapport_medical
  add column if not exists destinataire_prenom text,
  add column if not exists destinataire_nom text;

comment on column public.envois_rapport_medical.destinataire_prenom is 'Prénom du destinataire du rapport médical';
comment on column public.envois_rapport_medical.destinataire_nom is 'Nom du destinataire du rapport médical';
comment on column public.envois_rapport_medical.email is 'Adresse e-mail du destinataire';
comment on column public.envois_rapport_medical.expediteur_id is 'Compte application qui a déclenché l’envoi';
