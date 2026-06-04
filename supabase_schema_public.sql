-- ============================================================
-- HEARTS ANGELS — Schéma site PUBLIC
-- À exécuter APRÈS supabase_schema.sql
-- ============================================================

-- ============================================================
-- FONCTIONS HELPER RLS
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_admin_or_president()
RETURNS BOOLEAN AS $$
  SELECT role IN ('admin','president') FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;



-- ============================================================
-- CONTENU MULTILINGUE (helper)
-- ============================================================
-- Convention : colonnes _fr, _nl, _en pour chaque texte traduit
-- Ex: titre_fr, titre_nl, titre_en

-- ============================================================
-- 1. ARTICLES BLOG / ACTUALITÉS
-- ============================================================
CREATE TABLE articles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT UNIQUE NOT NULL,
  -- Titre traduit
  titre_fr    TEXT NOT NULL,
  titre_nl    TEXT,
  titre_en    TEXT,
  -- Résumé traduit
  resume_fr   TEXT,
  resume_nl   TEXT,
  resume_en   TEXT,
  -- Contenu traduit (Markdown)
  contenu_fr  TEXT,
  contenu_nl  TEXT,
  contenu_en  TEXT,
  -- Catégorie
  categorie   TEXT CHECK (categorie IN (
    'souhaits_realises', 'evenements', 'association', 'partenariats'
  )) DEFAULT 'association',
  -- Image
  image_url   TEXT,
  image_alt   TEXT,
  -- Publication
  publie      BOOLEAN DEFAULT false,
  publie_le   TIMESTAMPTZ,
  auteur_id   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  -- Méta SEO
  meta_desc_fr TEXT,
  meta_desc_nl TEXT,
  meta_desc_en TEXT,
  -- Méta
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER trg_articles_updated BEFORE UPDATE ON articles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_articles_publie  ON articles(publie, publie_le DESC);
CREATE INDEX idx_articles_slug    ON articles(slug);
CREATE INDEX idx_articles_cat     ON articles(categorie);

-- ============================================================
-- 2. ÉVÉNEMENTS PUBLICS
-- ============================================================
CREATE TABLE evenements_publics (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         TEXT UNIQUE NOT NULL,
  -- Titre traduit
  titre_fr     TEXT NOT NULL,
  titre_nl     TEXT,
  titre_en     TEXT,
  -- Description traduite
  desc_fr      TEXT,
  desc_nl      TEXT,
  desc_en      TEXT,
  -- Détails
  date_debut   TIMESTAMPTZ NOT NULL,
  date_fin     TIMESTAMPTZ,
  lieu         TEXT,
  adresse      TEXT,
  -- Tarifs
  prix_adulte  DECIMAL(6,2) DEFAULT 0,
  prix_enfant  DECIMAL(6,2) DEFAULT 0,
  gratuit      BOOLEAN DEFAULT false,
  -- Inscription
  inscription_requise BOOLEAN DEFAULT false,
  lien_inscription    TEXT,  -- URL interne /evenements/:slug/inscription
  places_max   INT,
  places_prises INT DEFAULT 0,
  -- Image
  image_url    TEXT,
  -- Publication
  publie       BOOLEAN DEFAULT true,
  annule       BOOLEAN DEFAULT false,
  -- Méta
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER trg_events_updated BEFORE UPDATE ON evenements_publics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_events_date   ON evenements_publics(date_debut);
CREATE INDEX idx_events_publie ON evenements_publics(publie, date_debut);

-- Inscriptions aux événements
CREATE TABLE inscriptions_evenements (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evenement_id UUID NOT NULL REFERENCES evenements_publics(id) ON DELETE CASCADE,
  prenom       TEXT NOT NULL,
  nom          TEXT NOT NULL,
  email        TEXT NOT NULL,
  telephone    TEXT,
  nb_adultes   INT DEFAULT 1,
  nb_enfants   INT DEFAULT 0,
  message      TEXT,
  confirme     BOOLEAN DEFAULT false,
  confirme_a   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. GALERIE PHOTOS
-- ============================================================
CREATE TABLE galerie_albums (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT UNIQUE NOT NULL,
  titre_fr    TEXT NOT NULL,
  titre_nl    TEXT,
  titre_en    TEXT,
  categorie   TEXT CHECK (categorie IN ('souhaits','evenements','equipe','autre')) DEFAULT 'autre',
  publie      BOOLEAN DEFAULT true,
  ordre       SMALLINT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE galerie_photos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id     UUID REFERENCES galerie_albums(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  url          TEXT NOT NULL,
  legende_fr   TEXT,
  legende_nl   TEXT,
  legende_en   TEXT,
  alt_text     TEXT,
  ordre        SMALLINT DEFAULT 0,
  mise_en_avant BOOLEAN DEFAULT false,  -- Photo à mettre en avant sur l'accueil
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_photos_album  ON galerie_photos(album_id, ordre);
CREATE INDEX idx_photos_avant  ON galerie_photos(mise_en_avant);

-- ============================================================
-- 4. TÉMOIGNAGES PUBLICS
-- ============================================================
CREATE TABLE temoignages_publics (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  texte_fr    TEXT NOT NULL,
  texte_nl    TEXT,
  texte_en    TEXT,
  auteur_nom  TEXT NOT NULL,
  auteur_role_fr TEXT,
  auteur_role_nl TEXT,
  auteur_role_en TEXT,
  photo_url   TEXT,
  publie      BOOLEAN DEFAULT true,
  ordre       SMALLINT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Insérer les témoignages existants
INSERT INTO temoignages_publics (texte_fr, auteur_nom, auteur_role_fr, publie, ordre) VALUES
  ('Mon papa m''a dit qu''il n''oubliera jamais cette journée. Grâce à l''ASBL et aux bénévoles, son souhait a été réalisé. Mille mercis.', 'Nady Marie', 'Fille du bénéficiaire', true, 1),
  ('Elle a pu une dernière fois apprécier son jardin. Des associations comme Heart''s Angels permettent à ces personnes de vivre de tels instants.', 'Isabelle Stienon', 'Petite-fille d''une bénéficiaire', true, 2),
  ('Bravo aux bénévoles qui s''investissent pour le respect et le bien-être des personnes en fin de vie. Ils nous apprennent à avoir du cœur.', 'Olivier Schoonejans', 'Journaliste RTL-TVI', true, 3),
  ('Ma maman était épanouie et tellement heureuse. Ce soir, elle s''est endormie épanouie. Un immense merci.', 'Petite-fille d''une bénéficiaire', 'Famille', true, 4),
  ('Merci d''exister car sans vous, mon dernier souhait n''aurait sans doute jamais pu devenir réel.', 'Fillée Danielle', 'Bénéficiaire', true, 5),
  ('J''ai passé une journée formidable. Entre émotions, rires, bonheur et discussions, j''en garderai un merveilleux souvenir.', 'Bénéficiaire', 'Flémalle', true, 6);

-- ============================================================
-- 5. BOUTIQUE EN LIGNE
-- ============================================================
CREATE TABLE boutique_categories (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug      TEXT UNIQUE NOT NULL,
  nom_fr    TEXT NOT NULL,
  nom_nl    TEXT,
  nom_en    TEXT,
  ordre     SMALLINT DEFAULT 0
);

INSERT INTO boutique_categories (slug, nom_fr, nom_nl, nom_en, ordre) VALUES
  ('vetements',  'Vêtements',        'Kleding',           'Clothing',    1),
  ('accessoires','Accessoires',       'Accessoires',       'Accessories', 2),
  ('papeterie',  'Papeterie',         'Kantoorbenodigdheden','Stationery',3),
  ('dons',       'Dons libres',       'Vrije donaties',    'Free donations', 4);

CREATE TABLE boutique_produits (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug           TEXT UNIQUE NOT NULL,
  categorie_id   UUID REFERENCES boutique_categories(id),
  -- Nom traduit
  nom_fr         TEXT NOT NULL,
  nom_nl         TEXT,
  nom_en         TEXT,
  -- Description traduite
  desc_fr        TEXT,
  desc_nl        TEXT,
  desc_en        TEXT,
  -- Prix
  prix           DECIMAL(8,2) NOT NULL,
  prix_libre     BOOLEAN DEFAULT false,  -- Pour les dons libres
  -- Stock
  stock          INT,
  stock_illimite BOOLEAN DEFAULT false,
  -- Images
  image_principale TEXT,
  images         TEXT[],  -- URLs supplémentaires
  -- Stripe
  stripe_price_id TEXT,   -- ID du prix Stripe (créé manuellement dans Stripe dashboard)
  -- Variantes (tailles, couleurs)
  variantes      JSONB,   -- Ex: [{"type":"taille","options":["S","M","L","XL"]}]
  -- Publication
  actif          BOOLEAN DEFAULT true,
  mis_en_avant   BOOLEAN DEFAULT false,
  -- Méta
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Commandes boutique
CREATE TABLE boutique_commandes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Client
  client_email      TEXT NOT NULL,
  client_prenom     TEXT NOT NULL,
  client_nom        TEXT NOT NULL,
  client_telephone  TEXT,
  -- Livraison
  adresse_rue       TEXT,
  adresse_cp        TEXT,
  adresse_ville     TEXT,
  adresse_pays      TEXT DEFAULT 'BE',
  -- Stripe
  stripe_session_id TEXT UNIQUE,
  stripe_payment_id TEXT,
  -- Montants
  sous_total        DECIMAL(10,2),
  frais_port        DECIMAL(6,2) DEFAULT 0,
  total             DECIMAL(10,2),
  -- Statut
  statut            TEXT CHECK (statut IN (
    'en_attente', 'paye', 'expedie', 'livre', 'annule', 'rembourse'
  )) DEFAULT 'en_attente',
  -- Méta
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE boutique_commande_lignes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commande_id  UUID NOT NULL REFERENCES boutique_commandes(id) ON DELETE CASCADE,
  produit_id   UUID REFERENCES boutique_produits(id),
  produit_nom  TEXT NOT NULL,
  variante     TEXT,
  quantite     INT NOT NULL,
  prix_unitaire DECIMAL(8,2) NOT NULL,
  sous_total   DECIMAL(10,2) GENERATED ALWAYS AS (quantite * prix_unitaire) STORED
);

-- ============================================================
-- 6. DEMANDES DE SOUHAIT (formulaire public)
-- ============================================================
CREATE TABLE demandes_souhaits (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Patient
  patient_prenom      TEXT NOT NULL,
  patient_nom         TEXT NOT NULL,
  patient_ddn         DATE,
  etablissement       TEXT,
  medecin_referent    TEXT,
  -- Contact
  contact_prenom      TEXT NOT NULL,
  contact_nom         TEXT NOT NULL,
  contact_relation    TEXT,
  contact_email       TEXT NOT NULL,
  contact_telephone   TEXT,
  -- Souhait
  souhait_description TEXT NOT NULL,
  souhait_date        DATE,
  souhait_lieu        TEXT,
  -- Médical
  mobilite            TEXT,
  equipement_medical  TEXT,
  allergies           TEXT,
  urgence             BOOLEAN DEFAULT false,
  -- Consentements RGPD
  consent_patient     BOOLEAN NOT NULL DEFAULT false,
  consent_rgpd        BOOLEAN NOT NULL DEFAULT false,
  -- Traitement interne
  statut              TEXT CHECK (statut IN (
    'nouvelle', 'en_cours', 'acceptee', 'refusee', 'realisee'
  )) DEFAULT 'nouvelle',
  assignee_a          UUID REFERENCES profiles(id),  -- Récolteuse de souhaits
  notes_internes      TEXT,
  -- Lien vers souhait créé
  souhait_id          UUID REFERENCES souhaits(id),
  -- Méta
  langue              TEXT DEFAULT 'fr',
  ip_hash             TEXT,  -- Hash de l'IP pour protection spam (pas l'IP réelle)
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER trg_demandes_updated BEFORE UPDATE ON demandes_souhaits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_demandes_statut ON demandes_souhaits(statut, created_at DESC);

-- ============================================================
-- 7. FORMULAIRES DE CONTACT
-- ============================================================
CREATE TABLE contacts (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prenom    TEXT NOT NULL,
  nom       TEXT NOT NULL,
  email     TEXT NOT NULL,
  sujet     TEXT,
  message   TEXT NOT NULL,
  lu        BOOLEAN DEFAULT false,
  repondu   BOOLEAN DEFAULT false,
  langue    TEXT DEFAULT 'fr',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 8. CANDIDATURES BÉNÉVOLES
-- ============================================================
CREATE TABLE candidatures_benevoles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prenom      TEXT NOT NULL,
  nom         TEXT NOT NULL,
  email       TEXT NOT NULL,
  telephone   TEXT,
  type        TEXT CHECK (type IN ('medical','non_medical')),
  qualification TEXT,
  motivation  TEXT,
  consent_rgpd BOOLEAN DEFAULT false,
  -- Traitement
  statut      TEXT CHECK (statut IN (
    'nouvelle', 'contacte', 'entretien', 'accepte', 'refuse'
  )) DEFAULT 'nouvelle',
  notes       TEXT,
  -- Lien vers volontaire créé
  volontaire_id UUID REFERENCES volontaires(id),
  langue      TEXT DEFAULT 'fr',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_candidatures_statut ON candidatures_benevoles(statut, created_at DESC);

-- ============================================================
-- 9. RLS — SITE PUBLIC (lecture seule pour visiteurs)
-- ============================================================

ALTER TABLE articles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE evenements_publics    ENABLE ROW LEVEL SECURITY;
ALTER TABLE inscriptions_evenements ENABLE ROW LEVEL SECURITY;
ALTER TABLE galerie_albums        ENABLE ROW LEVEL SECURITY;
ALTER TABLE galerie_photos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE temoignages_publics   ENABLE ROW LEVEL SECURITY;
ALTER TABLE boutique_categories   ENABLE ROW LEVEL SECURITY;
ALTER TABLE boutique_produits     ENABLE ROW LEVEL SECURITY;
ALTER TABLE boutique_commandes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE boutique_commande_lignes ENABLE ROW LEVEL SECURITY;
ALTER TABLE demandes_souhaits     ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidatures_benevoles ENABLE ROW LEVEL SECURITY;

-- Lecture publique (contenu publié)
CREATE POLICY "articles_public"     ON articles           FOR SELECT USING (publie = true);
CREATE POLICY "events_public"       ON evenements_publics FOR SELECT USING (publie = true AND annule = false);
CREATE POLICY "albums_public"       ON galerie_albums     FOR SELECT USING (publie = true);
CREATE POLICY "photos_public"       ON galerie_photos     FOR SELECT USING (true);
CREATE POLICY "temos_public"        ON temoignages_publics FOR SELECT USING (publie = true);
CREATE POLICY "boutique_cats_public" ON boutique_categories FOR SELECT USING (true);
CREATE POLICY "boutique_prod_public" ON boutique_produits   FOR SELECT USING (actif = true);

-- Insertion publique (formulaires — pas besoin d'être connecté)
CREATE POLICY "contact_insert"      ON contacts              FOR INSERT WITH CHECK (true);
CREATE POLICY "demande_insert"      ON demandes_souhaits     FOR INSERT WITH CHECK (consent_patient = true AND consent_rgpd = true);
CREATE POLICY "candidature_insert"  ON candidatures_benevoles FOR INSERT WITH CHECK (consent_rgpd = true);
CREATE POLICY "inscription_insert"  ON inscriptions_evenements FOR INSERT WITH CHECK (true);

-- Commandes : accessible uniquement via le backend (Stripe webhook)
CREATE POLICY "commandes_admin"     ON boutique_commandes    FOR ALL USING (is_admin_or_president());
CREATE POLICY "commandes_lignes_admin" ON boutique_commande_lignes FOR ALL USING (is_admin_or_president());

-- Gestion contenu : admins uniquement
CREATE POLICY "articles_admin"      ON articles              FOR ALL USING (is_admin_or_president());
CREATE POLICY "events_admin"        ON evenements_publics    FOR ALL USING (is_admin_or_president() OR get_user_role() = 'coordinateur');
CREATE POLICY "photos_admin"        ON galerie_photos        FOR ALL USING (is_admin_or_president());
CREATE POLICY "temos_admin"         ON temoignages_publics   FOR ALL USING (is_admin_or_president());
CREATE POLICY "demandes_admin"      ON demandes_souhaits     FOR SELECT USING (is_admin_or_president() OR get_user_role() = 'coordinateur');
CREATE POLICY "demandes_update"     ON demandes_souhaits     FOR UPDATE USING (is_admin_or_president() OR get_user_role() = 'coordinateur');
CREATE POLICY "contacts_admin"      ON contacts              FOR SELECT USING (is_admin_or_president() OR get_user_role() = 'coordinateur');
CREATE POLICY "candidatures_admin"  ON candidatures_benevoles FOR SELECT USING (is_admin_or_president() OR get_user_role() = 'coordinateur');

-- ============================================================
-- 10. STORAGE BUCKETS PUBLICS (à créer dans Dashboard)
-- ============================================================
-- Buckets à créer :
--   "galerie-publique"   : PUBLIC,  max 10MB, images seulement
--   "boutique-images"    : PUBLIC,  max 5MB,  images seulement
--   "articles-images"    : PUBLIC,  max 10MB, images seulement
--   "documents-publics"  : PUBLIC,  max 50MB, PDF seulement
--      (dossier partenariat, statuts ASBL, etc.)

-- ============================================================
-- 11. FONCTION NOTIFICATION — Nouvelle demande de souhait
-- ============================================================
-- Trigger : quand une demande est insérée, notifier les récolteuses de souhaits
CREATE OR REPLACE FUNCTION notify_nouvelle_demande()
RETURNS TRIGGER AS $$
DECLARE
  recolteur RECORD;
BEGIN
  -- Notifier tous les coordinateurs (récolteuses de souhaits)
  FOR recolteur IN
    SELECT id FROM profiles
    WHERE role IN ('coordinateur', 'admin', 'president')
    AND actif = true
  LOOP
    INSERT INTO notifications (
      destinataire_id, type, titre, message, lien, priorite
    ) VALUES (
      recolteur.id,
      'nouvelle_demande_souhait',
      '💌 Nouvelle demande de souhait',
      'De ' || NEW.contact_prenom || ' ' || NEW.contact_nom ||
      ' pour ' || NEW.patient_prenom || ' ' || NEW.patient_nom ||
      CASE WHEN NEW.urgence THEN ' — ⚠️ URGENT' ELSE '' END,
      '/souhaits/demandes/' || NEW.id::TEXT,
      CASE WHEN NEW.urgence THEN 'critique' ELSE 'haute' END
    );
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_notify_demande
  AFTER INSERT ON demandes_souhaits
  FOR EACH ROW EXECUTE FUNCTION notify_nouvelle_demande();

-- Même chose pour les candidatures bénévoles
CREATE OR REPLACE FUNCTION notify_nouvelle_candidature()
RETURNS TRIGGER AS $$
DECLARE coord RECORD;
BEGIN
  FOR coord IN SELECT id FROM profiles WHERE role IN ('admin','president','coordinateur') AND actif = true
  LOOP
    INSERT INTO notifications (destinataire_id, type, titre, message, lien, priorite)
    VALUES (coord.id, 'nouvelle_candidature', '🙋 Nouvelle candidature bénévole',
      NEW.prenom || ' ' || NEW.nom || ' — ' || COALESCE(NEW.type, ''),
      '/volontaires/candidatures/' || NEW.id::TEXT, 'normale');
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_notify_candidature
  AFTER INSERT ON candidatures_benevoles
  FOR EACH ROW EXECUTE FUNCTION notify_nouvelle_candidature();

-- ── Variantes produits boutique (taille / couleur / stock) ────────────────────
CREATE TABLE IF NOT EXISTS boutique_variantes (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  produit_id      uuid REFERENCES boutique_produits(id) ON DELETE CASCADE,
  taille          text,                    -- 'XS','S','M','L','XL','XXL' ou NULL
  couleur         text,                    -- 'Blanc','Noir','Rouge' ou NULL
  stock           integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  prix_ht         numeric(10,2),           -- si différent du produit parent
  sku             text,                    -- code article interne
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER variantes_updated_at BEFORE UPDATE ON boutique_variantes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS
ALTER TABLE boutique_variantes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "variantes_public_read"  ON boutique_variantes FOR SELECT USING (true);
CREATE POLICY "variantes_staff_write"  ON boutique_variantes FOR ALL
  USING (auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin','coordinateur','tresorier')));

-- Fonction décrémentation stock (appelée après commande)
CREATE OR REPLACE FUNCTION decrement_stock(variante_id uuid, quantite integer)
RETURNS void AS $$
BEGIN
  UPDATE boutique_variantes
  SET stock = GREATEST(0, stock - quantite), updated_at = now()
  WHERE id = variante_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Colonnes lignes commande
ALTER TABLE boutique_commande_lignes ADD COLUMN IF NOT EXISTS variante_id uuid REFERENCES boutique_variantes(id);

-- Vue stock global
CREATE OR REPLACE VIEW vue_stock_boutique AS
SELECT
  p.id AS produit_id,
  p.nom_fr,
  p.image_principale AS image_url,
  c.nom_fr AS categorie,
  v.id AS variante_id,
  v.taille,
  v.couleur,
  v.stock,
  v.prix_ht,
  v.sku,
  CASE WHEN v.stock = 0 THEN 'rupture'
       WHEN v.stock <= 3 THEN 'faible'
       ELSE 'ok' END AS statut_stock
FROM boutique_produits p
LEFT JOIN boutique_categories c ON c.id = p.categorie_id
LEFT JOIN boutique_variantes v  ON v.produit_id = p.id
WHERE p.actif = true
ORDER BY p.nom_fr, v.taille, v.couleur;