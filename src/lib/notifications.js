export const TYPES_NOTIF = [
  { v: 'assignation_souhait', l: 'Affectation à un souhait', icon: '🚑' },
  { v: 'rappel_mission', l: 'Rappel la veille de ma mission', icon: '🌅' },
  { v: 'changement_souhait', l: 'Changement de date, d’heure ou de lieu', icon: '🔄' },
  { v: 'liberation_souhait', l: 'Souhait annulé ou non réalisé', icon: '↩️' },
  { v: 'helpdesk_reponse', l: 'Réponse du helpdesk', icon: '💬' },
  { v: 'echeance_perso', l: 'Ma sélection médicale arrive à échéance', icon: '🪪' },
  { v: 'souhait_agenda', l: 'Nouveau souhait à l’agenda', icon: '📅' },
  { v: 'demande_souhait', l: 'Nouvelle demande de souhait', icon: '⭐' },
  { v: 'equipage_incomplet', l: 'Équipage incomplet', icon: '👥' },
  { v: 'rapport_materiel', l: 'Rapport d’utilisation de matériel', icon: '📦' },
  { v: 'peremption_stock', l: 'Alertes de péremption', icon: '⏰' },
  { v: 'stock_bas', l: 'Stock sous le seuil', icon: '📉' },
  { v: 'oxygene_basse', l: 'Oxygène bas', icon: '🫁' },
  { v: 'entretien_materiel', l: 'Entretien de matériel', icon: '🔧' },
  { v: 'commande_rappel', l: 'Commande à relancer', icon: '🛒' },
  { v: 'ticket_plein', l: 'Ticket de plein du matin', icon: '⛽' },
  { v: 'protocole_detresse', l: 'Protocole de détresse', icon: '🚨' },
  { v: 'helpdesk_nouveau', l: 'Nouveau bug ou suggestion', icon: '🛠️' },
  { v: 'dispo_retiree', l: 'Disponibilité retirée', icon: '📆' },
  { v: 'echeance_staff', l: 'Sélection médicale d’un volontaire', icon: '📋' },
]

export const PREFS_VIDES = Object.fromEntries(TYPES_NOTIF.map(t => [t.v, true]))

export function lblTypeNotif(v) {
  return TYPES_NOTIF.find(t => t.v === v)?.l || v
}

export function iconTypeNotif(v) {
  return TYPES_NOTIF.find(t => t.v === v)?.icon || '🔔'
}

export function prefsDepuisFiche(fiche) {
  const p = fiche?.notif_prefs && typeof fiche.notif_prefs === 'object' ? fiche.notif_prefs : {}
  const out = { ...PREFS_VIDES }
  for (const t of TYPES_NOTIF) {
    if (typeof p[t.v] === 'boolean') out[t.v] = p[t.v]
  }
  return out
}

export function estPiloteNotifications(profile) {
  if (!profile || profile.role === 'partenaire') return false
  if (profile.role === 'admin' || profile.role === 'president') return true
  const roles = profile.fiche?.roles_asbl || []
  return roles.includes('president') || roles.includes('resp_informatique')
}
