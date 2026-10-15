-- ════════════════════════════════════════════════════════════════════════════
--  Envoi automatique des invitations (e-mail depuis laurent@heartsangels.be).
--  La fonction Edge envoyer-invitation pose la date d’envoi.
-- ════════════════════════════════════════════════════════════════════════════
alter table public.invitations
  add column if not exists envoyee_le timestamptz,
  add column if not exists envoyee_par uuid references public.profiles(id) on delete set null;

comment on column public.invitations.envoyee_le is
  'Dernier envoi automatique du mail d’invitation (pièce jointe PDF pour un volontaire).';

notify pgrst, 'reload schema';
