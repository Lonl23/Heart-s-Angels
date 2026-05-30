-- ============================================================
-- HEARTS ANGELS — Schéma Supabase complet
-- RGPD : Région Frankfurt (EU), RLS activé partout
-- Exécuter dans : Supabase → SQL Editor
-- ============================================================

-- Extensions nécessaires
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. ÉNUMÉRATIONS (types réutilisables)
-- ============================================================

CREATE TYPE role_utilisateur AS ENUM (
  'admin',           -- Accès total
  'president',       -- N+2 : reçoit toutes les notifications critiques
  'coordinateur',    -- N+1 : gère les souhaits et équipes
  'ambulancier_bleu',
  'ambulancier_gris',
  'infirmier',
  'medecin',
  'volontaire_non_medical',
  'tresorier',
  'secretaire'
);

CREATE TYPE statut_souhait AS ENUM (
  'en_attente',
  'planifie',
  'en_cours',
  'realise',
  'annule',
  'urgent'
);

CREATE TYPE statut_defraiement AS ENUM (
  'en_attente',
  'approuve_n1',
  'approuve_n2',
  'refuse',
  'paye'
);

CREATE TYPE type_transaction AS ENUM (
  'recette',
  'depense'
);

CREATE TYPE statut_exercice AS ENUM (
  'ouvert',
  'cloture',
  'archive'
);

CREATE TYPE categorie_defraiement AS ENUM (
  'transport_km',
  'carburant',
  'repas',
  'materiel_medical',
  'materiel_logistique',
  'billets_entrees',
  'hebergement',
  'communication',
  'autre'
);

-- ============================================================
-- 2. PROFILS UTILISATEURS
-- ============================================================

CREATE TABLE profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  prenom          TEXT NOT NULL,
  nom             TEXT NOT NULL,
  telephone       TEXT,
  role            role_utilisateur NOT NULL DEFAULT 'volontaire_non_medical',
  -- Données médicales chiffrées (RGPD Art. 9)
  numero_inami    TEXT,   -- Chiffré au niveau application si présent
  qualifications  TEXT[], -- Ex: ['BLS','ALS','ambulancier']
  actif           BOOLEAN NOT NULL DEFAULT true,
  -- Consentement RGPD
  consent_date    TIMESTAMPTZ,
  consent_version TEXT,
  -- Dates
  date_inscription DATE DEFAULT CURRENT_DATE,
  derniere_connexion TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger : updated_at automatique
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 3. AUDIT LOGS (RGPD — traçabilité des accès)
-- ============================================================

CREATE TABLE audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,   -- 'READ','CREATE','UPDATE','DELETE','LOGIN','LOGOUT'
  table_name  TEXT,
  record_id   TEXT,
  details     JSONB,           -- Données avant/après pour les modifications
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour recherche rapide
CREATE INDEX idx_audit_user    ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_table   ON audit_logs(table_name, record_id);

-- ============================================================
-- 4. DISPONIBILITÉS
-- ============================================================

CREATE TABLE disponibilites (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date_debut    DATE NOT NULL,
  date_fin      DATE NOT NULL,
  qualification TEXT NOT NULL,
  demi_journee  TEXT CHECK (demi_journee IN ('matin','apres_midi','journee_complete')) DEFAULT 'journee_complete',
  commentaire   TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT dates_coherentes CHECK (date_fin >= date_debut)
);

CREATE TRIGGER trg_dispo_updated BEFORE UPDATE ON disponibilites
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_dispo_user     ON disponibilites(user_id);
CREATE INDEX idx_dispo_dates    ON disponibilites(date_debut, date_fin);

-- ============================================================
-- 5. SOUHAITS
-- ============================================================

CREATE TABLE souhaits (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Données bénéficiaire (RGPD : données de santé, accès restreint)
  beneficiaire_nom    TEXT NOT NULL,
  beneficiaire_prenom TEXT NOT NULL,
  beneficiaire_ddn    DATE,            -- Date de naissance
  beneficiaire_contact TEXT,           -- Famille référente
  -- Souhait
  description         TEXT NOT NULL,
  localisation        TEXT,
  notes_medicales     TEXT,            -- Accès médecins/infirmiers uniquement
  besoins_specifiques TEXT,
  -- Planning
  date_souhaitee      DATE,
  date_realisee       DATE,
  heure_depart        TIME,
  heure_retour        TIME,
  -- Statut
  statut              statut_souhait NOT NULL DEFAULT 'en_attente',
  priorite            SMALLINT DEFAULT 2 CHECK (priorite BETWEEN 1 AND 5),
  -- Équipe assignée
  coordinateur_id     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  -- Budget alloué
  budget_estime       DECIMAL(10,2),
  budget_reel         DECIMAL(10,2),
  -- Méta
  created_by          UUID REFERENCES profiles(id),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  -- Soft delete RGPD (conservation légale 5 ans puis purge)
  deleted_at          TIMESTAMPTZ
);

CREATE TRIGGER trg_souhaits_updated BEFORE UPDATE ON souhaits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_souhaits_statut  ON souhaits(statut) WHERE deleted_at IS NULL;
CREATE INDEX idx_souhaits_date    ON souhaits(date_souhaitee) WHERE deleted_at IS NULL;
CREATE INDEX idx_souhaits_coord   ON souhaits(coordinateur_id);

-- ── Personnel assigné à un souhait ──────────────────────────
CREATE TABLE souhait_personnel (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  souhait_id  UUID NOT NULL REFERENCES souhaits(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role_mission TEXT,   -- Ex: 'ambulancier_conducteur', 'infirmier_referent'
  confirme    BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(souhait_id, user_id)
);

CREATE INDEX idx_sp_souhait ON souhait_personnel(souhait_id);
CREATE INDEX idx_sp_user    ON souhait_personnel(user_id);

-- ============================================================
-- 6. CHECK-LISTS
-- ============================================================

-- Définition des items de check-list (configurables par admin)
CREATE TABLE checklist_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  categorie   TEXT NOT NULL,  -- 'vehicule','medical','hygiene','materiel'
  libelle     TEXT NOT NULL,
  description TEXT,
  obligatoire BOOLEAN DEFAULT true,
  ordre       SMALLINT DEFAULT 0,
  actif       BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Insertion des items fixes par défaut
INSERT INTO checklist_items (categorie, libelle, obligatoire, ordre) VALUES
  -- Véhicule
  ('vehicule', 'Km départ',                    true,  1),
  ('vehicule', 'Km retour',                    true,  2),
  ('vehicule', 'Plein carburant vérifié',       true,  3),
  ('vehicule', 'Contrôle technique à jour',     true,  4),
  ('vehicule', 'Trousse de premier secours',    true,  5),
  ('vehicule', 'Triangle de signalisation',     true,  6),
  ('vehicule', 'Gilets jaunes',                 true,  7),
  -- Médical
  ('medical', 'Oxygène (bouteille vérifiée)',   true,  1),
  ('medical', 'Pompe d''aspiration à mucosités',true,  2),
  ('medical', 'Défibrillateur (DEA)',           true,  3),
  ('medical', 'Sac paramédical',                true,  4),
  ('medical', 'Sac d''intervention',            true,  5),
  ('medical', 'Médicaments de réserve',         false, 6),
  ('medical', 'Tensiomètre',                    true,  7),
  ('medical', 'Saturomètre',                    true,  8),
  ('medical', 'Glucomètre',                     false, 9),
  -- Hygiène
  ('hygiene', 'Sac hygiène',                    true,  1),
  ('hygiene', 'Gants (boîte complète)',         true,  2),
  ('hygiene', 'Masques FFP2',                   true,  3),
  ('hygiene', 'Gel hydroalcoolique',            true,  4),
  ('hygiene', 'Protège-matelas / alèse',        false, 5),
  ('hygiene', 'Sacs poubelle',                  true,  6),
  -- Matériel
  ('materiel', 'Chaise roulante',               false, 1),
  ('materiel', 'Brancard / civière',            false, 2),
  ('materiel', 'Déambulateur',                  false, 3),
  ('materiel', 'Couverture / plaid',            true,  4),
  ('materiel', 'Coussin anti-escarres',         false, 5),
  ('materiel', 'Table pique-nique pliante',     false, 6);

-- Soumissions de check-lists
CREATE TABLE checklists (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  souhait_id      UUID NOT NULL REFERENCES souhaits(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES profiles(id),
  type            TEXT CHECK (type IN ('depart','retour')) NOT NULL,
  -- Kilomètres (champs dédiés pour calcul défraiement auto)
  km_depart       DECIMAL(8,1),
  km_retour       DECIMAL(8,1),
  km_total        DECIMAL(8,1) GENERATED ALWAYS AS (
    CASE WHEN km_retour IS NOT NULL AND km_depart IS NOT NULL
         THEN km_retour - km_depart ELSE NULL END
  ) STORED,
  -- Observations générales
  observations    TEXT,
  degats_constates BOOLEAN DEFAULT false,
  degats_description TEXT,
  -- Statut
  soumis_a        TIMESTAMPTZ DEFAULT NOW(),
  valide_par      UUID REFERENCES profiles(id),
  valide_a        TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Réponses aux items de la check-list
CREATE TABLE checklist_reponses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id    UUID NOT NULL REFERENCES checklists(id) ON DELETE CASCADE,
  item_id         UUID REFERENCES checklist_items(id),
  -- Pour les items libres ajoutés sur le moment
  item_libre      TEXT,
  valeur          BOOLEAN,          -- coché / non coché
  valeur_texte    TEXT,             -- Pour km, observations spécifiques
  commentaire     TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Photos du véhicule / dégâts (max 10 par checklist)
CREATE TABLE checklist_photos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id    UUID NOT NULL REFERENCES checklists(id) ON DELETE CASCADE,
  storage_path    TEXT NOT NULL,    -- Chemin dans Supabase Storage
  url             TEXT NOT NULL,
  type_photo      TEXT CHECK (type_photo IN (
    'vehicule_avant','vehicule_arriere','vehicule_gauche','vehicule_droite',
    'interieur','degat','equipement','autre'
  )) DEFAULT 'autre',
  description     TEXT,
  ordre           SMALLINT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  -- Contrainte : max 10 photos par checklist (vérifiée côté app + trigger)
  CONSTRAINT max_photos CHECK (ordre <= 10)
);

CREATE INDEX idx_photos_checklist ON checklist_photos(checklist_id);

-- ============================================================
-- 7. NOTIFICATIONS (N+1 / N+2)
-- ============================================================

CREATE TABLE notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  destinataire_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  expediteur_id   UUID REFERENCES profiles(id),
  type            TEXT NOT NULL,  -- 'checklist_soumise','defraiement_soumis','souhait_urgent', etc.
  titre           TEXT NOT NULL,
  message         TEXT,
  lien            TEXT,           -- Route interne ex: '/souhaits/uuid'
  lu              BOOLEAN DEFAULT false,
  lu_a            TIMESTAMPTZ,
  priorite        TEXT CHECK (priorite IN ('normale','haute','critique')) DEFAULT 'normale',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notif_dest   ON notifications(destinataire_id, lu, created_at DESC);

-- ============================================================
-- 8. VOLONTAIRES
-- ============================================================

CREATE TABLE volontaires (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  -- Données personnelles
  prenom          TEXT NOT NULL,
  nom             TEXT NOT NULL,
  email           TEXT,
  telephone       TEXT,
  date_naissance  DATE,
  adresse         TEXT,
  -- Qualification
  type            TEXT CHECK (type IN ('medical','non_medical')) NOT NULL,
  qualification   TEXT,
  numero_inami    TEXT,
  diplomes        TEXT[],
  -- Statut
  actif           BOOLEAN DEFAULT true,
  date_inscription DATE DEFAULT CURRENT_DATE,
  date_fin        DATE,             -- Fin de mission
  notes           TEXT,
  -- Consentement RGPD
  consentement_rgpd BOOLEAN DEFAULT false,
  consentement_date TIMESTAMPTZ,
  -- Méta
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ     -- Soft delete RGPD
);

CREATE TRIGGER trg_vol_updated BEFORE UPDATE ON volontaires
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 9. COMPTABILITÉ ASBL
-- ============================================================

-- Plan comptable (normes ASBL belge — AISBL)
CREATE TABLE plan_comptable (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code      TEXT UNIQUE NOT NULL,
  libelle   TEXT NOT NULL,
  classe    TEXT NOT NULL,   -- '6 Charges', '7 Produits', '4 Créances', etc.
  type      type_transaction,
  parent_code TEXT,          -- Hiérarchie comptable
  actif     BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Plan comptable ASBL belge de base
INSERT INTO plan_comptable (code, libelle, classe, type) VALUES
  -- Produits (7)
  ('700000', 'Cotisations des membres',           '7 Produits', 'recette'),
  ('700100', 'Dons et libéralités',               '7 Produits', 'recette'),
  ('700200', 'Subsides régionaux',                '7 Produits', 'recette'),
  ('700210', 'Subsides provinciaux',              '7 Produits', 'recette'),
  ('700220', 'Subsides communaux',                '7 Produits', 'recette'),
  ('700300', 'Subsides fédéraux',                 '7 Produits', 'recette'),
  ('700400', 'Ventes (événements)',               '7 Produits', 'recette'),
  ('700500', 'Recettes diverses',                 '7 Produits', 'recette'),
  ('700600', 'Intérêts bancaires',                '7 Produits', 'recette'),
  ('700700', 'Legs et donations',                 '7 Produits', 'recette'),
  -- Charges (6)
  ('600000', 'Achats matières et fournitures',    '6 Charges',  'depense'),
  ('600100', 'Matériel médical',                  '6 Charges',  'depense'),
  ('600200', 'Matériel hygiène',                  '6 Charges',  'depense'),
  ('600300', 'Matériel de bureau',                '6 Charges',  'depense'),
  ('610000', 'Services et biens divers',          '6 Charges',  'depense'),
  ('610100', 'Loyer et charges locatives',        '6 Charges',  'depense'),
  ('610200', 'Assurances',                        '6 Charges',  'depense'),
  ('610300', 'Frais de communication',            '6 Charges',  'depense'),
  ('610400', 'Frais informatiques',               '6 Charges',  'depense'),
  ('620000', 'Frais de transport — défraiements', '6 Charges',  'depense'),
  ('620100', 'Carburant véhicules ASBL',          '6 Charges',  'depense'),
  ('620200', 'Entretien véhicules',               '6 Charges',  'depense'),
  ('630000', 'Frais des souhaits',                '6 Charges',  'depense'),
  ('630100', 'Billets / entrées (souhaits)',       '6 Charges',  'depense'),
  ('630200', 'Restauration (souhaits)',            '6 Charges',  'depense'),
  ('630300', 'Hébergement (souhaits)',             '6 Charges',  'depense'),
  ('640000', 'Frais de personnel',                '6 Charges',  'depense'),
  ('650000', 'Frais événements',                  '6 Charges',  'depense'),
  ('660000', 'Amortissements',                    '6 Charges',  'depense'),
  ('670000', 'Charges exceptionnelles',           '6 Charges',  'depense');

-- Exercices comptables
CREATE TABLE exercices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  annee           SMALLINT UNIQUE NOT NULL,
  date_ouverture  DATE NOT NULL,
  date_cloture    DATE,
  solde_ouverture DECIMAL(12,2) DEFAULT 0,
  statut          statut_exercice DEFAULT 'ouvert',
  cloture_par     UUID REFERENCES profiles(id),
  cloture_a       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Insérer l'exercice courant
INSERT INTO exercices (annee, date_ouverture, statut)
VALUES (2026, '2026-01-01', 'ouvert');

-- Transactions
CREATE TABLE transactions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercice_id         UUID NOT NULL REFERENCES exercices(id),
  date_transaction    DATE NOT NULL,
  libelle             TEXT NOT NULL,
  montant             DECIMAL(12,2) NOT NULL CHECK (montant > 0),
  type                type_transaction NOT NULL,
  compte_id           UUID REFERENCES plan_comptable(id),
  -- Liens optionnels
  souhait_id          UUID REFERENCES souhaits(id) ON DELETE SET NULL,
  defraiement_id      UUID REFERENCES defraiements(id) ON DELETE SET NULL,
  -- Tiers
  tiers               TEXT,
  reference           TEXT,   -- N° facture, virement, etc.
  piece_justificative TEXT,   -- URL Supabase Storage
  -- Validation
  valide              BOOLEAN DEFAULT false,
  valide_par          UUID REFERENCES profiles(id),
  valide_a            TIMESTAMPTZ,
  -- Méta
  created_by          UUID NOT NULL REFERENCES profiles(id),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
) -- Référence circulaire : defraiements défini après, créée sans FK d'abord
;

CREATE TRIGGER trg_trans_updated BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_trans_exercice ON transactions(exercice_id, date_transaction);
CREATE INDEX idx_trans_type     ON transactions(type, date_transaction);
CREATE INDEX idx_trans_compte   ON transactions(compte_id);

-- ============================================================
-- 10. DÉFRAIEMENTS
-- ============================================================

CREATE TABLE defraiements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  volontaire_id   UUID REFERENCES volontaires(id),
  user_id         UUID REFERENCES profiles(id),
  -- Frais
  date_frais      DATE NOT NULL,
  categorie       categorie_defraiement NOT NULL,
  description     TEXT NOT NULL,
  montant         DECIMAL(10,2) NOT NULL CHECK (montant > 0),
  km              DECIMAL(8,1),   -- Si transport km
  taux_km         DECIMAL(4,3) DEFAULT 0.4201, -- Taux officiel belge 2026 (€/km)
  montant_km      DECIMAL(10,2) GENERATED ALWAYS AS (
    CASE WHEN km IS NOT NULL THEN km * taux_km ELSE NULL END
  ) STORED,
  -- Justificatif
  justificatif_url TEXT,
  -- Lien souhait
  souhait_id      UUID REFERENCES souhaits(id) ON DELETE SET NULL,
  -- Workflow validation N+1 → N+2
  statut          statut_defraiement DEFAULT 'en_attente',
  valide_n1_par   UUID REFERENCES profiles(id),
  valide_n1_a     TIMESTAMPTZ,
  note_n1         TEXT,
  valide_n2_par   UUID REFERENCES profiles(id),
  valide_n2_a     TIMESTAMPTZ,
  note_n2         TEXT,
  -- Paiement
  paye_a          TIMESTAMPTZ,
  reference_paiement TEXT,
  -- Méta
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER trg_defr_updated BEFORE UPDATE ON defraiements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Ajouter FK sur transactions maintenant que defraiements existe
ALTER TABLE transactions
  ADD CONSTRAINT fk_trans_defr
  FOREIGN KEY (defraiement_id) REFERENCES defraiements(id) ON DELETE SET NULL;

-- ============================================================
-- 11. VENTES ÉVÉNEMENTS
-- ============================================================

CREATE TABLE articles_vente (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom         TEXT NOT NULL,
  description TEXT,
  prix        DECIMAL(8,2) NOT NULL DEFAULT 0,
  stock       INT,
  categorie   TEXT,
  actif       BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE evenements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom         TEXT NOT NULL,
  date_debut  DATE NOT NULL,
  date_fin    DATE,
  lieu        TEXT,
  responsable_id UUID REFERENCES profiles(id),
  actif       BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ventes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evenement_id    UUID REFERENCES evenements(id),
  vendeur_id      UUID NOT NULL REFERENCES profiles(id),
  date_vente      TIMESTAMPTZ DEFAULT NOW(),
  total           DECIMAL(10,2) NOT NULL,
  mode_paiement   TEXT CHECK (mode_paiement IN ('cash','bancontact','virement','gratuit')),
  note            TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE vente_lignes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vente_id        UUID NOT NULL REFERENCES ventes(id) ON DELETE CASCADE,
  article_id      UUID REFERENCES articles_vente(id),
  article_nom     TEXT NOT NULL, -- Dénormalisé pour historique
  quantite        INT NOT NULL CHECK (quantite > 0),
  prix_unitaire   DECIMAL(8,2) NOT NULL,
  sous_total      DECIMAL(10,2) GENERATED ALWAYS AS (quantite * prix_unitaire) STORED
);

-- ============================================================
-- 12. ORGANIGRAMME
-- ============================================================

CREATE TABLE organigramme_postes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id   UUID REFERENCES organigramme_postes(id) ON DELETE SET NULL,
  role        TEXT NOT NULL,
  departement TEXT,
  prenom      TEXT,
  nom         TEXT,
  email       TEXT,
  niveau      SMALLINT DEFAULT 0,
  couleur     TEXT DEFAULT '#C8435A',
  notes       TEXT,
  pos_x       DECIMAL(8,2) DEFAULT 0,
  pos_y       DECIMAL(8,2) DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER trg_org_updated BEFORE UPDATE ON organigramme_postes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 13. ROW LEVEL SECURITY (RLS) — Protection RGPD
-- ============================================================

-- Activer RLS sur toutes les tables sensibles
ALTER TABLE profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE disponibilites        ENABLE ROW LEVEL SECURITY;
ALTER TABLE souhaits              ENABLE ROW LEVEL SECURITY;
ALTER TABLE souhait_personnel     ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklists            ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_reponses    ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_photos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications         ENABLE ROW LEVEL SECURITY;
ALTER TABLE volontaires           ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE defraiements          ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventes                ENABLE ROW LEVEL SECURITY;
ALTER TABLE vente_lignes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE organigramme_postes   ENABLE ROW LEVEL SECURITY;

-- Helper : récupérer le rôle de l'utilisateur connecté
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role::TEXT FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_admin_or_president()
RETURNS BOOLEAN AS $$
  SELECT get_user_role() IN ('admin','president');
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_medical()
RETURNS BOOLEAN AS $$
  SELECT get_user_role() IN ('admin','president','coordinateur',
    'ambulancier_bleu','ambulancier_gris','infirmier','medecin');
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ── Profiles ────────────────────────────────────────────────
CREATE POLICY "profiles_own"   ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "profiles_admin" ON profiles FOR ALL    USING (is_admin_or_president());
CREATE POLICY "profiles_team"  ON profiles FOR SELECT USING (actif = true);

-- ── Disponibilités ──────────────────────────────────────────
CREATE POLICY "dispo_own"    ON disponibilites FOR ALL    USING (user_id = auth.uid());
CREATE POLICY "dispo_view"   ON disponibilites FOR SELECT USING (is_medical());
CREATE POLICY "dispo_admin"  ON disponibilites FOR ALL    USING (is_admin_or_president());

-- ── Souhaits : données médicales — accès restreint ──────────
-- Coordinateurs et personnel médical uniquement
CREATE POLICY "souhaits_read" ON souhaits FOR SELECT
  USING (
    is_medical()
    OR coordinateur_id = auth.uid()
    OR created_by = auth.uid()
  );
CREATE POLICY "souhaits_write" ON souhaits FOR INSERT
  USING (is_medical());
CREATE POLICY "souhaits_update" ON souhaits FOR UPDATE
  USING (
    coordinateur_id = auth.uid()
    OR is_admin_or_president()
    OR get_user_role() = 'coordinateur'
  );
CREATE POLICY "souhaits_admin" ON souhaits FOR DELETE
  USING (is_admin_or_president());

-- ── Check-lists : uniquement le personnel assigné ────────────
CREATE POLICY "checklist_assigned" ON checklists FOR ALL
  USING (
    user_id = auth.uid()
    OR is_admin_or_president()
    OR get_user_role() = 'coordinateur'
    OR EXISTS (
      SELECT 1 FROM souhait_personnel sp
      WHERE sp.souhait_id = checklists.souhait_id
        AND sp.user_id = auth.uid()
    )
  );

CREATE POLICY "cl_reponses_via_checklist" ON checklist_reponses FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM checklists c
      WHERE c.id = checklist_reponses.checklist_id
        AND (c.user_id = auth.uid() OR is_admin_or_president() OR get_user_role() = 'coordinateur')
    )
  );

CREATE POLICY "cl_photos_via_checklist" ON checklist_photos FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM checklists c
      WHERE c.id = checklist_photos.checklist_id
        AND (c.user_id = auth.uid() OR is_admin_or_president() OR get_user_role() = 'coordinateur')
    )
  );

-- ── Notifications : uniquement ses propres ──────────────────
CREATE POLICY "notif_own" ON notifications FOR ALL USING (destinataire_id = auth.uid());
CREATE POLICY "notif_create" ON notifications FOR INSERT USING (is_medical());

-- ── Défraiements ────────────────────────────────────────────
CREATE POLICY "defr_own"   ON defraiements FOR ALL
  USING (user_id = auth.uid() OR volontaire_id IN (
    SELECT id FROM volontaires WHERE profile_id = auth.uid()
  ));
CREATE POLICY "defr_valid" ON defraiements FOR UPDATE
  USING (is_admin_or_president() OR get_user_role() = 'coordinateur');
CREATE POLICY "defr_admin" ON defraiements FOR SELECT
  USING (is_admin_or_president() OR get_user_role() IN ('coordinateur','tresorier'));

-- ── Transactions / Comptabilité ─────────────────────────────
CREATE POLICY "trans_read"  ON transactions FOR SELECT
  USING (is_admin_or_president() OR get_user_role() = 'tresorier');
CREATE POLICY "trans_write" ON transactions FOR INSERT
  USING (is_admin_or_president() OR get_user_role() IN ('tresorier','coordinateur'));
CREATE POLICY "trans_admin" ON transactions FOR UPDATE USING (is_admin_or_president());

-- ── Ventes ──────────────────────────────────────────────────
CREATE POLICY "ventes_own"   ON ventes FOR ALL    USING (vendeur_id = auth.uid());
CREATE POLICY "ventes_admin" ON ventes FOR SELECT USING (is_admin_or_president() OR get_user_role() = 'coordinateur');
CREATE POLICY "vente_lignes_via_vente" ON vente_lignes FOR ALL
  USING (EXISTS (SELECT 1 FROM ventes v WHERE v.id = vente_lignes.vente_id AND (v.vendeur_id = auth.uid() OR is_admin_or_president())));

-- ── Audit logs : lecture admin uniquement ────────────────────
CREATE POLICY "audit_admin" ON audit_logs FOR SELECT USING (is_admin_or_president());
CREATE POLICY "audit_insert" ON audit_logs FOR INSERT USING (auth.uid() IS NOT NULL);

-- ── Organigramme ─────────────────────────────────────────────
CREATE POLICY "org_read"  ON organigramme_postes FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "org_write" ON organigramme_postes FOR ALL   USING (is_admin_or_president());

-- ============================================================
-- 14. VUES UTILES (sans données sensibles)
-- ============================================================

-- Vue des souhaits sans données médicales (pour volontaires non-médicaux)
CREATE VIEW souhaits_public AS
  SELECT id, statut, date_souhaitee, date_realisee, localisation, priorite, created_at
  FROM souhaits WHERE deleted_at IS NULL;

-- Vue récapitulatif comptable par compte
CREATE VIEW recap_comptable AS
  SELECT
    pc.code, pc.libelle, pc.classe, pc.type,
    e.annee,
    COUNT(t.id) AS nb_transactions,
    SUM(t.montant) AS total
  FROM plan_comptable pc
  LEFT JOIN transactions t ON t.compte_id = pc.id
  LEFT JOIN exercices e ON t.exercice_id = e.id
  GROUP BY pc.code, pc.libelle, pc.classe, pc.type, e.annee;

-- Vue résultat annuel
CREATE VIEW resultat_annuel AS
  SELECT
    e.annee,
    SUM(CASE WHEN t.type = 'recette' THEN t.montant ELSE 0 END) AS total_recettes,
    SUM(CASE WHEN t.type = 'depense' THEN t.montant ELSE 0 END) AS total_depenses,
    SUM(CASE WHEN t.type = 'recette' THEN t.montant ELSE -t.montant END) AS resultat
  FROM exercices e
  LEFT JOIN transactions t ON t.exercice_id = e.id
  GROUP BY e.annee;

-- Vue statistiques souhaits
CREATE VIEW stats_souhaits AS
  SELECT
    EXTRACT(YEAR FROM COALESCE(date_realisee, date_souhaitee, created_at))::INT AS annee,
    statut,
    COUNT(*) AS nombre
  FROM souhaits WHERE deleted_at IS NULL
  GROUP BY annee, statut;

-- ============================================================
-- 15. STORAGE BUCKETS (à créer dans Supabase Dashboard)
-- ============================================================
-- Buckets à créer manuellement :
--   - "checklist-photos"  : privé, max 5MB par fichier, images uniquement
--   - "justificatifs"     : privé, max 10MB, PDF + images
--   - "documents-asbl"    : privé, max 50MB, tous types
--
-- Policies Storage à appliquer :
--   checklist-photos → accès lecture : personnel assigné au souhait
--   justificatifs    → accès lecture : propriétaire + admin
--   documents-asbl   → accès lecture : admin + president + tresorier

-- ============================================================
-- 16. POLITIQUE DE RÉTENTION RGPD
-- ============================================================
-- Créer un job pg_cron (dans Supabase) pour la purge automatique :
--
-- SELECT cron.schedule('purge-rgpd', '0 2 1 1 *', $$
--   -- Purger les souhaits soft-deleted depuis plus de 5 ans
--   DELETE FROM souhaits WHERE deleted_at < NOW() - INTERVAL '5 years';
--   -- Purger les logs d'audit de plus de 3 ans
--   DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '3 years';
--   -- Anonymiser les volontaires inactifs depuis 5 ans
--   UPDATE volontaires SET
--     prenom = 'Anonymisé', nom = 'Anonymisé',
--     email = NULL, telephone = NULL,
--     date_naissance = NULL, adresse = NULL
--   WHERE actif = false AND deleted_at < NOW() - INTERVAL '5 years';
-- $$);
