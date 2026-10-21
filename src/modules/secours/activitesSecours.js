import { QUALIFS, qualsImplicites } from '@/modules/fiche/ficheSchema'

/** Qualifications de la fiche, plus le type médical / non médical. */
export const COMPETENCES_ACTIVITE = [
  ...QUALIFS,
  { v: 'medical', l: 'Type médical' },
  { v: 'non_medical', l: 'Type non médical' },
]

const CLES = new Set(COMPETENCES_ACTIVITE.map(c => c.v))

export function libelleCompetence(v) {
  return COMPETENCES_ACTIVITE.find(c => c.v === v)?.l || v
}

export function competencesConnues(liste) {
  const vus = new Set()
  const out = []
  for (const c of Array.isArray(liste) ? liste : []) {
    if (!CLES.has(c) || vus.has(c)) continue
    vus.add(c)
    out.push(c)
  }
  return out
}

/** Ce que la fiche couvre vraiment : qualifications (et celles que l’app en déduit) et le type. */
export function competencesDuProfil(profile) {
  const fiche = profile?.fiche || {}
  const set = new Set(qualsImplicites(profile?.role, fiche))
  if (fiche.type_benevole === 'medical' || profile?.role === 'volontaire_medical') set.add('medical')
  if (fiche.type_benevole === 'non_medical' || profile?.role === 'volontaire_non_medical') set.add('non_medical')
  return set
}

export function requiertMesCompetences(activite, mes) {
  const req = Array.isArray(activite?.competences) ? activite.competences : []
  if (!req.length || !mes || mes.size === 0) return false
  return req.some(c => mes.has(c))
}

/** L’activité n’est pas terminée (la fin, ou le début s’il n’y a pas de fin). */
export function estAVenir(activite, maintenant = new Date()) {
  const fin = activite?.fin ? new Date(activite.fin) : new Date(activite?.debut)
  return !Number.isNaN(fin.getTime()) && fin.getTime() >= maintenant.getTime()
}

/** Le début tombe entre aujourd’hui (minuit local) et dans 30 jours, non compris. */
export function dansLes30Jours(debut, maintenant = new Date()) {
  const d = new Date(debut)
  if (Number.isNaN(d.getTime())) return false
  const jour = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate())
  const limite = new Date(jour)
  limite.setDate(limite.getDate() + 30)
  return d >= jour && d < limite
}

export function peutCreerActiviteSecours(profile) {
  const role = profile?.role
  if (!role || role === 'partenaire') return false
  if (role === 'admin' || role === 'president') return true
  const roles = profile?.fiche?.roles_asbl || []
  return roles.some(r => r === 'president' || r === 'vice_president')
}

export function indexInscriptions(inscriptions, userId) {
  const nombres = new Map()
  const miennes = new Set()
  for (const i of inscriptions || []) {
    nombres.set(i.activite_id, (nombres.get(i.activite_id) || 0) + 1)
    if (userId && i.user_id === userId) miennes.add(i.activite_id)
  }
  return { nombres, miennes }
}

/**
 * Compteurs de l’écran.
 * - possible : à venir, une place libre, je ne suis pas déjà inscrit
 * - competence : à venir, au moins une compétence requise est sur ma fiche
 * - bientot : le début est dans les 30 prochains jours
 */
export function compterActivites(activites, inscriptions, profile, maintenant = new Date()) {
  const { nombres, miennes } = indexInscriptions(inscriptions, profile?.id)
  const mes = competencesDuProfil(profile)
  let possible = 0
  let competence = 0
  let bientot = 0
  for (const a of activites || []) {
    const n = nombres.get(a.id) || 0
    const aVenir = estAVenir(a, maintenant)
    if (aVenir && n < Number(a.places) && !miennes.has(a.id)) possible += 1
    if (aVenir && requiertMesCompetences(a, mes)) competence += 1
    if (dansLes30Jours(a.debut, maintenant)) bientot += 1
  }
  return { possible, competence, bientot, nombres, miennes, mes }
}
