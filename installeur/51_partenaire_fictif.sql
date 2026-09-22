-- ════════════════════════════════════════════════════════════════════════════
--  Partenaire fictif : colonnes, héritage automatique, organisation de test.
--  Les missions/demandes d’un partenaire marqué fictif sont elles-mêmes fictives.
--  Idempotent. Après 50_invitation_type_benevole.sql.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.partenaires
  add column if not exists fictif boolean not null default false;

alter table public.demandes_souhaits
  add column if not exists fictif boolean not null default false;

alter table public.souhaits
  add column if not exists fictif boolean not null default false;

comment on column public.partenaires.fictif is
  'Organisation de démonstration : toutes ses demandes et missions sont fictives.';
comment on column public.demandes_souhaits.fictif is
  'Hérité du partenaire. Ne pas traiter comme une vraie demande.';
comment on column public.souhaits.fictif is
  'Hérité du partenaire. Mission de démonstration uniquement.';

create or replace function public.appliquer_fictif_depuis_partenaire()
returns trigger language plpgsql as $$
declare v boolean := false;
begin
  if new.partenaire_id is not null then
    select coalesce(p.fictif, false) into v
      from public.partenaires p where p.id = new.partenaire_id;
  end if;
  new.fictif := coalesce(v, false);
  return new;
end $$;

drop trigger if exists trg_demandes_fictif on public.demandes_souhaits;
create trigger trg_demandes_fictif
  before insert or update of partenaire_id, fictif on public.demandes_souhaits
  for each row execute function public.appliquer_fictif_depuis_partenaire();

drop trigger if exists trg_souhaits_fictif on public.souhaits;
create trigger trg_souhaits_fictif
  before insert or update of partenaire_id, fictif on public.souhaits
  for each row execute function public.appliquer_fictif_depuis_partenaire();

create or replace function public.propager_fictif_partenaire()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.fictif is not distinct from old.fictif then
    return new;
  end if;
  update public.demandes_souhaits set fictif = new.fictif where partenaire_id = new.id;
  update public.souhaits set fictif = new.fictif where partenaire_id = new.id;
  return new;
end $$;

drop trigger if exists trg_partenaires_fictif on public.partenaires;
create trigger trg_partenaires_fictif
  after insert or update of fictif on public.partenaires
  for each row execute function public.propager_fictif_partenaire();

-- Recalcul des lignes déjà liées à un partenaire fictif (aucune aujourd’hui, idempotent).
update public.demandes_souhaits d
set fictif = p.fictif
from public.partenaires p
where d.partenaire_id = p.id and d.fictif is distinct from p.fictif;

update public.souhaits s
set fictif = p.fictif
from public.partenaires p
where s.partenaire_id = p.id and s.fictif is distinct from p.fictif;

insert into public.partenaires (nom, type, contact_nom, contact_email, email_general, fictif, notes, actif)
select
  'Partenaire fictif (test)',
  'autre',
  'Laurent Noulin',
  'laurent.noulin@outlook.be',
  'laurent.noulin@outlook.be',
  true,
  'Organisation de démonstration. Toutes les demandes et missions issues de ce partenaire sont fictives.',
  true
where not exists (
  select 1 from public.partenaires p
  where lower(coalesce(p.email_general, p.contact_email, '')) = 'laurent.noulin@outlook.be'
     or lower(p.nom) = 'partenaire fictif (test)'
);

update public.partenaires
set fictif = true,
    contact_email = coalesce(nullif(contact_email, ''), 'laurent.noulin@outlook.be'),
    email_general = coalesce(nullif(email_general, ''), 'laurent.noulin@outlook.be'),
    notes = coalesce(nullif(notes, ''), 'Organisation de démonstration. Toutes les demandes et missions issues de ce partenaire sont fictives.')
where lower(nom) = 'partenaire fictif (test)'
   or lower(coalesce(email_general, contact_email, '')) = 'laurent.noulin@outlook.be';

-- Mes missions : exposer le drapeau fictif aux volontaires affectés.
drop function if exists public.mes_affectations();
create function public.mes_affectations()
returns table(
  souhait_id uuid,
  beneficiaire_prenom text,
  date_souhaitee date,
  date_fin date,
  dates_possibles jsonb,
  statut text,
  vehicule text,
  role_mission text,
  description text,
  lieu text,
  statut_base text,
  etape_vehicule text,
  tel_a_appeler text,
  tel_a_appeler_libelle text,
  origine text,
  medecin_tel text,
  medecin_nom text,
  fictif boolean
)
language sql stable security definer set search_path = public as $$
  select
    s.id,
    s.beneficiaire_prenom,
    s.date_souhaitee,
    s.date_fin,
    coalesce(s.dates_possibles, '[]'::jsonb),
    s.statut::text,
    coalesce(
      nullif(sp.vehicule, ''),
      (
        select e->>'nom'
        from jsonb_array_elements(coalesce(s.mission->'vecteurs', '[]'::jsonb)) e
        where e->>'id' = sp.vecteur_id
        limit 1
      )
    ),
    sp.role_mission,
    s.description,
    coalesce(
      s.mission->'dest_adresse'->>'localite',
      s.mission->'pec_adresse'->>'localite',
      s.localisation
    ),
    coalesce(sp.statut_base, s.mission->'personnel_statuts'->>sp.user_id::text),
    public.etape_du_vecteur(s.mission, sp.vecteur_id),
    public.coordonnees_appel(s.id)->>'tel',
    public.coordonnees_appel(s.id)->>'libelle',
    coalesce(s.origine, 'prive'),
    case when public.session_profil_est_medical(sp.role_mission)
         then public.medecin_equipe_pluri(s.mission)->>'tel' end,
    case when public.session_profil_est_medical(sp.role_mission)
         then public.medecin_equipe_pluri(s.mission)->>'nom' end,
    coalesce(s.fictif, false)
  from public.souhait_personnel sp
  join public.souhaits s on s.id = sp.souhait_id
  where sp.user_id = auth.uid()
  order by
    case s.statut::text
      when 'en_cours' then 0
      when 'pret' then 1
      when 'en_attente' then 2
      when 'nouveau' then 3
      else 4
    end,
    s.date_souhaitee nulls last
$$;

grant execute on function public.mes_affectations() to authenticated;

notify pgrst, 'reload schema';
