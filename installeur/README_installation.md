# Installation Heart's Angels — nouveau serveur

## Prérequis
- Node.js installé sur la machine d'installation.
- Un projet Supabase (en ligne ou auto-hébergé) accessible.
- Sous la main : l'URL du serveur, la clé **service_role**, et la **chaîne de
  connexion PostgreSQL** (Supabase → Database → Connection string → URI).

## 1) Lancer l'installeur
```
cd installeur
npm install
npm start
```
Répondez aux questions (URL, service_role, connexion PostgreSQL, e-mail + mot de
passe du premier admin). L'installeur applique le schéma, crée le bucket de
stockage et le premier compte admin.

## 2) Réglage d'authentification (obligatoire)
Dans Supabase → **Authentication → Sign In / Providers → Email**, **désactivez
« Confirm email »**. Sans cela, l'inscription par code d'invitation ne peut pas
aboutir (pas de serveur d'e-mails). C'est le seul réglage à faire.

## 3) Configurer l'application
Dans le build de l'app, éditez **config.js** :
- `supabase.url` et `supabase.anonKey` (clé **anon** publique, pas la service_role) ;
- le nom de l'organisation, le pays, le taux km, etc.

## 4) Se connecter
Ouvrez l'app, connectez-vous avec l'e-mail admin : il devra définir son mot de
passe personnel, puis pourra créer les autres membres et les partenaires.

⚠️ La clé **service_role** ne sert QU'à l'installation. Ne la mettez jamais dans
config.js ni dans l'application.

## Publication — d’abord `appbetaapp`, ensuite `app`
Toute mise à jour va d’abord sur la **bêta**. Laurent teste, puis on publie la prod.

Adresses officielles (cPanel EX2, dossiers dédiés — **jamais** le `public_html` du site public Yapla) :

- **Bêta :** https://appbetaapp.heartsangels.be  (pastille **Bêta**)
- **Prod :** https://app.heartsangels.be  (pas de pastille)

Le site public `heartsangels.be` / Yapla, les mails et le DNS apex ne sont pas concernés.

Tant que ces sous-domaines ne sont pas en ligne, le canal Firebase `beta` reste le repli :

```
npm run deploy:beta
```
Canal Firebase Hosting `beta` (la prod `heart-s-angels.web.app` n’est pas touchée). Une pastille **Bêta** s’affiche aussi sur ce canal.

URL Firebase actuelle : https://heart-s-angels--beta-ynfgwaur.web.app (expire au bout de 30 jours ; relancer `deploy:beta` pour renouveler).

Après validation de Laurent seulement :

```
npm run deploy:prod
```
(ne pas lancer tant que la bêta n’est pas validée.)

### cPanel — prudence (compte administrateur)
Ne pas supprimer de comptes, bases, mails, DNS, SSL, WordPress ou Yapla. Ne pas toucher à `public_html` du site public. Ne pas changer PHP, e-mail, ni lancer d’outils « optimiser » / rechercher-remplacer en masse.

Créer uniquement les sous-domaines `appbetaapp` et `app` vers des **dossiers vides dédiés** (`appbetaapp.heartsangels.be/` et `app.heartsangels.be/`). Copier `dist/` + `.htaccess` (déjà dans `public/`) **seulement** dans le dossier bêta. Laisser la prod vide (ou un « bientôt ») tant que Laurent n’a pas validé.

Si les sous-domaines n’existent pas encore dans EX2, créer **uniquement** ces deux enregistrements (même IP que le site, **sans** modifier `@` ni `www`) :

| Type | Nom         | Valeur        |
|------|-------------|---------------|
| A    | appbetaapp  | 162.19.57.142 |
| A    | app         | 162.19.57.142 |

Puis AutoSSL pour **ces deux hôtes seulement**.

Dans Supabase → Authentication → URL Configuration, ajouter les redirections :

- `https://app.heartsangels.be/**`
- `https://appbetaapp.heartsangels.be/**`

(garder aussi le canal Firebase tant qu’il sert de repli.)
