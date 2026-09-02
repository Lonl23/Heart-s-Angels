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

export const VOLUMES_O2 = [
  { v:'2', l:'2 L' },
  { v:'5', l:'5 L' },
  { v:'10', l:'10 L' },
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
