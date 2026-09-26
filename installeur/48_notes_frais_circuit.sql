-- ════════════════════════════════════════════════════════════════════════════
--  Circuit défraiements : valider = signer (sans dessin).
--  Traçabilité demande / vérification / autorisation / virement
--  + communication structurée belge (OGM) par note.
--  Idempotent. Après 47_notes_frais_km.sql.
-- ════════════════════════════════════════════════════════════════════════════

alter type public.statut_defraiement add value if not exists 'soumise';
alter type public.statut_defraiement add value if not exists 'verifiee';

create sequence if not exists public.notes_frais_ogm_seq;

alter table public.notes_frais
  add column if not exists communication text,
  add column if not exists communication_base bigint,
  add column if not exists demande_par uuid references public.profiles(id) on delete set null,
  add column if not exists demande_at timestamptz,
  add column if not exists demande_nom text,
  add column if not exists demande_fonction text,
  add column if not exists verifie_par uuid references public.profiles(id) on delete set null,
  add column if not exists verifie_at timestamptz,
  add column if not exists verifie_nom text,
  add column if not exists verifie_fonction text,
  add column if not exists autorise_par uuid references public.profiles(id) on delete set null,
  add column if not exists autorise_at timestamptz,
  add column if not exists autorise_nom text,
  add column if not exists autorise_fonction text,
  add column if not exists virement_par uuid references public.profiles(id) on delete set null,
  add column if not exists virement_at timestamptz,
  add column if not exists virement_nom text,
  add column if not exists virement_fonction text,
  add column if not exists refuse_par uuid references public.profiles(id) on delete set null,
  add column if not exists refuse_at timestamptz,
  add column if not exists refuse_nom text;

comment on column public.notes_frais.communication is
  'Communication structurée belge +++XXX/XXXX/XXXXX+++, unique, pour le virement et la comptabilité.';
comment on column public.notes_frais.demande_par is
  'Volontaire qui a validé (soumis) la demande. Cette validation vaut signature.';
comment on column public.notes_frais.verifie_par is
  'Personne qui a vérifié les montants et pièces de la demande.';
comment on column public.notes_frais.autorise_par is
  'Personne qui a autorisé le paiement.';
comment on column public.notes_frais.virement_par is
  'Personne qui a effectué le virement bancaire.';

create unique index if not exists notes_frais_communication_uidx
  on public.notes_frais (communication)
  where communication is not null;

create or replace function public.fmt_communication_structuree(p_base bigint)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  ten text;
  chk int;
  twelve text;
begin
  if p_base is null or p_base < 0 then
    return null;
  end if;
  ten := lpad((p_base % 10000000000)::text, 10, '0');
  chk := (ten::numeric % 97)::int;
  if chk = 0 then chk := 97; end if;
  twelve := ten || lpad(chk::text, 2, '0');
  return '+++' || substr(twelve, 1, 3) || '/' || substr(twelve, 4, 4) || '/' || substr(twelve, 8, 5) || '+++';
end $$;

create or replace function public.attribuer_communication_note()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
begin
  return (extract(year from current_date)::bigint % 100) * 100000000::bigint
       + nextval('public.notes_frais_ogm_seq');
end $$;

create or replace function public.tampon_acteur_note()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  p public.profiles%rowtype;
  nom text;
  fonc text;
  roles text[];
  priorite text[] := array[
    'president', 'vice_president', 'tresorier', 'tresorier_adjoint',
    'administrateur_asbl', 'resp_informatique', 'resp_informatique_adjoint'
  ];
  r text;
begin
  if auth.uid() is null then
    raise exception 'Connexion requise.';
  end if;
  select * into p from public.profiles where id = auth.uid();
  if p.id is null then
    raise exception 'Profil introuvable.';
  end if;
  nom := nullif(btrim(coalesce(p.nom, '') || ' ' || coalesce(p.prenom, '')), '');
  if nom is null then nom := coalesce(p.email, 'Utilisateur'); end if;

  roles := coalesce(array(select jsonb_array_elements_text(coalesce(p.fiche->'roles_asbl', '[]'::jsonb))), array[]::text[]);
  fonc := null;
  foreach r in array priorite loop
    if r = any (roles) then
      fonc := case r
        when 'president' then 'Président'
        when 'vice_president' then 'Vice-président'
        when 'tresorier' then 'Trésorier'
        when 'tresorier_adjoint' then 'Trésorier adjoint'
        when 'administrateur_asbl' then 'Administrateur de l’ASBL'
        when 'resp_informatique' then 'Responsable informatique'
        when 'resp_informatique_adjoint' then 'Adjoint informatique'
      end;
      exit;
    end if;
  end loop;
  if fonc is null then
    fonc := case p.role::text
      when 'admin' then 'Administrateur'
      when 'president' then 'Président'
      when 'tresorier' then 'Trésorier'
      else 'Volontaire'
    end;
  end if;

  return jsonb_build_object('id', p.id, 'nom', nom, 'fonction', fonc);
end $$;

create or replace function public.soumettre_note_frais(p_id uuid)
returns public.notes_frais
language plpgsql
security definer
set search_path = public
as $$
declare
  n public.notes_frais;
  a jsonb;
  nb int;
begin
  select * into n from public.notes_frais where id = p_id for update;
  if n.id is null then raise exception 'Note introuvable.'; end if;
  if n.user_id <> auth.uid() then
    raise exception 'Seul le volontaire concerné peut valider sa demande. Cette validation vaut signature.';
  end if;
  if n.statut::text not in ('en_attente', 'refuse') then
    raise exception 'Cette note n’est plus un brouillon.';
  end if;
  if coalesce(btrim(n.iban), '') = '' then
    raise exception 'Indiquez un IBAN avant de soumettre.';
  end if;
  nb := coalesce(jsonb_array_length(n.lignes_forfait), 0) + coalesce(jsonb_array_length(n.lignes_km), 0);
  if nb < 1 then
    raise exception 'Ajoutez au moins un jour ou un trajet avant de soumettre.';
  end if;
  a := public.tampon_acteur_note();
  if n.communication_base is null then
    n.communication_base := public.attribuer_communication_note();
    n.communication := public.fmt_communication_structuree(n.communication_base);
  end if;
  update public.notes_frais set
    statut = 'soumise',
    communication = n.communication,
    communication_base = n.communication_base,
    demande_par = (a->>'id')::uuid,
    demande_at = now(),
    demande_nom = a->>'nom',
    demande_fonction = a->>'fonction',
    verifie_par = null, verifie_at = null, verifie_nom = null, verifie_fonction = null,
    autorise_par = null, autorise_at = null, autorise_nom = null, autorise_fonction = null,
    virement_par = null, virement_at = null, virement_nom = null, virement_fonction = null,
    motif_refus = null,
    refuse_par = null, refuse_at = null, refuse_nom = null
  where id = p_id
  returning * into n;
  return n;
end $$;

create or replace function public.retirer_note_frais(p_id uuid)
returns public.notes_frais
language plpgsql
security definer
set search_path = public
as $$
declare
  n public.notes_frais;
begin
  select * into n from public.notes_frais where id = p_id for update;
  if n.id is null then raise exception 'Note introuvable.'; end if;
  if n.user_id <> auth.uid() then
    raise exception 'Seul le volontaire peut retirer sa demande.';
  end if;
  if n.statut::text <> 'soumise' then
    raise exception 'La demande ne peut plus être retirée.';
  end if;
  update public.notes_frais set
    statut = 'en_attente',
    demande_par = null, demande_at = null, demande_nom = null, demande_fonction = null
  where id = p_id
  returning * into n;
  return n;
end $$;

create or replace function public.verifier_note_frais(p_id uuid)
returns public.notes_frais
language plpgsql
security definer
set search_path = public
as $$
declare
  n public.notes_frais;
  a jsonb;
begin
  if not public.est_tresorier_notes() then
    raise exception 'Vérification réservée à la trésorerie / présidence.';
  end if;
  select * into n from public.notes_frais where id = p_id for update;
  if n.id is null then raise exception 'Note introuvable.'; end if;
  if n.statut::text <> 'soumise' then
    raise exception 'La demande doit d’abord être soumise par le volontaire.';
  end if;
  a := public.tampon_acteur_note();
  update public.notes_frais set
    statut = 'verifiee',
    verifie_par = (a->>'id')::uuid,
    verifie_at = now(),
    verifie_nom = a->>'nom',
    verifie_fonction = a->>'fonction'
  where id = p_id
  returning * into n;
  return n;
end $$;

create or replace function public.autoriser_note_frais(p_id uuid)
returns public.notes_frais
language plpgsql
security definer
set search_path = public
as $$
declare
  n public.notes_frais;
  a jsonb;
begin
  if not public.est_tresorier_notes() then
    raise exception 'Autorisation réservée à la trésorerie / présidence.';
  end if;
  select * into n from public.notes_frais where id = p_id for update;
  if n.id is null then raise exception 'Note introuvable.'; end if;
  if n.statut::text <> 'verifiee' then
    raise exception 'La demande doit d’abord être vérifiée.';
  end if;
  a := public.tampon_acteur_note();
  update public.notes_frais set
    statut = 'approuve_n1',
    autorise_par = (a->>'id')::uuid,
    autorise_at = now(),
    autorise_nom = a->>'nom',
    autorise_fonction = a->>'fonction',
    valide_par = (a->>'id')::uuid,
    valide_at = now()
  where id = p_id
  returning * into n;
  return n;
end $$;

create or replace function public.virer_note_frais(p_id uuid)
returns public.notes_frais
language plpgsql
security definer
set search_path = public
as $$
declare
  n public.notes_frais;
  a jsonb;
begin
  if not public.est_tresorier_notes() then
    raise exception 'Le virement est réservé à la trésorerie / présidence.';
  end if;
  select * into n from public.notes_frais where id = p_id for update;
  if n.id is null then raise exception 'Note introuvable.'; end if;
  if n.statut::text not in ('approuve_n1', 'approuve_n2') then
    raise exception 'Le paiement doit d’abord être autorisé.';
  end if;
  a := public.tampon_acteur_note();
  update public.notes_frais set
    statut = 'paye',
    virement_par = (a->>'id')::uuid,
    virement_at = now(),
    virement_nom = a->>'nom',
    virement_fonction = a->>'fonction',
    paye_at = now()
  where id = p_id
  returning * into n;
  return n;
end $$;

create or replace function public.refuser_note_frais(p_id uuid, p_motif text)
returns public.notes_frais
language plpgsql
security definer
set search_path = public
as $$
declare
  n public.notes_frais;
  a jsonb;
  motif text := nullif(btrim(coalesce(p_motif, '')), '');
begin
  if not public.est_tresorier_notes() then
    raise exception 'Refus réservé à la trésorerie / présidence.';
  end if;
  if motif is null then
    raise exception 'Indiquez le motif du refus.';
  end if;
  select * into n from public.notes_frais where id = p_id for update;
  if n.id is null then raise exception 'Note introuvable.'; end if;
  if n.statut::text not in ('soumise', 'verifiee', 'approuve_n1', 'approuve_n2') then
    raise exception 'Cette note ne peut plus être refusée.';
  end if;
  a := public.tampon_acteur_note();
  update public.notes_frais set
    statut = 'refuse',
    motif_refus = motif,
    refuse_par = (a->>'id')::uuid,
    refuse_at = now(),
    refuse_nom = a->>'nom',
    verifie_par = case when n.statut::text = 'soumise' then null else n.verifie_par end,
    autorise_par = null, autorise_at = null, autorise_nom = null, autorise_fonction = null,
    virement_par = null, virement_at = null, virement_nom = null, virement_fonction = null,
    valide_par = null, valide_at = null
  where id = p_id
  returning * into n;
  return n;
end $$;

drop policy if exists notes_frais_insert on public.notes_frais;
create policy notes_frais_insert on public.notes_frais
  for insert to authenticated
  with check (
    public.is_staff()
    and (user_id = auth.uid() or public.est_tresorier_notes())
    and statut = 'en_attente'
    and communication is null
    and demande_par is null
    and verifie_par is null
    and autorise_par is null
    and virement_par is null
  );

drop policy if exists notes_frais_update on public.notes_frais;
create policy notes_frais_update on public.notes_frais
  for update to authenticated
  using (
    (user_id = auth.uid() and statut in ('en_attente', 'refuse'))
    or (public.est_tresorier_notes() and statut <> 'paye')
  )
  with check (
    (
      user_id = auth.uid()
      and statut in ('en_attente', 'refuse')
      and not public.est_tresorier_notes()
    )
    or (public.est_tresorier_notes() and statut <> 'paye')
  );

drop policy if exists notes_frais_delete on public.notes_frais;
create policy notes_frais_delete on public.notes_frais
  for delete to authenticated
  using (
    (user_id = auth.uid() and statut in ('en_attente', 'refuse'))
    or public.est_tresorier_notes()
  );

revoke update on public.notes_frais from authenticated;
grant update (
  iban, lignes_forfait, lignes_km, total_forfait, total_km, total
) on public.notes_frais to authenticated;

grant execute on function public.fmt_communication_structuree(bigint) to authenticated;
grant execute on function public.soumettre_note_frais(uuid) to authenticated;
grant execute on function public.retirer_note_frais(uuid) to authenticated;
grant execute on function public.verifier_note_frais(uuid) to authenticated;
grant execute on function public.autoriser_note_frais(uuid) to authenticated;
grant execute on function public.virer_note_frais(uuid) to authenticated;
grant execute on function public.refuser_note_frais(uuid, text) to authenticated;
revoke all on function public.attribuer_communication_note() from public, anon, authenticated;
revoke all on function public.tampon_acteur_note() from public, anon, authenticated;

-- Notes déjà signées à la main : la signature dessinées compte comme une demande.
update public.notes_frais
set
  demande_nom = coalesce(demande_nom, signature_volontaire_nom),
  demande_at = coalesce(demande_at, signature_volontaire_at),
  statut = case
    when statut = 'en_attente' and signature_volontaire is not null then 'soumise'::public.statut_defraiement
    else statut
  end
where signature_volontaire is not null and demande_at is null;

update public.notes_frais
set
  autorise_par = coalesce(autorise_par, valide_par),
  autorise_at = coalesce(autorise_at, valide_at),
  autorise_nom = coalesce(autorise_nom, signature_asbl_nom),
  autorise_fonction = coalesce(autorise_fonction, signature_asbl_fonction)
where statut in ('approuve_n1', 'approuve_n2', 'paye')
  and autorise_at is null
  and (valide_at is not null or signature_asbl is not null);

update public.notes_frais
set
  virement_at = coalesce(virement_at, paye_at),
  virement_nom = coalesce(virement_nom, signature_asbl_nom)
where statut = 'paye' and virement_at is null and paye_at is not null;

update public.notes_frais n
set
  communication_base = x.base,
  communication = public.fmt_communication_structuree(x.base)
from (
  select id, public.attribuer_communication_note() as base
  from public.notes_frais
  where communication is null
    and statut::text not in ('en_attente')
) x
where n.id = x.id;

notify pgrst, 'reload schema';
