export const TYPES_LIEU = [
  { v:'reserve', l:'Réserve / bureau' },
  { v:'armoire', l:'Armoire' },
  { v:'sac', l:'Sac' },
  { v:'pochette', l:'Pochette' },
  { v:'vehicule', l:'Véhicule / ambulance' },
  { v:'armoire_vehicule', l:'Armoire dans un véhicule' },
  { v:'autre', l:'Autre' },
]
export const lblLieu = v => TYPES_LIEU.find(t => t.v === v)?.l || v

export const MODES = [
  { v:'piece', l:'Pièce (1 QR = 1 article)' },
  { v:'boite', l:'Boîte (QR sur la boîte, compteur)' },
  { v:'oxygene', l:'Bouteille d’oxygène (suivie une à une)' },
  { v:'durable', l:'Durable (mallette, brancard…)' },
]
export const lblMode = v => MODES.find(t => t.v === v)?.l || v

export function nomTypeO2(volumeL) {
  const n = Number(volumeL)
  return Number.isFinite(n) && n > 0 ? `O2 B${n}L` : 'O2'
}

export const VOLUMES_O2 = [
  { v:'2', l:'B2 (2 L)' },
  { v:'5', l:'B5 (5 L)' },
  { v:'10', l:'B10 (10 L)' },
]
export const PRESSION_PLEINE = 200
export const PRESSION_ALERTE = 50

export function capaciteO2(volumeL, bar) {
  const v = Number(volumeL) || 0
  const p = Number(bar) || 0
  return Math.round(v * p)
}

export function resteLabel(u) {
  if (!u) return ''
  if (u.mode === 'oxygene') {
    const bar = u.pression_bar == null ? '—' : Number(u.pression_bar)
    const cap = capaciteO2(u.volume_l, u.pression_bar)
    return `${bar} bar · ${cap} L restants (${Number(u.volume_l) || '?'} L × ${bar === '—' ? '?' : bar})`
  }
  if (u.mode === 'boite') return `${Number(u.qte_restante)} / ${Number(u.qte_initiale)}`
  if (u.mode === 'durable') return 'en place'
  return Number(u.qte_restante) > 0 ? 'disponible' : 'consommé'
}

export function cheminLieux(lieux, id) {
  const byId = Object.fromEntries((lieux || []).map(l => [l.id, l]))
  const parts = []
  let cur = byId[id], guard = 0
  while (cur && guard++ < 12) {
    parts.unshift(cur.nom)
    cur = cur.parent_id ? byId[cur.parent_id] : null
  }
  return parts.join(' › ')
}

export function enfantsDe(lieux, parentId) {
  return (lieux || []).filter(l => (l.parent_id || null) === (parentId || null)).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
}

export const TYPES_MOUVEMENT = [
  { v:'', l:'Tous les mouvements' },
  { v:'entree', l:'Entrée / réception' },
  { v:'sortie', l:'Sortie' },
  { v:'transfert', l:'Transfert' },
  { v:'peremption', l:'Péremption' },
  { v:'usage', l:'Usage (durable)' },
  { v:'emport', l:'Emport mission' },
  { v:'ajustement', l:'Inventaire / correction' },
  { v:'releve_o2', l:'Relevé oxygène' },
]
export const lblMouv = v => TYPES_MOUVEMENT.find(t => t.v === v)?.l || v

export const STATUTS_COMMANDE = [
  { v:'a_commander', l:'À commander' },
  { v:'commandee', l:'Commandée' },
  { v:'recue', l:'Reçue' },
  { v:'annulee', l:'Annulée' },
]
export const lblCommande = v => STATUTS_COMMANDE.find(t => t.v === v)?.l || v

export function couleurMouv(type) {
  if (type === 'entree') return '#3B6D11'
  if (type === 'sortie' || type === 'peremption') return '#A32D2D'
  if (type === 'transfert' || type === 'emport') return '#185FA5'
  if (type === 'ajustement' || type === 'releve_o2') return '#BA7517'
  return 'var(--text-muted)'
}

export function fmtQuand(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('fr-BE', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
}
