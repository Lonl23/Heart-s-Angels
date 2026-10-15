/** Hôtes considérés comme la production (pas de pastille Bêta). */
const HOSTS_PROD = new Set([
  'heart-s-angels.web.app',
  'heart-s-angels.firebaseapp.com',
  'www.heartsangels.be',
  'heartsangels.be',
  'app.heartsangels.be',
])

/** Pastille Bêta : tout sauf la prod. Le canal Firebase `beta` et localhost sont inclus. */
export function afficherBadgeBeta() {
  if (typeof window === 'undefined') return false
  const h = String(window.location.hostname || '')
  if (HOSTS_PROD.has(h)) return false
  return true
}
