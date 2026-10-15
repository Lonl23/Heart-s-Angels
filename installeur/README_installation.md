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

## Publication — d’abord la bêta, ensuite la prod
Toute mise à jour va d’abord sur la **bêta**. Laurent teste, puis on publie la prod.

```
npm run deploy:beta
```
Canal Firebase Hosting `beta` (la prod `heart-s-angels.web.app` n’est pas touchée). Une pastille **Bêta** s’affiche dans l’en-tête et à la connexion.

URL actuelle : https://heart-s-angels--beta-ynfgwaur.web.app (expire au bout de 30 jours ; relancer `deploy:beta` pour renouveler).

Après validation :

```
npm run deploy:prod
```
(à ne lancer que lorsque Laurent a validé la bêta.)

Hébergement cPanel (`heartsangels.be`, EX2) : pas d’identifiants FTP/SSH dans le dépôt. Pour y coller plus tard un sous-domaine `beta.heartsangels.be` : hôte FTP, utilisateur, mot de passe (secrets Cursor, pas git), copie du dossier `dist/`, et réécriture SPA vers `index.html` (fichier `.htaccess` déjà dans `public/`).
