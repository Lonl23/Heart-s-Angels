-- ════════════════════════════════════════════════════════════════════════════
--  Double authentification (TOTP). Connexion Google retirée (Workspace).
--  Idempotent. Après 84_suivi_interne_journal.sql.
-- ════════════════════════════════════════════════════════════════════════════

-- Réglage admin : exiger la 2FA pour le personnel (désactivé par défaut).
create table if not exists public.app_reglages (
  cle         text primary key,
  valeur      jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

alter table public.app_reglages enable row level security;

insert into public.app_reglages (cle, valeur)
values ('mfa', jsonb_build_object('obligatoire', false))
on conflict (cle) do nothing;

comment on table public.app_reglages is
  'Réglages d’application (ex. 2FA obligatoire). Pas de données de santé.';

drop policy if exists app_reglages_select on public.app_reglages;
create policy app_reglages_select on public.app_reglages
  for select to authenticated
  using (true);

drop policy if exists app_reglages_write on public.app_reglages;
create policy app_reglages_write on public.app_reglages
  for all to authenticated
  using (public.peut_gerer_app())
  with check (public.peut_gerer_app());

grant select on public.app_reglages to authenticated;
grant insert, update, delete on public.app_reglages to authenticated, service_role;

notify pgrst, 'reload schema';
