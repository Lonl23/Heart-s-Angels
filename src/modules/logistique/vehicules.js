export const CATEGORIES = [
  { v: 'hygiene', l: 'Hygiène' },
  { v: 'materiel', l: 'Matériel' },
  { v: 'mecanique', l: 'Mécanique' },
]

export function compteOuverts(constats) {
  const n = { hygiene: 0, materiel: 0, mecanique: 0 }
  for (const c of constats || []) {
    if (c?.ouvert && n[c.categorie] != null) n[c.categorie] += 1
  }
  return n
}

export function totalOuverts(n) {
  return (n?.hygiene || 0) + (n?.materiel || 0) + (n?.mecanique || 0)
}

export function nomPersonne(p) {
  const nom = [p?.prenom, p?.nom].filter(Boolean).join(' ')
  return nom || 'Équipage'
}

export function quand(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('fr-BE', {
    timeZone: 'Europe/Brussels',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function plaqueEgale(a, b) {
  return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase()
}

/** ILIKE sans joker : égalité, quelle que soit la casse. */
export function plaquePourFiltre(plaque) {
  return String(plaque || '').trim().replace(/[%_\\]/g, '')
}

export function kmOuNull(v) {
  if (v === '' || v == null) return null
  const n = Number(v)
  if (!Number.isInteger(n) || n < 0 || n > 9999999) return undefined
  return n
}
