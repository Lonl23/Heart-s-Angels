export const FORFAIT_JOUR = 44.02
export const PLAFOND_AN = 1760.83
export const ORG_FRAIS = "Heart's Angels asbl"
export const FORFAIT_JUSQUA = '31/12/2026'

export const STATUTS_NOTE = {
  en_attente:  { l: 'À valider',  c: '#BA7517', bg: '#FAEEDA' },
  approuve_n1: { l: 'Approuvée',  c: '#185FA5', bg: '#E6F1FB' },
  approuve_n2: { l: 'Approuvée',  c: '#185FA5', bg: '#E6F1FB' },
  refuse:      { l: 'Refusée',    c: '#A32D2D', bg: '#FCEBEB' },
  paye:        { l: 'Payée',      c: '#3B6D11', bg: '#EAF3DE' },
}

export function stNote(v) {
  return STATUTS_NOTE[v] || STATUTS_NOTE.en_attente
}

export function fmtEuro(n) {
  return new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR' }).format(Number(n) || 0)
}

export function fmtDateCourte(iso) {
  if (!iso) return ''
  return new Date(String(iso).slice(0, 10) + 'T12:00:00')
    .toLocaleDateString('fr-BE', { day: 'numeric', month: 'short' })
    .replace('.', '')
}

export function titrePeriode(mois, annee) {
  const d = new Date(annee, (mois || 1) - 1, 1)
  const t = d.toLocaleDateString('fr-BE', { month: 'long', year: 'numeric' })
  return t.charAt(0).toUpperCase() + t.slice(1)
}

export function normaliserIban(v) {
  const s = String(v || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  return s.replace(/(.{4})/g, '$1 ').trim()
}

export function ibanValide(v) {
  const s = String(v || '').replace(/\s+/g, '').toUpperCase()
  return /^BE\d{14}$/.test(s)
}

export function ligneVide(date = '') {
  return { date, activite: 'Souhait', lieu: '', souhait_id: null, montant: FORFAIT_JOUR }
}

export function fusionnerJours(lignes) {
  const map = new Map()
  for (const l of lignes || []) {
    const k = String(l.date || '').slice(0, 10)
    if (!k) continue
    if (!map.has(k)) {
      map.set(k, { ...ligneVide(k), ...l, date: k, montant: FORFAIT_JOUR })
    } else {
      const cur = map.get(k)
      const lieu = (l.lieu || '').trim()
      if (lieu && cur.lieu && lieu !== cur.lieu && !cur.lieu.includes(lieu)) {
        cur.lieu = `${cur.lieu} / ${lieu}`
      } else if (lieu && !cur.lieu) cur.lieu = lieu
    }
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date))
}

export function totalForfait(lignes) {
  return Math.round((lignes || []).reduce((a, l) => a + (Number(l.montant) || 0), 0) * 100) / 100
}

export function joursDuMois(mois, annee) {
  const last = new Date(annee, mois, 0).getDate()
  return Array.from({ length: last }, (_, i) => {
    const d = String(i + 1).padStart(2, '0')
    const m = String(mois).padStart(2, '0')
    return `${annee}-${m}-${d}`
  })
}
