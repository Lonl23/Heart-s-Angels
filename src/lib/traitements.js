// src/lib/traitements.js
export const VOIES = [
  ['PO','PO (per os)'], ['SL','Sublingual'], ['IV','IV'], ['SC','SC'], ['IM','IM'],
  ['inhalation','Inhalation'], ['patch','Patch'], ['locale','Voie locale'], ['autre','Autre'],
]
export const VOIE_LABEL = Object.fromEntries(VOIES.map(([k,l])=>[k,l]))

// Normalise un traitement (compat ancien format string)
export function normTrait(t, i) {
  if (typeof t === 'string') return { id:'t'+i, nom:t, posologie:'', voie:'PO', type:'office', horaires:[], condition:'' }
  return { id:t.id||('t'+i), nom:t.nom||'', posologie:t.posologie||'', voie:t.voie||'PO', type:t.type||'office', horaires:t.horaires||[], condition:t.condition||'' }
}

// Liste des jours d'un souhait (date_souhait → date_fin si multi-jours)
export function joursSouhait(s) {
  const debut = s.date_souhait ? String(s.date_souhait).slice(0,10) : null
  if (!debut) return []
  const fin = (s.sur_plusieurs_jours && s.date_fin) ? String(s.date_fin).slice(0,10) : debut
  const out = []; const d = new Date(debut); const end = new Date(fin)
  let guard = 0
  while (d <= end && guard < 60) { out.push(d.toISOString().slice(0,10)); d.setDate(d.getDate()+1); guard++ }
  return out
}