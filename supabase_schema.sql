-- ============================================================
-- HEARTS ANGELS — Schéma Supabase v2 (corrigé)
-- Région : Frankfurt EU — RGPD
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Fonction updated_at (partagée)
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

-- ============================================================
-- 1. PROFILS UTILISATEURS
-- ============================================================
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  prenom      TEXT NOT NULL DEFAULT '',
  nom         TEXT NOT NULL DEFAULT '',
  telephone   TEXT,
  role        TEXT NOT NULL DEFAULT 'volontaire_non_medical',
  iban        TEXT,
  actif       BOOLEAN DEFAULT true,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_self" ON profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "profiles_staff_read" ON profiles FOR SELECT
  USING (auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin','coordinateur','president')));

-- Auto-création profil à l'inscription
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, prenom, nom)
  VALUES (NEW.id, NEW.email, '', '');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- 2. AUDIT LOGS
-- ============================================================
CREATE TABLE audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  table_name  TEXT,
  record_id   UUID,
  old_data    JSONB,
  new_data    JSONB,
  ip_address  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_admin" ON audit_logs FOR ALL
  USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'));

-- ============================================================
-- 3. DISPONIBILITÉS
-- ============================================================
CREATE TABLE disponibilites (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date_debut    TIMESTAMPTZ NOT NULL,
  date_fin      TIMESTAMPTZ NOT NULL,
  qualification TEXT,
  commentaire   TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER trg_dispo_updated BEFORE UPDATE ON disponibilites
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_dispo_user  ON disponibilites(user_id);
CREATE INDEX idx_dispo_dates ON disponibilites(date_debut, date_fin);

ALTER TABLE disponibilites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dispo_own"       ON disponibilites FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "dispo_coord_read" ON disponibilites FOR SELECT
  USING (auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin','coordinateur','president')));

-- ============================================================
-- 4. SOUHAITS
-- ============================================================
CREATE TABLE souhaits (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Patient
  patient_prenom      TEXT NOT NULL,
  patient_nom         TEXT NOT NULL,
  patient_ddn         DATE,
  etablissement       TEXT,
  medecin_referent    TEXT,
  -- Contact
  contact_prenom      TEXT,
  contact_nom         TEXT,
  contact_relation    TEXT,
  contact_email       TEXT,
  contact_telephone   TEXT,
  -- Souhait
  souhait_description TEXT NOT NULL,
  date_souhait        DATE,
  souhait_lieu        TEXT,
  -- Médical
  mobilite            TEXT,
  equipement_medical  TEXT,
  allergies           TEXT,
  urgence             BOOLEAN DEFAULT false,
  -- Suivi
  statut              TEXT NOT NULL DEFAULT 'nouvelle',
  notes               TEXT,
  -- Liens
  from_demande_id     UUID,
  created_by          UUID REFERENCES profiles(id),
  coordinateur_id     UUID REFERENCES profiles(id),
  -- Méta
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER trg_souhaits_updated BEFORE UPDATE ON souhaits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_souhaits_statut ON souhaits(statut);
CREATE INDEX idx_souhaits_date   ON souhaits(date_souhait);

ALTER TABLE souhaits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "souhaits_staff" ON souhaits FOR ALL
  USING (auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin','president','coordinateur','ambulancier_bleu','ambulancier_gris','infirmier','medecin','tresorier','secretaire','volontaire_non_medical')));

-- Personnel assigné à un souhait
CREATE TABLE souhait_personnel (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  souhait_id  UUID NOT NULL REFERENCES souhaits(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role_mission TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(souhait_id, user_id)
);

ALTER TABLE souhait_personnel ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sp_staff" ON souhait_personnel FOR ALL
  USING (auth.uid() IN (SELECT id FROM profiles WHERE actif = true));

-- ============================================================
-- 5. CHECKLISTS
-- ============================================================
CREATE TABLE checklist_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        TEXT NOT NULL,   -- 'depart' | 'retour'
  ordre       INTEGER NOT NULL DEFAULT 0,
  texte       TEXT NOT NULL,
  obligatoire BOOLEAN DEFAULT false,
  categorie   TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 26 items fixes départ
INSERT INTO checklist_items (type, ordre, texte, obligatoire, categorie) VALUES
  ('depart', 1,  'Dossier médical patient vérifié',        true,  'médical'),
  ('depart', 2,  'Médecin référent contacté',              true,  'médical'),
  ('depart', 3,  'Ordonnances et médicaments préparés',    true,  'médical'),
  ('depart', 4,  'Équipement O2 vérifié et chargé',        false, 'matériel'),
  ('depart', 5,  'Brancard/fauteuil prêt',                 false, 'matériel'),
  ('depart', 6,  'Ambulance vérifiée et propre',           true,  'logistique'),
  ('depart', 7,  'Carburant vérifié',                      true,  'logistique'),
  ('depart', 8,  'GPS/itinéraire préparé',                 true,  'logistique'),
  ('depart', 9,  'Famille/contact informé de l''heure',   true,  'communication'),
  ('depart', 10, 'Patient informé du déroulement',         true,  'communication'),
  ('depart', 11, 'Consentement signé',                     true,  'administratif'),
  ('depart', 12, 'Assurance vérifiée',                     true,  'administratif'),
  ('depart', 13, 'Km départ noté',                         true,  'logistique'),
  ('retour', 1,  'Patient raccompagné sain et sauf',       true,  'médical'),
  ('retour', 2,  'Rapport médical complété',               true,  'médical'),
  ('retour', 3,  'Km retour noté',                         true,  'logistique'),
  ('retour', 4,  'Ambulance nettoyée',                     true,  'logistique'),
  ('retour', 5,  'Matériel rangé et inventorié',           true,  'matériel'),
  ('retour', 6,  'Photos du souhait prises (max 10)',      false, 'communication'),
  ('retour', 7,  'Famille informée du retour',             true,  'communication'),
  ('retour', 8,  'Fiche souhait complétée',                true,  'administratif'),
  ('retour', 9,  'Défraiements notés',                     false, 'administratif'),
  ('retour', 10, 'Responsable informé',                    true,  'administratif');

CREATE TABLE checklists (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  souhait_id  UUID NOT NULL REFERENCES souhaits(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,   -- 'depart' | 'retour'
  user_id     UUID REFERENCES profiles(id),
  km_aller    DECIMAL(8,1),
  km_retour   DECIMAL(8,1),
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE checklist_reponses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID NOT NULL REFERENCES checklists(id) ON DELETE CASCADE,
  item_id      UUID REFERENCES checklist_items(id),
  texte_libre  TEXT,
  ok           BOOLEAN DEFAULT false,
  commentaire  TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE checklist_photos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID REFERENCES checklists(id) ON DELETE CASCADE,
  souhait_id   UUID REFERENCES souhaits(id) ON DELETE CASCADE,
  url          TEXT NOT NULL,
  legende      TEXT,
  ordre        INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE checklists         ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_reponses ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_photos   ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cl_staff"     ON checklists         FOR ALL USING (auth.uid() IN (SELECT id FROM profiles WHERE actif = true));
CREATE POLICY "clr_staff"    ON checklist_reponses FOR ALL USING (auth.uid() IN (SELECT id FROM profiles WHERE actif = true));
CREATE POLICY "clp_staff"    ON checklist_photos   FOR ALL USING (auth.uid() IN (SELECT id FROM profiles WHERE actif = true));

-- ============================================================
-- 6. NOTIFICATIONS
-- ============================================================
CREATE TABLE notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  destinataire_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  expediteur_id   UUID REFERENCES profiles(id),
  titre           TEXT NOT NULL,
  message         TEXT,
  type            TEXT DEFAULT 'info',
  priorite        TEXT DEFAULT 'normale',
  lien            TEXT,
  lu              BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notif_dest ON notifications(destinataire_id, lu, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_own" ON notifications FOR ALL USING (auth.uid() = destinataire_id);

-- ============================================================
-- 7. VOLONTAIRES (candidatures internes)
-- ============================================================
CREATE TABLE volontaires (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  statut      TEXT DEFAULT 'actif',
  date_entree DATE,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE volontaires ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vol_staff" ON volontaires FOR ALL
  USING (auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin','president','coordinateur')));

-- ============================================================
-- 8. PLAN COMPTABLE BELGE ASBL
-- ============================================================
CREATE TABLE plan_comptable (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero   TEXT NOT NULL UNIQUE,
  libelle  TEXT NOT NULL,
  type     TEXT,   -- 'actif','passif','charge','produit'
  actif    BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO plan_comptable (numero, libelle, type) VALUES
  ('100', 'Capital social / Fonds associatifs',    'passif'),
  ('130', 'Réserves',                              'passif'),
  ('140', 'Résultat reporté',                      'passif'),
  ('200', 'Frais d''établissement',                'actif'),
  ('230', 'Matériel médical',                      'actif'),
  ('240', 'Matériel de transport',                 'actif'),
  ('400', 'Clients / Débiteurs',                   'actif'),
  ('440', 'Fournisseurs / Créditeurs',             'passif'),
  ('450', 'Dettes fiscales',                       'passif'),
  ('499', 'Comptes d''attente',                    'passif'),
  ('550', 'Compte bancaire ING',                   'actif'),
  ('570', 'Caisse espèces',                        'actif'),
  ('600', 'Achats matériel médical',               'charge'),
  ('610', 'Carburant et frais véhicule',           'charge'),
  ('611', 'Entretien véhicule',                    'charge'),
  ('612', 'Assurances',                            'charge'),
  ('620', 'Défraiements bénévoles',                'charge'),
  ('640', 'Frais administratifs',                  'charge'),
  ('641', 'Frais postaux et communication',        'charge'),
  ('650', 'Frais de formation',                    'charge'),
  ('660', 'Frais d''événements',                   'charge'),
  ('670', 'Dons accordés',                         'charge'),
  ('700', 'Dons reçus personnes physiques',        'produit'),
  ('701', 'Dons reçus personnes morales',          'produit'),
  ('702', 'Subsides communaux',                    'produit'),
  ('703', 'Subsides régionaux',                    'produit'),
  ('704', 'Recettes événements',                   'produit'),
  ('705', 'Ventes boutique / articles',            'produit'),
  ('706', 'Cotisations membres',                   'produit'),
  ('740', 'Produits financiers',                   'produit');

ALTER TABLE plan_comptable ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pc_read_all" ON plan_comptable FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "pc_write_finance" ON plan_comptable FOR ALL
  USING (auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin','tresorier','president')));

-- ============================================================
-- 9. EXERCICES COMPTABLES
-- ============================================================
CREATE TABLE exercices (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  annee         INTEGER NOT NULL UNIQUE,
  date_ouverture DATE NOT NULL,
  date_cloture   DATE,
  statut        TEXT DEFAULT 'ouvert',
  cloture_par   UUID REFERENCES profiles(id),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO exercices (annee, date_ouverture, statut)
VALUES (2026, '2026-01-01', 'ouvert');

ALTER TABLE exercices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ex_finance" ON exercices FOR ALL
  USING (auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin','tresorier','president','coordinateur')));

-- ============================================================
-- 10. TRANSACTIONS  (noms colonnes alignés avec React)
-- ============================================================
CREATE TABLE transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercice_id     UUID REFERENCES exercices(id),
  date_operation  DATE NOT NULL DEFAULT CURRENT_DATE,
  libelle         TEXT NOT NULL,
  montant         DECIMAL(12,2) NOT NULL CHECK (montant > 0),
  type_mouvement  TEXT NOT NULL CHECK (type_mouvement IN ('recette','depense')),
  compte_id       UUID REFERENCES plan_comptable(id),
  souhait_id      UUID REFERENCES souhaits(id) ON DELETE SET NULL,
  defraiement_id  UUID,   -- FK ajoutée après creation de defraiements
  tiers           TEXT,
  reference       TEXT,
  piece_justificative TEXT,
  valide          BOOLEAN DEFAULT false,
  valide_par      UUID REFERENCES profiles(id),
  valide_a        TIMESTAMPTZ,
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER trg_trans_updated BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_trans_date    ON transactions(date_operation);
CREATE INDEX idx_trans_type    ON transactions(type_mouvement, date_operation);
CREATE INDEX idx_trans_compte  ON transactions(compte_id);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trans_finance" ON transactions FOR ALL
  USING (auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin','tresorier','president','coordinateur')));

-- ============================================================
-- 11. DÉFRAIEMENTS  (noms colonnes alignés avec React)
-- ============================================================
CREATE TABLE defraiements (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID REFERENCES profiles(id),
  souhait_id          UUID REFERENCES souhaits(id) ON DELETE SET NULL,
  date_deplacement    DATE NOT NULL DEFAULT CURRENT_DATE,
  categorie           TEXT NOT NULL DEFAULT 'mission',
  description         TEXT NOT NULL,
  km                  DECIMAL(8,1) DEFAULT 0,
  montant_km          DECIMAL(10,2) DEFAULT 0,
  montant_avance      DECIMAL(10,2) DEFAULT 0,
  montant_rembourse   DECIMAL(10,2) DEFAULT 0,
  justificatif_url    TEXT,
  statut              TEXT NOT NULL DEFAULT 'soumis',
  -- Validation N+1
  validated_by_n1     UUID REFERENCES profiles(id),
  validated_at_n1     TIMESTAMPTZ,
  note_n1             TEXT,
  -- Validation N+2
  validated_by_n2     UUID REFERENCES profiles(id),
  validated_at_n2     TIMESTAMPTZ,
  note_n2             TEXT,
  -- Paiement
  validated_by_paiement UUID REFERENCES profiles(id),
  validated_at_paiement TIMESTAMPTZ,
  date_paiement       TIMESTAMPTZ,
  -- Méta
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER trg_defr_updated BEFORE UPDATE ON defraiements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_defr_user   ON defraiements(user_id, statut);
CREATE INDEX idx_defr_statut ON defraiements(statut);

-- Ajout FK sur transactions maintenant que defraiements existe
ALTER TABLE transactions
  ADD CONSTRAINT fk_trans_defr
  FOREIGN KEY (defraiement_id) REFERENCES defraiements(id) ON DELETE SET NULL;

ALTER TABLE defraiements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "defr_own" ON defraiements FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "defr_coord_read" ON defraiements FOR SELECT
  USING (auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin','president','coordinateur','tresorier')));
CREATE POLICY "defr_coord_write" ON defraiements FOR UPDATE
  USING (auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin','president','coordinateur')));

-- ============================================================
-- 12. VENTES ÉVÉNEMENTS
-- ============================================================
CREATE TABLE articles_vente (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom_fr          TEXT NOT NULL,
  nom_nl          TEXT,
  nom_en          TEXT,
  description_fr  TEXT,
  prix_vente_ttc  DECIMAL(10,2) NOT NULL,
  tva             DECIMAL(4,2) DEFAULT 0.21,
  stock_evenement INTEGER DEFAULT 0,
  categorie_id    UUID,
  image_url       TEXT,
  actif           BOOLEAN DEFAULT true,
  ordre           INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO articles_vente (nom_fr, prix_vente_ttc, tva, stock_evenement, actif) VALUES
  ('T-shirt Heart''s Angels', 15.00, 0.21, 50, true),
  ('Tote bag',                  8.00, 0.21, 30, true),
  ('Badge magnétique',          3.00, 0.21, 100, true),
  ('Carte de voeux',            2.00, 0.21, 200, true),
  ('Bracelet solidarité',       5.00, 0.21, 80, true);

CREATE TABLE ventes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operateur_id    UUID NOT NULL REFERENCES profiles(id),
  montant_ttc     DECIMAL(10,2) NOT NULL,
  mode_paiement   TEXT NOT NULL DEFAULT 'cash',
  statut          TEXT DEFAULT 'payee',
  evenement_id    UUID,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE vente_lignes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vente_id        UUID NOT NULL REFERENCES ventes(id) ON DELETE CASCADE,
  article_id      UUID REFERENCES articles_vente(id),
  quantite        INTEGER NOT NULL DEFAULT 1,
  prix_unitaire   DECIMAL(10,2) NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE articles_vente ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE vente_lignes   ENABLE ROW LEVEL SECURITY;
CREATE POLICY "av_read"   ON articles_vente FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "av_write"  ON articles_vente FOR ALL
  USING (auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin','coordinateur','president','tresorier')));
CREATE POLICY "v_staff"   ON ventes FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "vl_staff"  ON vente_lignes FOR ALL USING (auth.uid() IS NOT NULL);

-- ============================================================
-- 13. ORGANIGRAMME
-- ============================================================
CREATE TABLE organigramme_postes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prenom      TEXT NOT NULL,
  nom         TEXT NOT NULL,
  titre       TEXT,
  parent_id   UUID REFERENCES organigramme_postes(id),
  ordre       INTEGER DEFAULT 0,
  photo_url   TEXT,
  initiales   TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO organigramme_postes (id, prenom, nom, titre, parent_id, ordre, initiales) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Ludovic',   'Whenham', 'Président',        NULL,                                     1, 'LW'),
  ('00000000-0000-0000-0000-000000000002', 'Carine',    'Carlier', 'Vice-Présidente',  '00000000-0000-0000-0000-000000000001',    2, 'CC'),
  ('00000000-0000-0000-0000-000000000003', 'Fernand',   'Hanssen', 'Trésorier',        '00000000-0000-0000-0000-000000000001',    3, 'FH'),
  ('00000000-0000-0000-0000-000000000004', 'Véronique', 'Cloes',   'Secrétaire',       '00000000-0000-0000-0000-000000000001',    4, 'VC'),
  ('00000000-0000-0000-0000-000000000005', 'Christine', 'Laurent', 'Administratrice',  '00000000-0000-0000-0000-000000000001',    5, 'CL'),
  ('00000000-0000-0000-0000-000000000006', 'Luc',       'Kessel',  'Administrateur',   '00000000-0000-0000-0000-000000000001',    6, 'LK');

ALTER TABLE organigramme_postes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_read"  ON organigramme_postes FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "org_write" ON organigramme_postes FOR ALL
  USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'));

