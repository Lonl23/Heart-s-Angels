# Réunion studio — Vision stock au complet

**Date :** 13 novembre 2026 (Europe/Brussels)  
**Contexte :** inventaire facile + lots/DLC optionnels livrés ; besoin d’une vision partagée sur *tout* le cycle stock ASBL.  
**Participants agents :** Logistique, Product/UX, Architecte/data, Terrain (chef d’équipe DPS), Achats/trésorerie.

## Décisions figées

1. **Trois gestes terrain** : réceptionner → ranger (QR lieu puis QR article) → vérifier. Tout le reste est second plan ou derrière *Plus*.
2. **Un seul canal de rangement** : Ranger. Pas de second chemin « expert ». Création d’unités **uniquement** via Réception ; Excel = comptage (qté / pression), pas création.
3. **Adresse d’abord, quantités ensuite** — un sac / véhicule ne part que si Scan + dotation sont verts.
4. **Pas de SAP** : verrouiller QR unités + lieux + journal RPC + invariant lot=DLC ; MRP actionnable ; pas de couche ERP.
5. **Achats** : pas de passage *commandée* sans prix + enveloppe budgétaire ; réception clôture la commande ; paiement après réception (P0 achats, après les P0 terrain).

## Carte du système (déjà en place)

| Bloc | Rôle |
| --- | --- |
| Catalogue | Type d’article, mode, `gestion_lot` / `gestion_dlc`, seuils, fournisseur |
| Unités QR | Réalité physique (1 QR = 1 unité) |
| Lieux QR | Adresse (réserve → sac → pochette…) |
| Mouvements / RPC | Journal opérationnel (`stock_scan`, transfert, réception…) |
| Dotation (BOM) | Contenu prévu lieu × article × qté |
| MRP | À doter / à acheter (sécurité + BOM − stock − commandes) |
| Alertes | DLC, mini, sacs, O₂, entretien |
| Commandes / fournisseurs | File d’achat légère |
| Inventaire facile | À compléter · Où est quoi · Parcours lieu |

## Synthèse des interventions

### Logistique
Parcours jour type : Alertes matin → Réception + Ranger → doter les sacs → Scan vert avant départ → emport / rapport → retour déclassé + re-ranger → Excel le soir seulement pour masses.  
Manques : écarts live au Scan ; « vu sans QR → créer » ; un discours Ranger ; checklist retour mission ; rappels DLC/O₂ du jour.

### Product / UX
Risque = trop d’entrées pour le même geste. Hub Inventaires unique ; Alertes hors *Plus* ; renommer MRP → « Réappro » ; onboarding 60 s ; progressive disclosure (lot/DLC seulement si le type le demande). Accueil à recentrer sur 4 jobs.

### Architecte / data
Chaîne catalogue → unités → lieux → mouvements → BOM → MRP déjà saine. Protéger : même lot = même DLC partout en écriture ; QR immuables ; droits UI alignés SQL ; BOM ≠ stock. Offline hors P0. Perf : agrégats côté SQL.

### Terrain (chef d’équipe)
Un seul écran jour J : lieu → contenu attendu → emport/retour → écarts. QR lieu ouvre cette vérité, pas un menu de modules. Excel hors mission. Phrase : *un stock que je peux scanner, croire, et emporter*.

### Achats / trésorerie
Besoin (MRP/alertes) → commande (prix + enveloppe) → réception → paiement. Manque le lien argent (montant, budget, engagé vs payé, clôture commande à la réception).

## Priorités consolidées

### P0 (prochaines itérations)
| # | Sujet | Portée |
| --- | --- | --- |
| 1 | Écarts inventaire live (manques / hors liste vs BOM) dans le Scan | Terrain + archi |
| 2 | Raccourci « vu sans QR → créer + étiqueter » depuis inventaire | Terrain + logistique |
| 3 | Un seul parcours Ranger (code + libellés + discours équipe) | UX + logistique |
| 4 | Invariant lot = DLC sur toutes les écritures (réception, update lot) | Archi |
| 5 | Hub Inventaires = porte d’entrée terrain ; Alertes sur Accueil | UX |

### P1
| # | Sujet |
| --- | --- |
| 6 | Checklist retour mission → déclassé / re-dotation |
| 7 | Boucle MRP → doter / commander sans friction ; libellé « Réappro » |
| 8 | Prix + enveloppe budgétaire sur commandes ; clôture à la réception |
| 9 | Emport / retour mission unifié (sacs + alertes critiques avant départ) |
| 10 | Droits UI/SQL alignés ; perf alertes/MRP en SQL |

### P2
Historique « qui a rangé quoi » ; suggestions d’achat / comparatif fournisseur ; stats conso pour réviser les BOM ; seuil d’approbation trésorerie ; offline uniquement si le terrain le exige.

## Ce qu’on ne fait pas
- Couche WMS / SAP / OF.
- Offline-first en P0.
- Nouveaux chemins parallèles pour ranger.
- Excel comme source opérationnelle le jour de mission.

## Suite immédiate
1. Garder inventaire facile + lots/DLC optionnels comme base terrain.
2. Enchaîner P0.1–P0.5 avant d’élargir achats budgétaires.
3. Mettre à jour le discours équipe : *Ranger = adresse ; Excel = quantités ; Réception = création*.
