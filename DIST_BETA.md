# Build beta — appbetaapp.heartsangels.be

## Contenu de ce build (lots 1→4)

| Lot | Livré |
| --- | --- |
| 1 RH | Hub `/app/equipe`, validités ATNUP/112/sélection/visa sur fiche, onboarding 5 cases |
| 2 Logistique | Onglet Flotte, plaque véhicule, alertes stock actionnables, affectation/vecteurs liés flotte |
| 3 Terrain | Bannière pré-départ + rappel O₂ dans MissionExecution |
| 4 Finance | Module Défraiements (plus de stub) : saisie km/montant, validation N1/N2, payé |

## Avant / pendant publication

1. Publier le contenu de `dist/` sur **https://appbetaapp.heartsangels.be** (remplacer l’ancien site).
2. Garder / éditer `config.js` sur le serveur si besoin (Supabase URL / anon key). Le build embarque déjà `domaine: https://appbetaapp.heartsangels.be`.
3. Appliquer en SQL Supabase (SQL Editor) : `installeur/22_erp_rh_logistique.sql`  
   → active la colonne `stock_lieux.plaque` et les policies RLS `defraiements`.

Sans le SQL 22 : l’app marche, mais plaques flotte non persistées et défraiements peuvent être bloqués par RLS.
