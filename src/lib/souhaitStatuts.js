// src/lib/souhaitStatuts.js
// Pipeline officiel du cycle de vie d'un souhait (ordre = déroulé du processus)

export const STATUTS_SOUHAIT = [
  { key:'nouveau',           label:'Nouveau',            court:'Nouveau',     color:'#185FA5', bg:'#E6F1FB', desc:'Identité du bénéficiaire et du demandeur, première idée du souhait.' },
  { key:'attente_rencontre', label:'En attente',         court:'Attente',     color:'#BA7517', bg:'#FAEEDA', desc:'Contacter le demandeur pour organiser une date de rencontre.' },
  { key:'rencontre',         label:'Rencontre',          court:'Rencontre',   color:'#7A3FA0', bg:'#F1E7F7', desc:'Récupération des informations auprès du bénéficiaire et du demandeur.' },
  { key:'attente_dates',     label:'Dates à définir',    court:'Dates',       color:'#BA7517', bg:'#FAEEDA', desc:'Dates possibles de réalisation — surbrillance dans le calendrier des disponibilités.' },
  { key:'equipage',          label:'Équipage à prévoir', court:'Équipage',    color:'#0E7A93', bg:'#E6F7FA', desc:'Affectation de l’équipage (coordinateur transports / logistique).' },
  { key:'logistique',        label:'Logistique',         court:'Logistique',  color:'#0E7A93', bg:'#E6F7FA', desc:'Ambulance, matériel et véhicules nécessaires.' },
  { key:'pret',              label:'Prêt à réaliser',    court:'Prêt',        color:'#3B6D11', bg:'#EAF3DE', desc:'Tout est en place, le souhait peut être réalisé.' },
  { key:'en_cours',          label:'En cours',           court:'En cours',    color:'#C8435A', bg:'#FBEAF0', desc:'Jour du souhait — checklists disponibles pour l’équipage.' },
  { key:'realise',           label:'Réalisé',            court:'Réalisé',     color:'#3B6D11', bg:'#EAF3DE', desc:'Souhait réalisé (comptabilisé).' },
  { key:'non_realise',       label:'Non réalisé',        court:'Non réalisé', color:'#7A7470', bg:'#F0EFED', desc:'Souhait non réalisé — justification et comptabilisation.' },
  // Hors flux linéaire
  { key:'renseignements',    label:'Demande de renseignements', court:'Renseign.', color:'#185FA5', bg:'#E6F1FB', desc:'Demande de renseignements complémentaires.' },
]

// Map clé → objet
export const STATUT_MAP = Object.fromEntries(STATUTS_SOUHAIT.map(s => [s.key, s]))

// Étapes linéaires (sans renseignements) pour le stepper
export const STATUTS_FLUX = STATUTS_SOUHAIT.filter(s => s.key !== 'renseignements')

// Phases gérées par le récolteur de souhaits (avant la réalisation/affectation)
export const PHASES_RECOLTEUR = ['nouveau','attente_rencontre','rencontre','attente_dates']

// Phases où un volontaire médical AFFECTÉ voit le souhait
export const PHASES_AFFECTE = ['equipage','logistique','pret','en_cours']

// Phases d'archive
export const PHASES_ARCHIVE = ['realise','non_realise']

// Phase déclenchant la surbrillance "dates possibles" dans le calendrier des dispos
export const PHASE_PLANNING = 'attente_dates'

export function statutInfo(key) {
  return STATUT_MAP[key] || { key, label: key, court: key, color:'#7A7470', bg:'#F0EFED' }
}