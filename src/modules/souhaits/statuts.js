export const STATUTS = {
  nouveau:     { l:'Nouveau',        c:'#7A5AF8', bg:'#EEE9FE' },
  en_attente:  { l:'En attente',     c:'#BA7517', bg:'#FAEEDA' },
  pret:        { l:'Prêt à réaliser',c:'#185FA5', bg:'#E6F1FB' },
  en_cours:    { l:'En cours',       c:'#1BB0CE', bg:'#E6F7FA' },
  realise:     { l:'Réalisé',        c:'#3B6D11', bg:'#EAF3DE' },
  non_realise: { l:'Non réalisé',    c:'#A32D2D', bg:'#FCEBEB' },
}
export const PIPELINE = ['nouveau','en_attente','pret','en_cours','realise']
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

export function statutFige(statut) {
  return statut === 'realise'
}

export function peutPasserNonRealise(statut) {
  return !['en_cours', 'realise'].includes(statut)
}

export function peutChangerStatut(actuel, cible) {
  if (!cible || actuel === cible) return false
  if (statutFige(actuel)) return false
  if (cible === 'non_realise' && !peutPasserNonRealise(actuel)) return false
  return true
}

export function statutsDisponibles(actuel) {
  return Object.keys(STATUTS).filter(k => k !== 'non_realise' || k === actuel || peutPasserNonRealise(actuel))
}
