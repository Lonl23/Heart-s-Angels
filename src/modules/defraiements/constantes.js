export const FORFAIT_JOUR = 44.02
export const PLAFOND_AN = 1760.83
export const TAUX_KM = 0.4326
export const MAX_KM = 2000
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
  const n2 = Number.isFinite(Number(n)) ? Number(n) : 0
  return n2.toFixed(2).replace('.', ',') + ' €'
}

const MOIS_COURT = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc']

export function fmtDateCourte(iso) {
  if (!iso) return ''
  const d = new Date(String(iso).slice(0, 10) + 'T12:00:00')
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getDate()}-${MOIS_COURT[d.getMonth()]}`
}

export function titrePeriode(mois, annee) {
  const d = new Date(annee, (mois || 1) - 1, 1)
  const t = d.toLocaleDateString('fr-BE', { month: 'long', year: 'numeric' })
  return t
}

export function nomCompletNote(p) {
  return [p?.nom, p?.prenom].filter(Boolean).join(' ')
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

export const MOTIFS_KM = [
  { v: 'recolte', l: 'Récolte de souhaits' },
  { v: 'hors_base', l: 'Souhait hors de la base de la semaine' },
]

export function activiteKmDefaut(motif) {
  return motif === 'hors_base' ? 'Souhait' : 'Récolte de souhaits'
}

export function ligneKmVide(date = '') {
  return {
    date,
    motif: 'recolte',
    activite: activiteKmDefaut('recolte'),
    lieux: '',
    km: '',
    montant: 0,
  }
}

export function montantKm(km) {
  const n = Number(String(km ?? '').replace(',', '.').replace(/\s/g, ''))
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.round(n * TAUX_KM * 100) / 100
}

export function normaliserLignesKm(lignes) {
  return (lignes || [])
    .map(l => {
      const motif = l?.motif === 'hors_base' ? 'hors_base' : 'recolte'
      const km = Number(String(l?.km ?? '').replace(',', '.').replace(/\s/g, ''))
      return {
        date: String(l?.date || '').slice(0, 10),
        motif,
        activite: (l?.activite || '').trim() || activiteKmDefaut(motif),
        lieux: (l?.lieux || '').trim(),
        km: Number.isFinite(km) && km > 0 ? km : 0,
        montant: montantKm(km),
      }
    })
    .filter(l => l.date && l.km > 0)
}

export function totalKm(lignes) {
  return Math.round((normaliserLignesKm(lignes).reduce((a, l) => a + l.montant, 0)) * 100) / 100
}

export function totalKmParcourus(lignes) {
  return Math.round(normaliserLignesKm(lignes).reduce((a, l) => a + (Number(l.km) || 0), 0) * 10) / 10
}

export function joursDuMois(mois, annee) {
  const last = new Date(annee, mois, 0).getDate()
  return Array.from({ length: last }, (_, i) => {
    const d = String(i + 1).padStart(2, '0')
    const m = String(mois).padStart(2, '0')
    return `${annee}-${m}-${d}`
  })
}
