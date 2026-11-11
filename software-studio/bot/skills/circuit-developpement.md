# Circuit de développement du studio

Utilise ce skill quand Laurent demande une feature, un correctif, une appli, une revue, ou un déploiement.

## Vision
On construit l'**ERP Heart's Angels à échelle ASBL** (intégré, simple, complet pour leurs process). Pas « anti-ERP » : anti-usine enterprise.

## Noyau vs studio complet

**Noyau** (petite appli / correctif) : `product` → code (`frontend` / `backend` / `rh` / `logistique` / `finance`) → `reviewer` + `qa` → `verifier` → accord → éventuellement `deployer` → `docs-formation` si impact utilisateur.

**Complet** (nouvelle appli, schéma sensible, données patients/RH/finance, multi-applis) : ajoute `architect`, `domain-expert`, `platform`, `security`, et `portfolio-manager` en amont si cannibalisation / doublon.

## Spécialistes codage métier

| Besoin | Agent |
| --- | --- |
| Personnel, contrats, plannings, absences, formations | `rh` |
| Stocks, matériel, véhicules, tournées, inventaires | `logistique` |
| Budgets, dépenses, notes de frais, facturation, reporting | `finance` |

Si le besoin est transverse (auth générique, design system), garde `backend` / `frontend` / `platform`.

## Étapes

1. Clarifier le but en une phrase. Appeler `record-brief`.
2. `product` : stories + critères d'acceptation.
3. `architect` (+ `domain-expert` si métier AMU/ATNUP/AVIQ/112).
4. Production : `frontend` / `backend` / `platform` / `rh` / `logistique` / `finance` selon le brief.
5. Contrôle en vague : `reviewer` (lecture seule, pas de patch), `security` (surtout RH/finance/patients), `qa`.
6. `verifier` : verdict go / no-go factuel.
7. Demander l'accord explicite de Laurent. Ouvrir `deploy-gate` seulement sur « go ».
8. `deployer` uniquement si gate `approved`.
9. `docs-formation` après publication ou si le flux utilisateur change.

## Anti-patterns

- Appeler `deployer` « pour préparer » sans go.
- Laisser `reviewer` modifier le code.
- Activer tout le studio pour un typo CSS.
- Faire publier `backend` / `rh` / `logistique` / `finance` sur Supabase prod.
- Coder de la finance ou de la RH sans passer `security` sur les accès et la minimisation des données.
