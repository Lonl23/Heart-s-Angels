-- ════════════════════════════════════════════════════════════════════════════
--  Contenu prévu des emplacements (types d’articles, sans lots ni quantités)
--  + répertoire du petit sac à dos paramedic d’après les fiches papier.
--  Idempotent. Après 32_ticket_carburant_matin.sql.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.stock_dotation (
  id            uuid primary key default gen_random_uuid(),
  lieu_id       uuid not null references public.stock_lieux(id) on delete cascade,
  catalogue_id  uuid not null references public.stock_catalogue(id) on delete cascade,
  created_at    timestamptz default now(),
  unique (lieu_id, catalogue_id)
);
create index if not exists stock_dotation_lieu_idx on public.stock_dotation(lieu_id);
create index if not exists stock_dotation_cat_idx on public.stock_dotation(catalogue_id);

alter table public.stock_dotation enable row level security;

drop policy if exists stock_dotation_write on public.stock_dotation;
create policy stock_dotation_write on public.stock_dotation for all to authenticated
  using (public.is_staff() and public.peut_gerer_stock())
  with check (public.is_staff() and public.peut_gerer_stock());
drop policy if exists stock_dotation_read on public.stock_dotation;
create policy stock_dotation_read on public.stock_dotation for select to authenticated
  using (public.is_staff());

-- Lieu par nom + parent (idempotent)
create or replace function public._stock_assurer_lieu(p_nom text, p_type text, p_parent uuid)
returns uuid language plpgsql as $$
declare
  lid uuid;
begin
  select id into lid from public.stock_lieux
   where actif and lower(nom) = lower(p_nom)
     and parent_id is not distinct from p_parent
   limit 1;
  if lid is not null then
    update public.stock_lieux set type = p_type where id = lid and type is distinct from p_type;
    return lid;
  end if;
  insert into public.stock_lieux (nom, type, parent_id)
    values (p_nom, p_type, p_parent)
    returning id into lid;
  return lid;
end $$;

-- Type d’article par nom (réutilise s’il existe déjà)
create or replace function public._stock_assurer_article(p_nom text, p_categorie text, p_mode text, p_unite text)
returns uuid language plpgsql as $$
declare
  cid uuid;
begin
  select id into cid from public.stock_catalogue
   where actif and lower(nom) = lower(p_nom)
   limit 1;
  if cid is not null then
    update public.stock_catalogue
       set categorie = coalesce(categorie, p_categorie),
           mode = coalesce(nullif(mode, ''), p_mode),
           unite = coalesce(nullif(unite, ''), p_unite)
     where id = cid;
    return cid;
  end if;
  insert into public.stock_catalogue (nom, categorie, mode, unite)
    values (p_nom, p_categorie, p_mode, p_unite)
    returning id into cid;
  return cid;
end $$;

do $$
declare
  sac uuid;
  p_bas uuid;
  p_para uuid;
  p_gauche uuid;
  p_droite uuid;
  p_filet uuid;
  p_grande uuid;
  p_petite uuid;
  p_fond uuid;
  p_kit uuid;
  a uuid;
begin
  sac := public._stock_assurer_lieu('Petit sac à dos paramedic', 'sac', null);
  p_bas := public._stock_assurer_lieu('Poche extérieure bas', 'pochette', sac);
  p_para := public._stock_assurer_lieu('Poche extérieure paramedic', 'pochette', sac);
  p_gauche := public._stock_assurer_lieu('Poche extérieure gauche', 'pochette', sac);
  p_droite := public._stock_assurer_lieu('Poche extérieure droite', 'pochette', sac);
  p_filet := public._stock_assurer_lieu('Filet intérieur', 'pochette', sac);
  p_grande := public._stock_assurer_lieu('Grande poche', 'pochette', sac);
  p_petite := public._stock_assurer_lieu('Petite poche', 'pochette', sac);
  p_fond := public._stock_assurer_lieu('Poche fond', 'pochette', sac);
  p_kit := public._stock_assurer_lieu('Kit injection 2', 'pochette', p_filet);

  -- Poche extérieure bas
  a := public._stock_assurer_article('Paire de gants S', 'protection', 'piece', 'paire');
  insert into public.stock_dotation (lieu_id, catalogue_id) values (p_bas, a) on conflict do nothing;
  a := public._stock_assurer_article('Paire de gants M', 'protection', 'piece', 'paire');
  insert into public.stock_dotation (lieu_id, catalogue_id) values (p_bas, a) on conflict do nothing;
  a := public._stock_assurer_article('Paire de gants L', 'protection', 'piece', 'paire');
  insert into public.stock_dotation (lieu_id, catalogue_id) values (p_bas, a) on conflict do nothing;
  a := public._stock_assurer_article('Paire de gants XL', 'protection', 'piece', 'paire');
  insert into public.stock_dotation (lieu_id, catalogue_id) values (p_bas, a) on conflict do nothing;
  a := public._stock_assurer_article('Sac poubelle', 'hygiène', 'piece', 'pièce');
  insert into public.stock_dotation (lieu_id, catalogue_id) values (p_bas, a) on conflict do nothing;
  a := public._stock_assurer_article('Vomissoir', 'hygiène', 'piece', 'pièce');
  insert into public.stock_dotation (lieu_id, catalogue_id) values (p_bas, a) on conflict do nothing;

  -- Poche extérieure paramedic
  a := public._stock_assurer_article('Ampoularium', 'matériel', 'durable', 'pièce');
  insert into public.stock_dotation (lieu_id, catalogue_id) values (p_para, a) on conflict do nothing;
  a := public._stock_assurer_article('Valium 10 mg / 10 ml', 'médicament', 'piece', 'ampoule');
  insert into public.stock_dotation (lieu_id, catalogue_id) values (p_para, a) on conflict do nothing;
  a := public._stock_assurer_article('Litican 50 mg / 2 ml', 'médicament', 'piece', 'ampoule');
  insert into public.stock_dotation (lieu_id, catalogue_id) values (p_para, a) on conflict do nothing;
  a := public._stock_assurer_article('Buscopan 20 mg / ml', 'médicament', 'piece', 'ampoule');
  insert into public.stock_dotation (lieu_id, catalogue_id) values (p_para, a) on conflict do nothing;
  a := public._stock_assurer_article('Scopolamine 0,50 mg / 1 ml', 'médicament', 'piece', 'ampoule');
  insert into public.stock_dotation (lieu_id, catalogue_id) values (p_para, a) on conflict do nothing;
  a := public._stock_assurer_article('Morphine 10 mg / 1 ml', 'médicament', 'piece', 'ampoule');
  insert into public.stock_dotation (lieu_id, catalogue_id) values (p_para, a) on conflict do nothing;

  -- Poche extérieure gauche
  a := public._stock_assurer_article('Bande Velpeau 5 cm', 'pansement', 'piece', 'pièce');
  insert into public.stock_dotation (lieu_id, catalogue_id) values (p_gauche, a) on conflict do nothing;
  a := public._stock_assurer_article('Bande Velpeau 10 cm', 'pansement', 'piece', 'pièce');
  insert into public.stock_dotation (lieu_id, catalogue_id) values (p_gauche, a) on conflict do nothing;

  -- Poche extérieure droite
  a := public._stock_assurer_article('Couverture de survie', 'matériel', 'durable', 'pièce');
  insert into public.stock_dotation (lieu_id, catalogue_id) values (p_droite, a) on conflict do nothing;
  a := public._stock_assurer_article('EpiPen', 'médicament', 'piece', 'pièce');
  insert into public.stock_dotation (lieu_id, catalogue_id) values (p_droite, a) on conflict do nothing;

  -- Filet intérieur (suite de la fiche : canard, lingettes, kit)
  a := public._stock_assurer_article('Canard', 'matériel', 'durable', 'pièce');
  insert into public.stock_dotation (lieu_id, catalogue_id) values (p_filet, a) on conflict do nothing;
  a := public._stock_assurer_article('Lingettes humides', 'hygiène', 'piece', 'paquet');
  insert into public.stock_dotation (lieu_id, catalogue_id) values (p_filet, a) on conflict do nothing;

  -- Kit injection 2
  a := public._stock_assurer_article('Seringue 10 ml', 'injection', 'piece', 'pièce');
  insert into public.stock_dotation (lieu_id, catalogue_id) values (p_kit, a) on conflict do nothing;
  a := public._stock_assurer_article('Seringue 5 ml', 'injection', 'piece', 'pièce');
  insert into public.stock_dotation (lieu_id, catalogue_id) values (p_kit, a) on conflict do nothing;
  a := public._stock_assurer_article('Aiguille 18G rose', 'injection', 'piece', 'pièce');
  insert into public.stock_dotation (lieu_id, catalogue_id) values (p_kit, a) on conflict do nothing;
  a := public._stock_assurer_article('Aiguille 21G verte', 'injection', 'piece', 'pièce');
  insert into public.stock_dotation (lieu_id, catalogue_id) values (p_kit, a) on conflict do nothing;
  a := public._stock_assurer_article('Aiguille 23G bleue', 'injection', 'piece', 'pièce');
  insert into public.stock_dotation (lieu_id, catalogue_id) values (p_kit, a) on conflict do nothing;
  a := public._stock_assurer_article('Aiguille 25G orange', 'injection', 'piece', 'pièce');
  insert into public.stock_dotation (lieu_id, catalogue_id) values (p_kit, a) on conflict do nothing;
  a := public._stock_assurer_article('Tampon alcool', 'injection', 'piece', 'pièce');
  insert into public.stock_dotation (lieu_id, catalogue_id) values (p_kit, a) on conflict do nothing;
  a := public._stock_assurer_article('Rustine', 'pansement', 'piece', 'pièce');
  insert into public.stock_dotation (lieu_id, catalogue_id) values (p_kit, a) on conflict do nothing;
  a := public._stock_assurer_article('Compresse 5cm x 5cm', 'pansement', 'piece', 'pièce');
  insert into public.stock_dotation (lieu_id, catalogue_id) values (p_kit, a) on conflict do nothing;
  a := public._stock_assurer_article('Tampon ouate', 'injection', 'piece', 'pièce');
  insert into public.stock_dotation (lieu_id, catalogue_id) values (p_kit, a) on conflict do nothing;

  -- Grande poche
  a := public._stock_assurer_article('Compresse 5cm x 5cm', 'pansement', 'piece', 'pièce');
  insert into public.stock_dotation (lieu_id, catalogue_id) values (p_grande, a) on conflict do nothing;
  a := public._stock_assurer_article('Compresse 10cm x 10cm', 'pansement', 'piece', 'pièce');
  insert into public.stock_dotation (lieu_id, catalogue_id) values (p_grande, a) on conflict do nothing;
  a := public._stock_assurer_article('Ciseaux de brancardier', 'matériel', 'durable', 'pièce');
  insert into public.stock_dotation (lieu_id, catalogue_id) values (p_grande, a) on conflict do nothing;
  a := public._stock_assurer_article('Rouleau de sparadrap', 'pansement', 'piece', 'pièce');
  insert into public.stock_dotation (lieu_id, catalogue_id) values (p_grande, a) on conflict do nothing;
  a := public._stock_assurer_article('Écrase-médicament', 'matériel', 'durable', 'pièce');
  insert into public.stock_dotation (lieu_id, catalogue_id) values (p_grande, a) on conflict do nothing;

  -- Petite poche
  a := public._stock_assurer_article('Sparadrap découpés', 'pansement', 'piece', 'pièce');
  insert into public.stock_dotation (lieu_id, catalogue_id) values (p_petite, a) on conflict do nothing;
  a := public._stock_assurer_article('Mefix 10 cm × 50', 'pansement', 'piece', 'pièce');
  insert into public.stock_dotation (lieu_id, catalogue_id) values (p_petite, a) on conflict do nothing;
  a := public._stock_assurer_article('Hibidil 15 ml', 'hygiène', 'piece', 'ampoule');
  insert into public.stock_dotation (lieu_id, catalogue_id) values (p_petite, a) on conflict do nothing;
  a := public._stock_assurer_article('NaCl 5 ml', 'injection', 'piece', 'ampoule');
  insert into public.stock_dotation (lieu_id, catalogue_id) values (p_petite, a) on conflict do nothing;

  -- Poche fond
  a := public._stock_assurer_article('Bouteille d’eau', 'confort', 'piece', 'pièce');
  insert into public.stock_dotation (lieu_id, catalogue_id) values (p_fond, a) on conflict do nothing;
  a := public._stock_assurer_article('Pansement triangulaire', 'pansement', 'piece', 'pièce');
  insert into public.stock_dotation (lieu_id, catalogue_id) values (p_fond, a) on conflict do nothing;
  a := public._stock_assurer_article('Bouchons', 'confort', 'piece', 'pièce');
  insert into public.stock_dotation (lieu_id, catalogue_id) values (p_fond, a) on conflict do nothing;
end $$;
