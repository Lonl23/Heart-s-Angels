export const STATUTS = {
  nouveau:               { l:'Nouveau',                        c:'#7A5AF8', bg:'#EEE9FE' },
  en_attente:            { l:'En attente',                     c:'#BA7517', bg:'#FAEEDA' },
  pret:                  { l:'Prêt à réaliser',                c:'#185FA5', bg:'#E6F1FB' },
  en_cours:              { l:'En cours',                       c:'#1BB0CE', bg:'#E6F7FA' },
  terminee_terrain:      { l:'Terminée terrain',               c:'#0F6E56', bg:'#E1F5EE' },
  realise:               { l:'Réalisé',                        c:'#3B6D11', bg:'#EAF3DE' },
  demande_info_externe:  { l:'En attente d\'informations',     c:'#3D5A80', bg:'#E8EEF5' },
  non_realise:           { l:'Non réalisé',                    c:'#A32D2D', bg:'#FCEBEB' },
}
export const PIPELINE = ['nouveau','en_attente','pret','en_cours','terminee_terrain','realise']
/** Colonnes du tableau : pipeline + attente d’informations + non réalisé. */
export const KANBAN_COLONNES = ['nouveau','en_attente','pret','en_cours','terminee_terrain','realise','non_realise','demande_info_externe']
export const PIPELINE_ENCODE = ['nouveau','en_attente','pret']
export const ATTENTE_RAISONS = [
  { v:'rencontre',    l:'Rencontre bénéficiaire' },
  { v:'informations', l:'Informations' },
  { v:'logistique',   l:'Logistique / véhicule' },
  { v:'equipage',     l:'Équipage à prévoir' },
]
export const DEMANDE_STATUTS = {
  nouvelle: { l:'Reçue' },
  en_cours: { l:'En cours' },
  acceptee: { l:'Acceptée' },
  refusee:  { l:'Non retenue' },
  realisee: { l:'Réalisée' },
}
export const stInfo = v => STATUTS[v] || STATUTS.en_attente

export const MOTIF_DEMO_NON_REALISE = 'Formation (souhait test)'

/** Souhait de formation fictif (Camille TEST-Angel, demo_cle), jamais un vrai patient. */
export function estSouhaitDemo(s) {
  return !!(s?.fictif && (s?.mission?.demo_cle || s?.demo_cle))
}

export function statutFige(statut, souhait) {
  if (estSouhaitDemo(souhait)) return false
  return statut === 'realise' || statut === 'non_realise'
}

export function libelleStatutFige(statut) {
  if (statut === 'non_realise') {
    return 'Un souhait non réalisé est verrouillé : il ne peut plus être préparé ni changer de statut.'
  }
  return 'Un souhait réalisé ne peut plus changer de statut.'
}

export function peutPasserNonRealise(statut, souhait) {
  if (estSouhaitDemo(souhait)) return true
  return !['en_cours', 'terminee_terrain', 'realise'].includes(statut)
}

export function peutChangerStatut(actuel, cible, souhait) {
  if (!cible || actuel === cible) return false
  if (statutFige(actuel, souhait)) return false
  if (cible === 'non_realise' && !peutPasserNonRealise(actuel, souhait)) return false
  return true
}

export function statutsDisponibles(actuel, souhait) {
  if (estSouhaitDemo(souhait)) return Object.keys(STATUTS)
  return Object.keys(STATUTS).filter(k => k !== 'non_realise' || k === actuel || peutPasserNonRealise(actuel, souhait))
}
