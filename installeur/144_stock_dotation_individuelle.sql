-- ════════════════════════════════════════════════════════════════════════════
--  Dotation individuelle (vêtements, badges) + variantes d’articles.
--  Idempotent. Lisible depuis la fiche personnelle ; géré en Logistique.
-- ════════════════════════════════════════════════════════════════════════════

-- Variantes : un article « parent » (ex. Polo) et des enfants (ex. S / M / L).
alter table public.stock_catalogue
  add column if not exists parent_id uuid references public.stock_catalogue(id) on delete cascade,
  add column if not exists variante text,
  add column if not exists dotation_personnel boolean not null default false,
  add column if not exists cle_dotation text;

comment on column public.stock_catalogue.parent_id is
  'Article parent. Les enfants sont des variantes (taille, couleur…).';
comment on column public.stock_catalogue.variante is
  'Libellé de variante (ex. S, M, L, XL, bleu).';
comment on column public.stock_catalogue.dotation_personnel is
  'Article destiné à la dotation individuelle des volontaires.';
comment on column public.stock_catalogue.cle_dotation is
  'Famille métier : polo, tshirt, chemise, veste, badge_asbl, badge_chc, badge_solumob.';

create index if not exists stock_catalogue_parent_idx
  on public.stock_catalogue(parent_id) where parent_id is not null;
create index if not exists stock_catalogue_dotation_idx
  on public.stock_catalogue(cle_dotation) where dotation_personnel;

-- Attribution par personne
create table if not exists public.stock_dotation_individuelle (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  catalogue_id    uuid not null references public.stock_catalogue(id) on delete restrict,
  qte             numeric not null default 1 check (qte > 0),
  notes           text,
  attribue_le     date not null default (timezone('Europe/Brussels', now()))::date,
  attribue_par    uuid references public.profiles(id) on delete set null,
  rendu_le        date,
  actif           boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists stock_dotation_ind_user_idx
  on public.stock_dotation_individuelle(user_id) where actif;
create index if not exists stock_dotation_ind_cat_idx
  on public.stock_dotation_individuelle(catalogue_id);

drop trigger if exists trg_stock_dotation_individuelle_updated on public.stock_dotation_individuelle;
create trigger trg_stock_dotation_individuelle_updated
  before update on public.stock_dotation_individuelle
  for each row execute function public.set_updated_at();

alter table public.stock_dotation_individuelle enable row level security;

drop policy if exists stock_dotation_ind_read on public.stock_dotation_individuelle;
create policy stock_dotation_ind_read on public.stock_dotation_individuelle
  for select to authenticated
  using (
    public.is_staff()
    or user_id = auth.uid()
  );

drop policy if exists stock_dotation_ind_write on public.stock_dotation_individuelle;
create policy stock_dotation_ind_write on public.stock_dotation_individuelle
  for all to authenticated
  using (public.is_staff() and (public.peut_gerer_stock() or public.peut_gerer_fiches()))
  with check (public.is_staff() and (public.peut_gerer_stock() or public.peut_gerer_fiches()));

-- Lecture enrichie (noms + variantes) pour la fiche, y compris soi-même.
create or replace function public.dotation_individuelle_de(p_user uuid)
returns table (
  id uuid,
  user_id uuid,
  catalogue_id uuid,
  qte numeric,
  notes text,
  attribue_le date,
  rendu_le date,
  actif boolean,
  article text,
  variante text,
  cle_dotation text,
  parent_nom text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    d.id,
    d.user_id,
    d.catalogue_id,
    d.qte,
    d.notes,
    d.attribue_le,
    d.rendu_le,
    d.actif,
    coalesce(nullif(trim(c.nom), ''), p.nom, 'Article') as article,
    nullif(trim(c.variante), '') as variante,
    coalesce(nullif(trim(c.cle_dotation), ''), nullif(trim(p.cle_dotation), '')) as cle_dotation,
    nullif(trim(p.nom), '') as parent_nom
  from public.stock_dotation_individuelle d
  join public.stock_catalogue c on c.id = d.catalogue_id
  left join public.stock_catalogue p on p.id = c.parent_id
  where d.user_id = p_user
    and (
      public.is_staff()
      or p_user = auth.uid()
    )
  order by
    coalesce(c.cle_dotation, p.cle_dotation, 'zzz'),
    coalesce(p.nom, c.nom),
    c.variante nulls first,
    d.attribue_le desc;
$$;

revoke all on function public.dotation_individuelle_de(uuid) from public;
grant execute on function public.dotation_individuelle_de(uuid) to authenticated;

-- Catalogue de base (parents + tailles vêtements + badges).
do $$
declare
  r record;
  pid uuid;
  taille text;
  tailles text[] := array['XS','S','M','L','XL','XXL'];
begin
  for r in
    select * from (values
      ('polo', 'Polo Heart’s Angels', 'vêtement'),
      ('tshirt', 'T-shirt Heart’s Angels', 'vêtement'),
      ('chemise', 'Chemise Heart’s Angels', 'vêtement'),
      ('veste', 'Veste Heart’s Angels', 'vêtement'),
      ('badge_asbl', 'Badge ASBL', 'badge'),
      ('badge_chc', 'Badge d’accès CHC', 'badge'),
      ('badge_solumob', 'Badge Solumob', 'badge')
    ) as t(cle, nom, cat)
  loop
    select id into pid
    from public.stock_catalogue
    where parent_id is null
      and cle_dotation = r.cle
      and dotation_personnel
    limit 1;

    if pid is null then
      insert into public.stock_catalogue (
        nom, categorie, mode, nature, unite, stock_minimal,
        gestion_lot, gestion_dlc, gestion_qr,
        dotation_personnel, cle_dotation, actif
      ) values (
        r.nom, r.cat, 'durable', 'materiel', 'pièce', 0,
        false, false, false,
        true, r.cle, true
      )
      returning id into pid;
    else
      update public.stock_catalogue
      set nom = coalesce(nullif(trim(nom), ''), r.nom),
          categorie = coalesce(categorie, r.cat),
          mode = 'durable',
          nature = 'materiel',
          dotation_personnel = true,
          cle_dotation = r.cle,
          actif = true
      where id = pid;
    end if;

    -- Variantes taille pour les vêtements uniquement.
    if r.cle in ('polo', 'tshirt', 'chemise', 'veste') then
      foreach taille in array tailles loop
        if not exists (
          select 1 from public.stock_catalogue
          where parent_id = pid and variante = taille
        ) then
          insert into public.stock_catalogue (
            nom, categorie, mode, nature, unite, stock_minimal,
            gestion_lot, gestion_dlc, gestion_qr,
            parent_id, variante, dotation_personnel, cle_dotation, actif
          ) values (
            r.nom || ' — ' || taille, r.cat, 'durable', 'materiel', 'pièce', 0,
            false, false, false,
            pid, taille, true, r.cle, true
          );
        end if;
      end loop;
    end if;
  end loop;
end $$;
