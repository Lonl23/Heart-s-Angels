import { couvertureMission, qualsImplicites } from '@/modules/fiche/ficheSchema'
import { missionsConcurrentes, personneCouvreTouteLaMission } from './dates'

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
 * Une personne disponible ne compte que si elle est là TOUS les jours du séjour,
 * et ne peut couvrir qu’un souhait à la fois quand deux missions se chevauchent.
 * Les autres dates possibles d’un même souhait ne se volent pas l’équipage.
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

  const disposParPersonne = new Map()
  for (const d of dispos || []) {
    if (!d.user_id) continue
    const list = disposParPersonne.get(d.user_id) || []
    list.push(d)
    disposParPersonne.set(d.user_id, list)
  }

  const covByRow = new Map()
  for (const m of sorted) {
    const extras = []
    for (const [uid, ds] of disposParPersonne) {
      if (!personneCouvreTouteLaMission(ds, m)) continue
      const prisAilleurs = occupations.some(o =>
        o.user_id === uid
        && o.souhait_id !== m.souhait_id
        && missionsConcurrentes(o, m)
      )
      if (prisAilleurs) continue
      const profil = ds.find(x => x.profiles)?.profiles
      extras.push({
        user_id: uid,
        quals: qualsImplicites(profil?.role, profil?.fiche),
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
