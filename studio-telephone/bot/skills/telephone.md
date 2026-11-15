---
description: Règles d'interface téléphone de Heart's Angels. À charger avant de modifier un écran, la barre ou une mission terrain.
---

# Application téléphone

L'application est une seule base React. L'ordinateur garde son menu latéral à partir de 900 px. En dessous, la coque téléphone s'affiche.

## Coque

- Les racines de section montrent la barre du bas : Accueil, Souhaits, Missions, Agenda, Plus.
- Un écran profond masque cette barre. L'en-tête a un retour et le menu des sections.
- Le bouton d'action d'une mission reste collé en bas de l'écran, pas sous la barre.
- Les droits d'accès sont les mêmes que ceux du menu ordinateur.

## Toucher

- Bouton, onglet et ligne de menu : au moins 44 px de haut.
- Champ, liste déroulante : 16 px, pour éviter le zoom d'iOS.
- Deux colonnes forcées (`ha-split`, grilles `1fr 1fr`) passent en une colonne sous 640 px.
- Les tableaux larges deviennent des cartes sur téléphone, ou se font glisser avec une indication.
- Le glisser-déposer des souhaits reste sur ordinateur. Sur téléphone, une colonne à la fois et un choix de statut sur la carte.

## Applications Android et iOS

Les applications installées sont la même base, ouverte par Capacitor (`android/`, `ios/`, `capacitor.config.json`). L'identifiant est `be.heartsangels.app`. Après un changement d'écran, `npm run build:mobile` recopie le site dans les deux projets. Ne crée pas une seconde application React Native. Dans l'application installée, le service worker du site ne se charge pas.

## À ne pas casser

- Les routes, les appels Supabase et les textes métier restent ceux de l'ordinateur.
- Ne rétrécis pas le menu latéral ni les grilles qui ne s'affichent qu'à partir de 900 px.
- Les mentions de copyright déjà présentes dans les fichiers sources restent en place.
