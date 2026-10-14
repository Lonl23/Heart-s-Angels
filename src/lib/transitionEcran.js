export const DUREE_FONDU_MS = 340

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
