export const DUREE_FONDU_MS = 450

export function motionReduite() {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function mondeEcran(path) {
  const p = String(path || '')
  if (p.startsWith('/app')) return 'app'
  if (p.startsWith('/partenaire')) return 'partenaire'
  return 'public'
}

/** Clé stable dans l’espace interne (le menu ne doit pas se remonter). */
export function cleCouche(loc) {
  const m = mondeEcran(loc?.pathname)
  if (m === 'app' || m === 'partenaire') return 'monde-' + m
  return loc?.key || 'public'
}
