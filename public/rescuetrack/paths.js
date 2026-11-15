// © 2026 Heart's Angels ASBL & Laurent Noulin — Tous droits réservés.

/** Préfixe d'URL : /rescuetrack sur le site principal, vide sur rescuetrack.heartsangels.be. */
export function prefixeRescuetrack(pathname) {
  if (pathname === '/rescuetrack' || pathname.startsWith('/rescuetrack/')) return '/rescuetrack'
  return ''
}

export function rt(page, pathname = location.pathname) {
  const nom = String(page || '').replace(/^\//, '')
  return `${prefixeRescuetrack(pathname)}/${nom}`
}

export function estPageConnexion(pathname) {
  return pathname === '/'
    || pathname === '/index.html'
    || pathname === '/rescuetrack'
    || pathname === '/rescuetrack/'
    || pathname === '/rescuetrack/index.html'
}

/** N'accepte qu'un chemin interne à RescueTrack, jamais une adresse externe. */
export function apresConnexion(next, pathname) {
  const secours = rt('province.html', pathname)
  if (typeof next !== 'string' || !next.startsWith('/') || next.startsWith('//')) return secours
  const base = prefixeRescuetrack(pathname)
  if (base) return next.startsWith(`${base}/`) ? next : secours
  if (next.startsWith('/rescuetrack')) return secours
  return next
}
