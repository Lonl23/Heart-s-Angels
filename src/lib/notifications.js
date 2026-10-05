export const TYPES_NOTIF = [
  { v: 'assignation_souhait', l: 'Affectation à un souhait', icon: '🚑' },
  { v: 'souhait_agenda', l: 'Nouveau souhait à l’agenda', icon: '📅' },
  { v: 'demande_souhait', l: 'Nouvelle demande de souhait', icon: '⭐' },
  { v: 'rapport_materiel', l: 'Rapport d’utilisation de matériel', icon: '📦' },
  { v: 'peremption_stock', l: 'Alertes de péremption', icon: '⏰' },
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
