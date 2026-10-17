import { TRANCHES_AGE, ageEnAnnees, libelleTranche } from '../souhaits/fenetreMission.js'

export const GRAINS = [
  { v: 'mois', l: 'Mois' },
  { v: 'trimestre', l: 'Trimestre' },
  { v: 'semestre', l: 'Semestre' },
  { v: 'annee', l: 'Année' },
]

export function anneesDisponibles(lignes, aujourdHui = new Date()) {
  const set = new Set([aujourdHui.getFullYear()])
  for (const l of lignes || []) {
    const y = anneeDe(l.jour)
    if (y) set.add(y)
  }
  return [...set].sort((a, b) => b - a)
}

function anneeDe(jour) {
  const s = String(jour || '').slice(0, 4)
  const n = Number(s)
  return Number.isFinite(n) && n > 1900 ? n : null
}

function moisDe(jour) {
  const n = Number(String(jour || '').slice(5, 7))
  return n >= 1 && n <= 12 ? n : null
}

export function dansPeriode(jour, { grain, annee, mois }) {
  const y = anneeDe(jour)
  const m = moisDe(jour)
  if (!y || !m) return false
  if (y !== Number(annee)) return false
  if (grain === 'annee') return true
  if (grain === 'semestre') return mois <= 6 ? m <= 6 : m >= 7
  if (grain === 'trimestre') {
    const q = Math.floor((m - 1) / 3)
    const qChoisi = Math.floor((Number(mois) - 1) / 3)
    return q === qChoisi
  }
  return m === Number(mois)
}

export function libellePeriode({ grain, annee, mois }) {
  const m = Number(mois)
  if (grain === 'annee') return String(annee)
  if (grain === 'semestre') return `${m <= 6 ? '1er' : '2e'} semestre ${annee}`
  if (grain === 'trimestre') return `T${Math.floor((m - 1) / 3) + 1} ${annee}`
  return new Date(annee, m - 1, 1).toLocaleDateString('fr-BE', { month: 'long', year: 'numeric' })
}

function commeListe(v) {
  if (Array.isArray(v)) return v.map(x => String(x || '').trim()).filter(Boolean)
  return []
}

export function preparerLigne(l) {
  const jour = String(l.jour || '').slice(0, 10)
  const age = ageEnAnnees(l.ddn, jour || l.jour)
  return {
    ...l,
    jour,
    annee: anneeDe(jour),
    km: Number(l.km) || 0,
    activites: commeListe(l.activites),
    pathologies: commeListe(l.pathologies),
    lieu: String(l.lieu || '').trim() || 'Non renseigné',
    genre: l.genre === 'homme' ? 'Homme' : l.genre === 'femme' ? 'Femme' : 'Non renseigné',
    institution: String(l.institution || '').trim() || 'Sans institution',
    service: String(l.service || '').trim() || 'Service non renseigné',
    tranche: libelleTranche(age),
    volontaires: Array.isArray(l.volontaires) ? l.volontaires : [],
  }
}

export function compter(lignes, cle) {
  const map = new Map()
  for (const l of lignes) {
    const valeurs = Array.isArray(l[cle]) ? (l[cle].length ? l[cle] : ['Non renseigné']) : [l[cle] || 'Non renseigné']
    for (const v of valeurs) {
      map.set(v, (map.get(v) || 0) + 1)
    }
  }
  return [...map.entries()]
    .map(([label, n]) => ({ label, n }))
    .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label, 'fr'))
}

export function parInstitution(lignes) {
  const map = new Map()
  for (const l of lignes) {
    if (!map.has(l.institution)) map.set(l.institution, new Map())
    const services = map.get(l.institution)
    services.set(l.service, (services.get(l.service) || 0) + 1)
  }
  return [...map.entries()]
    .map(([institution, services]) => ({
      institution,
      n: [...services.values()].reduce((a, b) => a + b, 0),
      services: [...services.entries()]
        .map(([label, n]) => ({ label, n }))
        .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label, 'fr')),
    }))
    .sort((a, b) => b.n - a.n || a.institution.localeCompare(b.institution, 'fr'))
}

export function parVolontaire(lignes) {
  const map = new Map()
  for (const l of lignes) {
    for (const v of l.volontaires) {
      const id = v.id || v.nom
      if (!id) continue
      const cur = map.get(id) || { nom: v.nom || 'Volontaire', n: 0 }
      cur.n += 1
      map.set(id, cur)
    }
  }
  return [...map.values()].sort((a, b) => b.n - a.n || a.nom.localeCompare(b.nom, 'fr'))
}

export function evolutionAnnees(lignes) {
  const map = new Map()
  for (const l of lignes) {
    if (!l.annee) continue
    map.set(l.annee, (map.get(l.annee) || 0) + 1)
  }
  const rows = [...map.entries()].map(([annee, n]) => ({ annee, n })).sort((a, b) => a.annee - b.annee)
  const max = rows.reduce((m, r) => Math.max(m, r.n), 0) || 1
  return rows.map(r => ({ ...r, pct: Math.round((r.n / max) * 100) }))
}

export function totalKm(lignes) {
  return Math.round(lignes.reduce((s, l) => s + (Number(l.km) || 0), 0) * 10) / 10
}

export function ordreTranches(rows) {
  const ordre = [...TRANCHES_AGE.map(t => t.l), 'Moins d’un an', 'Non renseigné']
  return [...rows].sort((a, b) => ordre.indexOf(a.label) - ordre.indexOf(b.label))
}
