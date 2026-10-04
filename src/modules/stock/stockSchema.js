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

export const LIB_MVT = {
  entree: 'Réception',
  sortie: 'Sortie',
  transfert: 'Rangement',
  ajustement: 'Inventaire',
  usage: 'Utilisation',
  emport: 'Emporté',
  releve_o2: 'Relevé O₂',
}

export function idsLieuEtEnfants(lieux, lieuId) {
  const ids = new Set()
  const walk = (id) => {
    if (!id || ids.has(id)) return
    ids.add(id)
    ;(lieux || []).filter(l => l.parent_id === id).forEach(l => walk(l.id))
  }
  walk(lieuId)
  return ids
}

export function profondeurLieu(lieux, id) {
  const byId = Object.fromEntries((lieux || []).map(l => [l.id, l]))
  let n = 0
  let cur = byId[id]
  let guard = 0
  while (cur?.parent_id && guard++ < 12) {
    n++
    cur = byId[cur.parent_id]
  }
  return n
}

/** Quantité visible « en stock », comme la colonne On Hand d’un inventaire. */
export function qteEnStock(cat, unites) {
  const lignes = (unites || []).filter(u => u.catalogue_id === cat.id && u.etat === 'dispo')
  if (cat.mode === 'boite') {
    const pieces = lignes.reduce((s, u) => s + Number(u.qte_restante || 0), 0)
    const boites = lignes.filter(u => Number(u.qte_restante) > 0).length
    return {
      nombre: pieces,
      unite: cat.unite || 'pièces',
      detail: `${boites} boîte${boites > 1 ? 's' : ''}`,
      lignes,
    }
  }
  if (cat.mode === 'oxygene') {
    const basses = lignes.filter(u => Number(u.pression_bar) <= PRESSION_ALERTE).length
    const vol = cat.volume_l ? `${Number(cat.volume_l)} L` : ''
    return {
      nombre: lignes.length,
      unite: lignes.length > 1 ? 'bouteilles' : 'bouteille',
      detail: [vol, basses ? `${basses} ≤ ${PRESSION_ALERTE} bar` : ''].filter(Boolean).join(' · '),
      lignes,
      attention: basses > 0,
    }
  }
  if (cat.mode === 'durable') {
    return { nombre: lignes.length, unite: 'en place', detail: '', lignes }
  }
  const n = lignes.filter(u => Number(u.qte_restante) > 0).length
  return { nombre: n, unite: n > 1 ? 'pièces' : 'pièce', detail: '', lignes }
}

export function niveauStock(cat, qte) {
  if (!qte || qte.nombre <= 0) return 'vide'
  if (cat.mode !== 'oxygene' && cat.mode !== 'durable' && Number(cat.stock_minimal) > 0 && qte.nombre <= Number(cat.stock_minimal)) return 'bas'
  if (qte.attention) return 'attention'
  return 'ok'
}

export function systemeDe(u) {
  if (!u) return 0
  if (u.mode === 'oxygene') return u.pression_bar == null ? 0 : Number(u.pression_bar)
  if (u.mode === 'durable') return 1
  return Number(u.qte_restante || 0)
}

export function uniteComptage(u) {
  if (!u) return ''
  if (u.mode === 'oxygene') return 'bar'
  if (u.mode === 'boite') return u.unite || 'pcs'
  if (u.mode === 'durable') return 'présent'
  return 'pièce'
}
