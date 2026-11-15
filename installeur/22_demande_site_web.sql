-- ════════════════════════════════════════════════════════════════════════════
--  Formulaire « Demande de souhait » du site WordPress.
--  Le site continue d'envoyer l'e-mail, et enregistre aussi le dossier dans
--  demandes_souhaits. Idempotent. Après 02_acces_partenaire.sql.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.demandes_souhaits
  add column if not exists complements jsonb;

-- Une insertion anonyme (formulaire public) ne peut pas choisir le statut,
-- se rattacher à un partenaire, ni lier un souhait déjà créé.
create or replace function public.demandes_externe_verrouille()
returns trigger
language plpgsql
as $$
begin
  if current_user = 'anon' or coalesce(auth.role(), '') = 'anon' then
    new.statut := 'nouvelle';
    new.partenaire_id := null;
    new.cree_par := null;
    new.assignee_a := null;
    new.souhait_id := null;
    new.notes_internes := null;
    new.source := 'externe';
    new.fictif := false;
    if new.complements is not null and octet_length(new.complements::text) > 20000 then
      raise exception 'Dossier trop volumineux';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_demandes_externe_verrouille on public.demandes_souhaits;
create trigger trg_demandes_externe_verrouille
  before insert on public.demandes_souhaits
  for each row execute function public.demandes_externe_verrouille();

-- Le déclencheur fictif lisait new.mission même sur une demande, ce qui
-- rejetait toute insertion publique (la table demandes n'a pas cette colonne).
create or replace function public.appliquer_fictif_depuis_partenaire()
returns trigger
language plpgsql
as $$
declare
  v boolean := false;
begin
  if tg_table_name = 'souhaits' then
    if coalesce(new.mission->>'demo_cle', '') <> '' then
      new.fictif := true;
      return new;
    end if;
  end if;
  if new.partenaire_id is not null then
    select coalesce(p.fictif, false) into v
      from public.partenaires p where p.id = new.partenaire_id;
  end if;
  new.fictif := coalesce(v, false);
  return new;
end;
$$;
