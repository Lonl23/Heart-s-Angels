/** Stupéfiants courants (liste pop-up + ajout libre). */
export const STUPS_COURANTS = [
  { produit: 'Morphine', dosage: '10 mg / 1 ml' },
  { produit: 'Fentanyl', dosage: '50 µg / 1 ml' },
  { produit: 'Midazolam', dosage: '5 mg / 1 ml' },
  { produit: 'Kétamine', dosage: '50 mg / 1 ml' },
  { produit: 'Sufentanil', dosage: '5 µg / 1 ml' },
  { produit: 'Pethidine', dosage: '50 mg / 1 ml' },
  { produit: 'Clonazepam', dosage: '1 mg / 1 ml' },
]

function nid() {
  return (crypto.randomUUID && crypto.randomUUID()) || ('st-' + Math.random().toString(36).slice(2, 10))
}

export function stupefiantsVides() {
  return { lignes: [], remise: null, retour: null }
}

/** Accepte la mission complète (`mission.stupefiants`) ou déjà le bloc stups. */
export function stupefiantsMission(missionOuBloc) {
  if (!missionOuBloc || typeof missionOuBloc !== 'object') return stupefiantsVides()
  const s = Array.isArray(missionOuBloc.lignes) || missionOuBloc.remise || missionOuBloc.retour
    ? missionOuBloc
    : missionOuBloc.stupefiants
  if (!s || typeof s !== 'object') return stupefiantsVides()
  return {
    lignes: Array.isArray(s.lignes) ? s.lignes : [],
    remise: s.remise && typeof s.remise === 'object' ? s.remise : null,
    retour: s.retour && typeof s.retour === 'object' ? s.retour : null,
  }
}

export function nouvelleLigneStup(partial = {}) {
  return {
    id: nid(),
    produit: '',
    dosage: '',
    lot: '',
    dlc: '',
    qte_remise: 0,
    qte_retour: 0,
    usages: [],
    ...partial,
  }
}

export function nouvelUsageStup(partial = {}) {
  const now = new Date()
  const hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  return {
    id: nid(),
    dose: '',
    heure: hm,
    notes: '',
    ...partial,
  }
}

export function qteUtiliseeLigne(ligne) {
  const n = Number(ligne?.qte_utilisee)
  if (Number.isFinite(n) && n >= 0) return n
  return (ligne?.usages || []).length
}

export function bilanLigne(ligne) {
  const remise = Number(ligne?.qte_remise) || 0
  const utilisee = qteUtiliseeLigne(ligne)
  const retour = Number(ligne?.qte_retour)
  const retourVal = Number.isFinite(retour) ? retour : Math.max(0, remise - utilisee)
  return { remise, utilisee, retour: retourVal, ecart: remise - utilisee - retourVal }
}

export function remiseCompletee(stups) {
  const s = stupefiantsMission(stups)
  const r = s.remise
  if (!r) return false
  return !!(r.signature_remettant && r.signature_receveur && (s.lignes || []).length)
}

export function retourComplete(stups) {
  const s = stupefiantsMission(stups)
  const r = s.retour
  if (!r) return false
  return !!(r.signature_remettant && r.signature_receveur)
}
