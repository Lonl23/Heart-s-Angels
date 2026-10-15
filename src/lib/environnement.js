/** Adresses officielles de l’application (cPanel EX2, dossiers dédiés). */
export const HOST_APP_PROD = 'app.heartsangels.be'
export const HOST_APP_BETA = 'appbetaapp.heartsangels.be'
export const URL_APP_PROD = 'https://app.heartsangels.be'
export const URL_APP_BETA = 'https://appbetaapp.heartsangels.be'

/** Repli Firebase tant que les sous-domaines cPanel ne sont pas en ligne. */
export const URL_FIREBASE_LIVE = 'https://heart-s-angels.web.app'

/** Hôtes considérés comme la production (pas de pastille Bêta). */
const HOSTS_PROD = new Set([
  HOST_APP_PROD,
  'heart-s-angels.web.app',
  'heart-s-angels.firebaseapp.com',
  'www.heartsangels.be',
  'heartsangels.be',
])

export function estCanalFirebaseBeta(hostname) {
  const h = String(hostname || '').toLowerCase()
  return h.includes('heart-s-angels--beta')
}

/**
 * Origine https autorisée pour liens d’invitation / redirections.
 * Prod, bêta cPanel, canal Firebase `beta`, et localhost.
 */
export function origineAutorisee(origine) {
  const raw = String(origine || '').trim().replace(/\/$/, '')
  if (!raw) return ''
  let u
  try { u = new URL(raw) } catch { return '' }
  const h = u.hostname.toLowerCase()
  const local = h === 'localhost' || h === '127.0.0.1'
  if (local && (u.protocol === 'http:' || u.protocol === 'https:')) return raw
  if (u.protocol !== 'https:') return ''
  if (h === HOST_APP_PROD || h === HOST_APP_BETA) return `${u.protocol}//${h}`
  if (h === 'heart-s-angels.web.app' || h === 'heart-s-angels.firebaseapp.com') return `${u.protocol}//${h}`
  if (estCanalFirebaseBeta(h) && h.endsWith('.web.app')) return `${u.protocol}//${h}`
  return ''
}

/** Pastille Bêta : `appbetaapp.heartsangels.be`, canal Firebase `beta`, localhost. Prod = `app.heartsangels.be`. */
export function afficherBadgeBeta(hostname) {
  const raw = hostname ?? (typeof window !== 'undefined' ? window.location.hostname : '')
  const h = String(raw || '').toLowerCase()
  if (!h) return false
  if (h === HOST_APP_BETA || estCanalFirebaseBeta(h)) return true
  if (HOSTS_PROD.has(h)) return false
  return true
}
