const MS = 86400000

export function iso(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseISO(s) {
  if (!s) return null
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

export function addDays(d, n) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  x.setDate(x.getDate() + n)
  return x
}

export function startOfWeek(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const dow = (x.getDay() + 6) % 7
  x.setDate(x.getDate() - dow)
  return x
}

export function daysInclusive(a, b) {
  const da = typeof a === 'string' ? parseISO(a) : a
  const db = typeof b === 'string' ? parseISO(b) : b
  if (!da || !db) return 1
  return Math.round((db - da) / MS) + 1
}

export function todayISO() { return iso(new Date()) }

export const JOURS = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.']
export const JOURS_LONG = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']

export function titreMois(d) {
  const t = d.toLocaleDateString('fr-BE', { month: 'long', year: 'numeric' })
  return t.charAt(0).toUpperCase() + t.slice(1)
}

export function titreSemaine(d) {
  const a = startOfWeek(d)
  const b = addDays(a, 6)
  const opts = { day: 'numeric', month: 'short' }
  return `${a.toLocaleDateString('fr-BE', opts)} → ${b.toLocaleDateString('fr-BE', { ...opts, year: 'numeric' })}`
}

export function grilleMois(anchor) {
  const first = startOfWeek(new Date(anchor.getFullYear(), anchor.getMonth(), 1))
  const lastMonth = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)
  const last = addDays(startOfWeek(lastMonth), 6)
  const weeks = []
  for (let x = new Date(first); x <= last; x = addDays(x, 7)) weeks.push(new Date(x))
  return { debut: iso(first), fin: iso(last), weeks }
}

export function grilleSemaine(anchor) {
  const a = startOfWeek(anchor)
  return { debut: iso(a), fin: iso(addDays(a, 6)), weeks: [a] }
}

export function packLanes(events, weekStart) {
  const weekEnd = addDays(weekStart, 6)
  const items = []
  for (const e of events) {
    const s = parseISO(e.date_debut)
    const f = parseISO(e.date_fin || e.date_debut)
    if (!s || !f) continue
    if (f < weekStart || s > weekEnd) continue
    const clipS = s < weekStart ? weekStart : s
    const clipE = f > weekEnd ? weekEnd : f
    const col = Math.round((clipS - weekStart) / MS)
    const span = Math.round((clipE - clipS) / MS) + 1
    const total = daysInclusive(e.date_debut, e.date_fin || e.date_debut)
    const j0 = daysInclusive(e.date_debut, iso(clipS))
    const j1 = daysInclusive(e.date_debut, iso(clipE))
    items.push({ ev: e, col, span, total, j0, j1 })
  }
  items.sort((a, b) => a.col - b.col || b.span - a.span)
  const lanes = []
  for (const it of items) {
    let lane = lanes.find(l => l.every(x => it.col >= x.col + x.span || it.col + it.span <= x.col))
    if (!lane) { lane = []; lanes.push(lane) }
    lane.push(it)
  }
  return lanes
}

export function hhmm(t) {
  if (!t) return ''
  const s = String(t)
  if (s.includes('T')) return s.split('T')[1].slice(0, 5)
  return s.slice(0, 5)
}

/** Minutes depuis minuit (accepte « 08:30 » ou un datetime ISO). */
export function minutesOf(t) {
  const s = hhmm(t)
  if (!s) return null
  const [h, m] = s.split(':').map(Number)
  if (Number.isNaN(h)) return null
  return h * 60 + (m || 0)
}

export function jourDe(t, fallback) {
  if (!t) return fallback || null
  const s = String(t)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  return fallback || null
}

/** Créneau sur la grille : RDV base → cette heure jusqu’à 24 h. */
export function creneauMission(m, dayIso) {
  if (!m) return null
  if (m.rdv_base) {
    const jour = jourDe(m.rdv_base, m.date_debut)
    if (jour && dayIso !== jour) return null
    const start = minutesOf(m.rdv_base) ?? 0
    return { start, end: 24 * 60 }
  }
  if (m.courte_duree && (hhmm(m.heure_debut) || hhmm(m.heure_fin))) {
    const f = m.date_fin || m.date_debut
    if (m.date_debut && dayIso && (dayIso < m.date_debut || dayIso > f)) return null
    const start = minutesOf(m.heure_debut) ?? 0
    let end = minutesOf(m.heure_fin)
    if (end == null || end <= start) end = 24 * 60
    return { start, end }
  }
  return null
}

export function estHoraire(m) {
  return !!(m?.rdv_base || (m?.courte_duree && (hhmm(m.heure_debut) || hhmm(m.heure_fin))))
}

/** Grille semaine : toujours 00 h → 24 h. */
export const H_CAL_DEBUT = 0
export const H_CAL_FIN = 24
export const PX_HEURE = 48

export function plageCalendrier() {
  return { h0: H_CAL_DEBUT, h1: H_CAL_FIN }
}

/** Colonnes d’overlap pour les missions horaires d’un jour. */
export function packTimedDay(events, dayIso) {
  const list = (events || [])
    .map(m => {
      const c = creneauMission(m, dayIso)
      if (!c) return null
      return { ev: m, start: c.start, end: c.end }
    })
    .filter(Boolean)
    .sort((a, b) => a.start - b.start || a.end - b.end)
  const colEnd = []
  for (const it of list) {
    let c = colEnd.findIndex(t => t <= it.start)
    if (c < 0) { c = colEnd.length; colEnd.push(it.end) }
    else colEnd[c] = it.end
    it.col = c
  }
  const n = Math.max(1, colEnd.length)
  return list.map(it => ({ ...it, cols: n }))
}
