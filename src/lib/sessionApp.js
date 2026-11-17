/** Fenêtre d’inactivité avant de redemander mot de passe + 2FA. */
export const DUREE_CONFIANCE_MS = 48 * 60 * 60 * 1000

const CLE_ACCES = 'ha_dernier_acces'
const CLE_UID = 'ha_confiance_uid'

/** Déverrouillage de cette ouverture d’app (perdu au rechargement). */
let deverrouilleMemoire = false

function lireStockage(cle) {
  try { return localStorage.getItem(cle) || '' } catch { return '' }
}
function ecrireStockage(cle, val) {
  try {
    if (val == null || val === '') localStorage.removeItem(cle)
    else localStorage.setItem(cle, String(val))
  } catch { /* navigation privée */ }
}

export function derniereActivite() {
  const n = Number(lireStockage(CLE_ACCES) || 0)
  return Number.isFinite(n) ? n : 0
}

/** True si la dernière utilisation date de moins de 48 h. */
export function activiteFraiche(uid) {
  const t = derniereActivite()
  if (!t || Date.now() - t >= DUREE_CONFIANCE_MS) return false
  if (uid) {
    const stocke = lireStockage(CLE_UID)
    if (stocke && stocke !== uid) return false
  }
  return true
}

export function toucherActivite(uid) {
  ecrireStockage(CLE_ACCES, Date.now())
  if (uid) ecrireStockage(CLE_UID, uid)
}

/** Après mot de passe + 2FA, ou biométrie de reprise. */
export function poserConfiance(uid) {
  toucherActivite(uid)
  deverrouilleMemoire = true
}

export function effacerConfiance() {
  ecrireStockage(CLE_ACCES, '')
  ecrireStockage(CLE_UID, '')
  deverrouilleMemoire = false
}

export function estDeverrouilleMemoire() {
  return deverrouilleMemoire
}

export function marquerDeverrouilleMemoire() {
  deverrouilleMemoire = true
}

/**
 * Doit-on afficher le déverrouillage biométrique à cette ouverture ?
 * — confiance < 48 h + biométrie enregistrée et dispo + pas encore déverrouillé.
 */
export function doitDeverrouillerBio({ webauthnActif, bioDispo }) {
  return !!webauthnActif && !!bioDispo && !deverrouilleMemoire
}
