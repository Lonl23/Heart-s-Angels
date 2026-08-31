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
  return String(t).slice(0, 5)
}
