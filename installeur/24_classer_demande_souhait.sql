-- Quand une demande du site est acceptée, les champs du formulaire
-- (séjour, registre, médecin, autre contact, situation) sont recopiés
-- dans la feuille de mission, sans écraser la base ni l'origine déjà saisies.

create or replace function public.classer_demande_dans_souhait()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  c jsonb := coalesce(new.complements, '{}'::jsonb);
  sejour jsonb := coalesce(c->'sejour', '{}'::jsonb);
  med jsonb := coalesce(c->'medecin', '{}'::jsonb);
  sec jsonb := coalesce(c->'contact_secondaire', '{}'::jsonb);
  sec_nom text;
  contact text;
  medecin text;
  pec_type text;
  pec_inst text;
  extra jsonb;
  m jsonb;
begin
  if new.souhait_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.souhait_id is not distinct from old.souhait_id then
    return new;
  end if;

  sec_nom := nullif(btrim(concat_ws(' ', sec->>'prenom', nullif(sec->>'nom', ''))), '');
  if sec_nom is null then
    sec_nom := nullif(sec->>'nom', '');
  end if;

  contact := nullif(concat_ws(' · ',
    nullif(btrim(concat_ws(' ', new.contact_prenom, new.contact_nom)), ''),
    nullif(new.contact_telephone, ''),
    nullif(new.contact_email, ''),
    case
      when sec_nom is not null then 'Autre contact : ' || concat_ws(' · ', sec_nom, nullif(sec->>'telephone', ''), nullif(sec->>'email', ''))
    end
  ), '');

  medecin := nullif(concat_ws(' · ', nullif(med->>'nom', ''), nullif(med->>'telephone', ''), nullif(med->>'email', '')), '');

  if sejour->>'type' = 'Domicile' then
    pec_type := 'Domicile du patient';
    pec_inst := null;
  elsif coalesce(sejour->>'type', '') <> '' then
    pec_type := 'Institution';
    pec_inst := coalesce(nullif(sejour#>>'{adresse,rue}', ''), sejour->>'type');
  end if;

  select coalesce(mission, '{}'::jsonb) into m
  from public.souhaits
  where id = new.souhait_id;
  if not found then
    return new;
  end if;

  extra := jsonb_strip_nulls(jsonb_build_object(
    'registre_national', nullif(c#>>'{beneficiaire,registre}', ''),
    'patient_adresse', case
      when new.patient_adresse is not null then new.patient_adresse
      when sejour->>'type' = 'Domicile' then sejour->'adresse'
    end,
    'origine', case when c->>'origine' = 'wordpress' then 'Site heartsangels.be' end,
    'date_demande', to_char((coalesce(new.created_at, now()) at time zone 'Europe/Brussels'), 'YYYY-MM-DD'),
    'pathologies', nullif(c->>'situation_medicale', ''),
    'pec_type', pec_type,
    'pec_institution', pec_inst,
    'pec_adresse', sejour->'adresse',
    'pec_precisions', nullif(concat_ws(E'\n',
      case when nullif(sejour->>'telephone', '') is not null then 'Tél. lieu : ' || (sejour->>'telephone') end,
      case when medecin is not null then 'Médecin : ' || medecin end
    ), ''),
    'dest_precisions', nullif(new.souhait_description, '')
  ));

  update public.souhaits
  set beneficiaire_prenom = coalesce(nullif(new.patient_prenom, ''), beneficiaire_prenom),
      beneficiaire_nom = coalesce(nullif(new.patient_nom, ''), beneficiaire_nom),
      beneficiaire_ddn = coalesce(beneficiaire_ddn, new.patient_ddn),
      beneficiaire_contact = coalesce(contact, beneficiaire_contact),
      localisation = coalesce(nullif(localisation, ''), nullif(new.souhait_lieu, '')),
      notes_medicales = coalesce(nullif(notes_medicales, ''), nullif(concat_ws(E'\n',
        case when nullif(new.mobilite, '') is not null then 'Mobilité: ' || new.mobilite end,
        case when nullif(new.allergies, '') is not null then 'Allergies: ' || new.allergies end,
        nullif(c->>'situation_medicale', ''),
        case when medecin is not null then 'Médecin : ' || medecin end
      ), '')),
      mission = m || (
        select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
        from jsonb_each(extra) e
        where m->e.key is null
           or m->>e.key is null
           or btrim(m->>e.key) = ''
           or m->e.key = 'null'::jsonb
      )
  where id = new.souhait_id;

  return new;
end;
$$;

drop trigger if exists trg_classer_demande_souhait on public.demandes_souhaits;
create trigger trg_classer_demande_souhait
  after insert or update of souhait_id on public.demandes_souhaits
  for each row
  execute function public.classer_demande_dans_souhait();
