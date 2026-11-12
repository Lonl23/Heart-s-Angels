# patient-registry — appli liée Heart's Angels

Appliquette **séparée** pour l’enregistrement patient sur DPS, reliée à l’ERP beta via Supabase (même projet).

## Lien avec l’ERP

| ERP (`appbetaapp`) | Patient registry |
| --- | --- |
| `activites_secours` (DPS) | parent |
| `fiches_patient_dps` | fiches créées ici |

Migration : `installeur/117_fiches_patient_lien_dps.sql` (déjà appliquée sur le projet Heart's Angels).

## Modèle de fiche patient (v1)

Champs minimaux (pas un DPI hospitalier) :

- Lien `activite_id` (DPS)
- Identité : nom, prénom, date de naissance, sexe
- Prise en charge : motifs, heure début / fin, orientation
- Notes terrain

Les bilans cliniques détaillés et la conformité RGPD/santé seront cadrés avec `security` + `domain-expert` avant toute prod publique.

## Suite

1. Scaffold Vite + auth Supabase (même projet `vppmvjqbzdeftrhdoert`)
2. Liste des DPS du jour → ouvrir / créer fiches
3. Export / synchro lecture seule vers l’ERP si besoin

Ce dossier est volontairement léger pour démarrer sans bloquer le DPS dans l’app principale.
