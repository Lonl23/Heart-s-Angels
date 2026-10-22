import { normaliserPeriodes, periodesDepuisSouhait } from './datesSouhait.js'

function lendemain(iso) {
  const t = new Date(iso + 'T12:00:00')
  t.setDate(t.getDate() + 1)
  const y = t.getFullYear()
  const m = String(t.getMonth() + 1).padStart(2, '0')
  const d = String(t.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function jourBruxelles(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Brussels',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

/** Les statuts et checklists ne s’ouvrent que pendant le souhait et le jour qui suit. */
export function fenetreStatuts(souhait, aujourdHui = jourBruxelles()) {
  const periodes = normaliserPeriodes(periodesDepuisSouhait(souhait)).filter(p => p.debut)
  if (!periodes.length) {
    return {
      ouvert: false,
      debut: null,
      fin: null,
      limite: null,
      raison: 'Les statuts s’ouvriront pendant les dates du souhait, et le jour qui suit.',
    }
  }
  const debut = periodes.reduce((acc, p) => (p.debut < acc ? p.debut : acc), periodes[0].debut)
  const fin = periodes.reduce((acc, p) => (p.fin > acc ? p.fin : acc), periodes[0].fin)
  const limite = lendemain(fin)
  const ouvert = aujourdHui >= debut && aujourdHui <= limite
  return {
    ouvert,
    debut,
    fin,
    limite,
    raison: ouvert
      ? ''
      : `Les statuts sont ouverts du ${fmtCourt(debut)} au ${fmtCourt(limite)} (jour du souhait et lendemain).`,
  }
}

function fmtCourt(iso) {
  if (!iso) return ''
  return new Date(iso + 'T12:00:00').toLocaleDateString('fr-BE')
}

export function ageEnAnnees(ddn, au) {
  if (!ddn || !au) return null
  const n = new Date(String(ddn).slice(0, 10) + 'T12:00:00')
  const r = new Date(String(au).slice(0, 10) + 'T12:00:00')
  if (Number.isNaN(n.getTime()) || Number.isNaN(r.getTime())) return null
  let age = r.getFullYear() - n.getFullYear()
  const md = r.getMonth() - n.getMonth()
  if (md < 0 || (md === 0 && r.getDate() < n.getDate())) age -= 1
  return age
}

export const TRANCHES_AGE = [
  { id: '1-18', l: '1 – 18 ans', ok: a => a >= 1 && a < 18 },
  { id: '18-25', l: '18 – 25 ans', ok: a => a >= 18 && a < 25 },
  { id: '25-45', l: '25 – 45 ans', ok: a => a >= 25 && a < 45 },
  { id: '45-65', l: '45 – 65 ans', ok: a => a >= 45 && a < 65 },
  { id: '65+', l: '+ 65 ans', ok: a => a >= 65 },
]

export function libelleTranche(age) {
  if (age == null || Number.isNaN(age)) return 'Non renseigné'
  const t = TRANCHES_AGE.find(x => x.ok(age))
  return t ? t.l : 'Moins d’un an'
}
