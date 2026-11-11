# Circuit de développement du studio

Utilise ce skill quand Laurent demande une feature, un correctif, une appli, une revue, ou un déploiement.

## Noyau vs studio complet

**Noyau** (petite appli / correctif) : `product` → `frontend` et/ou `backend` → `reviewer` + `qa` → `verifier` → accord → éventuellement `deployer` → `docs-formation` si impact utilisateur.

**Complet** (nouvelle appli, schéma sensible, données patients, multi-applis) : ajoute `architect`, `domain-expert`, `platform`, `security`, et `portfolio-manager` en amont si cannibalisation / doublon.

## Étapes

1. Clarifier le but en une phrase. Appeler `record-brief`.
2. `product` : stories + critères d'acceptation.
3. `architect` (+ `domain-expert` si métier AMU/ATNUP/AVIQ/112).
4. Production en parallèle logique : `frontend` / `backend` / `platform` selon le brief.
5. Contrôle en vague : `reviewer` (lecture seule, pas de patch), `security`, `qa`.
6. `verifier` : verdict go / no-go factuel.
7. Demander l'accord explicite de Laurent. Ouvrir `deploy-gate` seulement sur « go ».
8. `deployer` uniquement si gate `approved`.
9. `docs-formation` après publication ou si le flux utilisateur change.

## Anti-patterns

- Appeler `deployer` « pour préparer » sans go.
- Laisser `reviewer` modifier le code.
- Activer les 14 agents pour un typo CSS.
- Faire publier `backend` sur Supabase prod.
