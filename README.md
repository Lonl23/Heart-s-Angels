# Heart's Angels — Application de gestion ASBL

Application web complète pour la gestion interne de l'ASBL Heart's Angels.

## Stack technique

| Couche | Technologie |
|---|---|
| Frontend | React 18 + Vite |
| Base de données | Supabase (PostgreSQL) |
| Hébergement | Firebase Hosting |
| Auth | Supabase Auth (PKCE) |
| Exports | jsPDF + xlsx |
| Routing | React Router v6 |

---

## Installation (première fois)

### 1. Prérequis

- Node.js 18+ (`node --version`)
- npm 9+
- Compte [Supabase](https://supabase.com) (gratuit)
- Compte [Firebase](https://console.firebase.google.com) (gratuit)

### 2. Installer les dépendances

```bash
cd hearts-angels
npm install
```

### 3. Configurer Supabase

1. Créer un projet sur [supabase.com](https://supabase.com)
   - **Région : Frankfurt (eu-central-1)** ← obligatoire pour RGPD
   - Choisir un mot de passe fort pour la base de données

2. Aller dans **SQL Editor** et exécuter tout le contenu de `supabase_schema.sql`

3. Dans **Settings → API**, copier :
   - `Project URL`
   - `anon public key`

4. Créer le fichier `.env.local` :
```
VITE_SUPABASE_URL=https://VOTRE-PROJET.supabase.co
VITE_SUPABASE_ANON_KEY=votre-clé-anon
```

5. Dans **Storage**, créer ces buckets (tous en mode **privé**) :
   - `checklist-photos` (max 5MB, images seulement)
   - `justificatifs` (max 10MB, PDF + images)
   - `documents-asbl` (max 50MB)

6. Dans **Authentication → Settings** :
   - Désactiver "Email confirmations" pour les invitations internes
   - Activer "Secure email change"
   - Session expiry : 8 heures (usage journalier)

### 4. Configurer Firebase Hosting

```bash
# Installer Firebase CLI
npm install -g firebase-tools

# Se connecter
firebase login

# Initialiser (choisir "Hosting" uniquement)
firebase init
# → Dossier public : dist
# → Single-page app : oui
# → GitHub deploys : optionnel

# Récupérer l'ID de votre projet Firebase
firebase projects:list
```

### 5. Lancer en développement

```bash
npm run dev
# → http://localhost:5173
```

### 6. Déployer

```bash
npm run deploy
# → Build + upload sur Firebase Hosting automatiquement
```

---

## Créer le premier compte administrateur

Dans Supabase → **Authentication → Users** → "Invite user" :
1. Renseigner l'email du premier admin
2. Après inscription, dans **Table Editor → profiles**, modifier le champ `role` en `admin`

---

## Structure des modules

```
src/modules/
├── auth/              Login, réinitialisation mot de passe
├── dashboard/         Tableau de bord (KPIs, alertes)
├── disponibilites/    Calendrier des disponibilités
├── souhaits/          Gestion souhaits + check-lists
├── comptabilite/      Comptabilité complète ASBL
├── vente/             Point de vente événements
├── volontaires/       Registre volontaires
├── defraiements/      Défraiements + validation N+1/N+2
└── organigramme/      Organigramme interactif éditable
```

---

## Rôles et permissions

| Rôle | Accès |
|---|---|
| `admin` | Tout |
| `president` | Tout (N+2 : reçoit toutes les notifications critiques) |
| `coordinateur` | Souhaits, volontaires, défraiements, disponibilités, vente |
| `tresorier` | Comptabilité, défraiements, exports |
| `ambulancier_bleu` / `ambulancier_gris` | Disponibilités, souhaits assignés, check-lists, défraiements |
| `infirmier` | idem |
| `medecin` | idem + notes médicales |
| `volontaire_non_medical` | Disponibilités, défraiements propres |

---

## Conformité RGPD

### Mesures techniques implementées

- **Hébergement EU** : Supabase Frankfurt (données ne quittent pas l'UE)
- **HTTPS forcé** : Firebase Hosting (HSTS activé)
- **Authentification sécurisée** : PKCE flow, session en sessionStorage
- **Row Level Security** : chaque utilisateur ne voit que ce qu'il a le droit de voir
- **Audit logs** : toutes les actions sur données sensibles sont tracées
- **Soft delete** : les données supprimées sont marquées, pas effacées (conservation légale)
- **Purge automatique** : données purgées après 5 ans (souhaits) / 3 ans (logs)
- **Chiffrement transit** : TLS 1.3 sur toutes les connexions
- **Headers sécurité** : CSP, X-Frame-Options, HSTS configurés

### Mesures organisationnelles recommandées

- [ ] Désigner un **DPO** (Délégué à la Protection des Données) — obligatoire pour les données de santé
- [ ] Rédiger un **registre des traitements** (Art. 30 RGPD)
- [ ] Mettre en place une **politique de confidentialité** visible des bénéficiaires
- [ ] Obtenir le **consentement explicite** des bénéficiaires pour les données de santé (Art. 9)
- [ ] Mettre en place une procédure de **réponse aux violations** (72h max pour notifier l'APD)
- [ ] Former le personnel au RGPD annuellement
- [ ] Contacter l'**APD belge** (Autorité de Protection des Données) : [apd-gba.be](https://www.apd-gba.be)

---

## Exports annuels disponibles

| Export | Format | Module |
|---|---|---|
| Bilan comptable | PDF | Comptabilité |
| Grand livre complet | Excel | Comptabilité |
| Rapport des souhaits | PDF | Souhaits |
| État des défraiements | Excel | Défraiements |
| Registre volontaires | PDF | Volontaires |

---

## Support et maintenance

- Logs d'erreur : Supabase Dashboard → Logs
- Monitoring : Firebase Console → Hosting
- Sauvegardes : Supabase effectue des sauvegardes quotidiennes automatiques (plan gratuit : 7 jours)

---

*Heart's Angels ASBL — Application interne confidentielle*
