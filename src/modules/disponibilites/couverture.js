import { couvertureMission, qualsImplicites } from '@/modules/fiche/ficheSchema'
import { missionsConcurrentes, dispoChevaucheMission } from './dates'

function rowKey(m) {
  return `${m.souhait_id}|${m.date_debut}|${m.date_fin || m.date_debut}`
}

function dureeJours(m) {
  const a = String(m.date_debut || '').slice(0, 10)
  const b = String(m.date_fin || m.date_debut || '').slice(0, 10)
  if (!a || !b) return 1
  return Math.max(1, Math.round((Date.parse(b + 'T12:00:00') - Date.parse(a + 'T12:00:00')) / 86400000) + 1)
}

/**
 * Une personne disponible (ou déjà affectée) ne peut couvrir qu’un souhait à la fois
 * quand deux missions se chevauchent. Les autres dates possibles d’un même souhait
 * ne se volent pas l’équipage (ce sont des options, pas deux missions).
 */
export function allouerCouverturesCalendrier(rows, missionsById, persBy, dispos) {
  const occupations = []
  for (const m of rows || []) {
    for (const e of persBy[m.souhait_id] || []) {
      if (e.user_id) occupations.push({ user_id: e.user_id, souhait_id: m.souhait_id, ...m })
    }
  }

  const sorted = [...(rows || [])].sort((a, b) =>
    String(a.date_debut).localeCompare(String(b.date_debut))
    || dureeJours(b) - dureeJours(a)
    || String(a.lieu || a.activite || '').localeCompare(String(b.lieu || b.activite || ''), 'fr')
    || String(a.souhait_id).localeCompare(String(b.souhait_id))
  )

  const covByRow = new Map()
  for (const m of sorted) {
    const seenExtra = new Set()
    const extras = []
    for (const d of dispos || []) {
      if (!d.user_id || seenExtra.has(d.user_id)) continue
      if (!dispoChevaucheMission(d, m)) continue
      const prisAilleurs = occupations.some(o =>
        o.user_id === d.user_id
        && o.souhait_id !== m.souhait_id
        && missionsConcurrentes(o, m)
      )
      if (prisAilleurs) continue
      seenExtra.add(d.user_id)
      extras.push({
        user_id: d.user_id,
        quals: qualsImplicites(d.profiles?.role, d.profiles?.fiche),
      })
    }
    const cov = couvertureMission(missionsById[m.souhait_id] || {}, persBy[m.souhait_id] || [], extras)
    covByRow.set(rowKey(m), cov)
    for (const uid of cov.utilises || []) {
      if ((persBy[m.souhait_id] || []).some(e => e.user_id === uid)) continue
      occupations.push({ user_id: uid, souhait_id: m.souhait_id, ...m })
    }
  }
  return covByRow
}

export { rowKey as cleCouvertureCalendrier }
