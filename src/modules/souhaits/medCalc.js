// Calculs de perfusion. 1 ml = 20 gouttes.
//   gouttes/min = ml/h ÷ 3      (ml/h × 20 / 60)
//   ml/h        = gouttes/min × 3
//   durée(min)  = volume ÷ (ml/h) × 60
//   ml/h        = volume × 60 ÷ durée(min)
const n = v => (v === '' || v == null) ? NaN : Number(v)
const r1 = v => Math.round(v * 10) / 10

export function recalcPerfusion(perf, champ) {
  const V = n(perf.volume_ml), ML = n(perf.debit_ml_h), G = n(perf.debit_gttes_min), D = n(perf.duree_min)
  const out = { ...perf }
  if (champ === 'debit_ml_h' && !isNaN(ML)) {
    out.debit_gttes_min = r1(ML / 3)
    if (!isNaN(V) && ML > 0) out.duree_min = Math.round(V / ML * 60)
  } else if (champ === 'debit_gttes_min' && !isNaN(G)) {
    const ml = G * 3; out.debit_ml_h = r1(ml)
    if (!isNaN(V) && ml > 0) out.duree_min = Math.round(V / ml * 60)
  } else if (champ === 'duree_min' && !isNaN(D) && D > 0 && !isNaN(V)) {
    const ml = V * 60 / D; out.debit_ml_h = r1(ml); out.debit_gttes_min = r1(ml / 3)
  } else if (champ === 'volume_ml' && !isNaN(V)) {
    if (!isNaN(ML) && ML > 0) out.duree_min = Math.round(V / ML * 60)
    else if (!isNaN(D) && D > 0) { const ml = V * 60 / D; out.debit_ml_h = r1(ml); out.debit_gttes_min = r1(ml / 3) }
  }
  return out
}

// Libellé court du débit pour affichage
export function debitLabel(med) {
  const p = med.perfusion || {}
  const parts = []
  if (p.debit_ml_h) parts.push(`${p.debit_ml_h} ml/h`)
  if (p.debit_gttes_min) parts.push(`${p.debit_gttes_min} gttes/min`)
  return parts.join(' · ')
}

// Heures « dues » d'un médicament (libellés HH:00 ou heure programmée)
export function heuresDues(med) {
  if (med.type_admin === 'si_necessaire') return []
  const hs = Array.isArray(med.horaires) ? med.horaires : []
  return hs.map(h => String(h).trim()).filter(Boolean).sort()
}

export const LIQUIDES = ['', 'Glucosé 5%', 'Glucosé 10%', 'NaCl 0,9%', 'Ringer lactate', 'Hartmann', 'Eau PPI', 'Autre']
