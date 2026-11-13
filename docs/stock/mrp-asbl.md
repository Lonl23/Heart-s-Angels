# MRP stock — échelle ASBL Heart's Angels

Pas un SAP. Un **MRP léger** branché sur le stock QR existant.

## Modèle

| Notion MRP | Chez nous |
| --- | --- |
| Nomenclature (BOM) | `stock_dotation` : lieu × article × **qté** |
| Stock dispo | `stock_unites` (pièce / boîte / O₂) |
| Stock de sécurité | `stock_minimal` (réserve) + `stock_minimal_sacs` (mission) |
| Ordres ouverts | `stock_commandes` (`a_commander`, `commandee`, `en_attente`) |
| Besoins nets | RPC `stock_mrp_besoins()` + onglet **MRP** |

## Calcul

- **À doter** = trous de nomenclature couverts par le stock global → ranger / doter
- **À acheter** = (sécurité réserve + sécurité mission + BOM non couvert) − déjà commandé

## Parcours jour J (inventaire → MRP)

1. Coller QR lieux, saisir nomenclatures (quantités)
2. Ranger les QR unités
3. Importer quantités Excel si besoin
4. Ouvrir **Stock → MRP** → créer rappels de commande / doter

## UI

- Accueil Stock : onglet **MRP**
- Lieux → Contenu prévu : quantités BOM
