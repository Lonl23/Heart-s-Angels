-- ════════════════════════════════════════════════════════════════════════════
--  Inscriptions : extra JSON (repas adultes / enfants).
--  Événement Relais pour la Vie Seraing (16 oct. 2026) — idempotent.
--  Après 79_evenements_inscriptions.sql.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.evenements_internes_inscrits
  add column if not exists extra jsonb not null default '{}'::jsonb;

comment on column public.evenements_internes_inscrits.extra is
  'Détails d’inscription (ex. {"adultes":1,"enfants":0}).';

drop policy if exists evenements_inscrits_update on public.evenements_internes_inscrits;
create policy evenements_inscrits_update on public.evenements_internes_inscrits
  for update to authenticated
  using (public.is_staff() and user_id = auth.uid())
  with check (public.is_staff() and user_id = auth.uid());

do $seed$
declare
  eid uuid;
  page text := $ha$<div class="ha-relais">
  <div class="ha-relais-entete">
    <div>
      <p class="ha-relais-org">Relais pour la Vie Seraing</p>
      <p class="ha-relais-sub">Fondation contre le cancer</p>
    </div>
    <p class="ha-relais-ha">Heart’s Angels<br>bénévoles invités</p>
  </div>
  <h2 class="ha-relais-titre">Repas et soirée du Relais pour la Vie Seraing</h2>
  <div class="ha-relais-date">Vendredi 16 octobre dès 18h30</div>
  <div class="ha-relais-photo">
    <img src="/evenements/relais-assiette.jpg" alt="Boulets frites">
  </div>
  <div class="ha-relais-corps">
    <p>Chers bénévoles, l’équipe d’animation du Relais pour la Vie de Seraing nous invite chaleureusement à leur souper et soirée dansante. Une belle occasion de se retrouver dans un cadre festif, et de continuer à soutenir cette cause.</p>
    <p class="ha-relais-menu"><strong>Boulets frites + dessert</strong><br>Soirée dansante avec l’équipe animation du Relais<br>Boissons à prix démocratique</p>
    <p style="text-align:center">Accueil dès 18h30 · repas vers 20h00</p>
    <div class="ha-relais-prix">
      <div class="ha-relais-bulle"><span>Adultes</span><strong>25 €</strong></div>
      <div class="ha-relais-bulle"><span>Enfants</span><strong>12,50 €</strong></div>
    </div>
    <p class="ha-relais-lieu"><strong>Salle René Delbrouck (Rialto)</strong><br>Rue René Delbrouck, 40 à Seraing</p>
    <div class="ha-relais-iban">
      <p><strong>Paiement</strong> après inscription : compte <strong>BE42 0689 4850 7554</strong><br>Communication : PRÉNOM + NOM + NOMBRE DE REPAS</p>
      <p>Inscrivez-vous <strong>ici dans l’application</strong> (nombre de repas adultes et enfants ci-dessous) pour la table Heart’s Angels. Le SMS du flyer n’est plus nécessaire pour notre équipe.</p>
      <p><small>L’appel à confirmation visait le 30 septembre ; l’événement a lieu le 16 octobre. Merci de vous inscrire au plus vite pour la logistique de table.</small></p>
    </div>
  </div>
  <img src="/evenements/relais-seraing.jpg" alt="Affiche Relais pour la Vie Seraing">
</div>$ha$;
begin
  select id into eid
  from public.evenements_internes
  where date_debut = date '2026-10-16'
    and titre = 'Repas et soirée — Relais pour la Vie'
  limit 1;
  if eid is null then
    insert into public.evenements_internes (titre, date_debut, date_fin, html_page, vignette_path)
    values (
      'Repas et soirée — Relais pour la Vie',
      date '2026-10-16',
      date '2026-10-16',
      page,
      '/evenements/relais-vignette.jpg'
    );
  else
    update public.evenements_internes
       set html_page = page,
           vignette_path = '/evenements/relais-vignette.jpg',
           date_debut = date '2026-10-16',
           date_fin = date '2026-10-16',
           updated_at = now()
     where id = eid;
  end if;
end
$seed$;

notify pgrst, 'reload schema';
