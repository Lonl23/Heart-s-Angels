-- Photos de fond sur chaque page et chaque module.
-- L'écriture est réservée à l'équipe informatique (responsable, adjoint)
-- et au compte admin. La présidence ne change plus ces images.

do $$
declare c text;
begin
  select con.conname into c
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public' and rel.relname = 'app_fonds_pages'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%page%';
  if c is not null then
    execute format('alter table public.app_fonds_pages drop constraint %I', c);
  end if;
end $$;

alter table public.app_fonds_pages
  add constraint app_fonds_pages_page_check
  check (page in (
    'login', 'demande', 'partenaire', 'dashboard',
    'garde_rh', 'garde_souhaits', 'garde_secours', 'garde_it', 'garde_logistique', 'garde_tresorerie',
    'profil', 'volontaires', 'defraiements', 'annuaire', 'organigramme', 'evenements', 'actualites',
    'souhaits', 'missions', 'disponibilites', 'activites_secours',
    'helpdesk', 'personnalisation', 'admin', 'organigramme_edition', 'config_souhaits',
    'actualites_edition', 'statistiques', 'stock', 'tresorerie'
  ));

insert into public.app_fonds_pages (page) values
  ('login'), ('demande'), ('partenaire'), ('dashboard'),
  ('garde_rh'), ('garde_souhaits'), ('garde_secours'), ('garde_it'), ('garde_logistique'), ('garde_tresorerie'),
  ('profil'), ('volontaires'), ('defraiements'), ('annuaire'), ('organigramme'), ('evenements'), ('actualites'),
  ('souhaits'), ('missions'), ('disponibilites'), ('activites_secours'),
  ('helpdesk'), ('personnalisation'), ('admin'), ('organigramme_edition'), ('config_souhaits'),
  ('actualites_edition'), ('statistiques'), ('stock'), ('tresorerie')
on conflict (page) do nothing;

comment on table public.app_fonds is
  'Images de fond posées par l’équipe informatique. Décoratives, pas de données de santé.';
comment on table public.app_fonds_pages is
  'Quelle image s’affiche sur quelle page ou quel module, avec un voile pour garder le texte lisible.';

drop policy if exists app_fonds_write on public.app_fonds;
create policy app_fonds_write on public.app_fonds
  for all to authenticated
  using (public.peut_gerer_helpdesk())
  with check (public.peut_gerer_helpdesk());

drop policy if exists app_fonds_pages_write on public.app_fonds_pages;
create policy app_fonds_pages_write on public.app_fonds_pages
  for all to authenticated
  using (public.peut_gerer_helpdesk())
  with check (public.peut_gerer_helpdesk());

drop policy if exists fonds_app_insert on storage.objects;
create policy fonds_app_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'fonds-app' and public.peut_gerer_helpdesk());

drop policy if exists fonds_app_update on storage.objects;
create policy fonds_app_update on storage.objects
  for update to authenticated
  using (bucket_id = 'fonds-app' and public.peut_gerer_helpdesk());

drop policy if exists fonds_app_delete on storage.objects;
create policy fonds_app_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'fonds-app' and public.peut_gerer_helpdesk());

notify pgrst, 'reload schema';
