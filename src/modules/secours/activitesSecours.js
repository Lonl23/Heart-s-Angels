import { QUALIFS, qualsImplicites } from '@/modules/fiche/ficheSchema'

/** Nature de l’activité. Pas un rôle de compte. */
export const TYPES_ACTIVITE = [
  { v: 'activite', l: 'Activité' },
  { v: 'garde', l: 'Garde' },
  { v: 'manoeuvre', l: 'Manœuvre' },
  { v: 'formation', l: 'Formation' },
]

export function libelleTypeActivite(v) {
  return TYPES_ACTIVITE.find(t => t.v === v)?.l || 'Activité'
}

/**
 * Équipes / dispositifs du département secours (pas les souhaits).
 * Un préventif peut porter plusieurs équipes (AMBU + PMA + PAPS…).
 *
 * Hiérarchie des qualifications (1 = plus faible, 7 = plus fort) :
 * 1 secouriste · 2 ambulancier ATNUP · 3 ambulancier AMU · 4 infirmier ·
 * 5 infirmier SIAMU · 6 médecin · 7 médecin urgentiste
 * « Secouriste minimum » = rang ≥ 1 (un rang plus fort peut couvrir un poste plus faible).
 */
export const DISPOSITIFS = [
  { v: 'paps', l: 'PAPS — Point d’alerte et de premiers secours', court: 'PAPS' },
  { v: 'ps', l: 'PS — Poste de secours', court: 'PS' },
  { v: 'echo', l: 'Écho', court: 'Écho' },
  { v: 'pma_cat2', l: 'PMA catégorie 2', court: 'PMA CAT 2' },
  { v: 'pma_cat1', l: 'PMA catégorie 1', court: 'PMA CAT 1' },
  { v: 'pma_cat0', l: 'PMA catégorie 0', court: 'PMA CAT 0' },
  { v: 'ambu_112', l: 'Ambulance 112', court: 'AMBU 112' },
  { v: 'ambu', l: 'Ambulance (ATNUP)', court: 'AMBU' },
]

export const RANGS_QUALIF = {
  secouriste: 1,
  ambulancier_atnup: 2,
  ambulancier_amu: 3,
  infirmier: 4,
  infirmier_siamu: 5,
  medecin: 6,
  medecin_urgentiste: 7,
}

/** Rôles d’effectif (clés = rangs). */
export const ROLES_EQUIPE = [
  { v: 'secouriste', l: 'Secouriste (≥1)' },
  { v: 'ambulancier_atnup', l: 'Ambulancier ATNUP (≥2)' },
  { v: 'ambulancier_amu', l: 'Ambulancier AMU (≥3)' },
  { v: 'infirmier', l: 'Infirmier(ère) (≥4)' },
  { v: 'infirmier_siamu', l: 'Infirmier(ère) SIAMU (≥5)' },
  { v: 'medecin', l: 'Médecin (≥6)' },
  { v: 'medecin_urgentiste', l: 'Médecin urgentiste (≥7)' },
]

/**
 * Matrices d’équipes. `alternatives` = au moins une composition complète.
 * Les rôles sont des rangs minimums (un rang supérieur peut remplir un poste inférieur).
 */
export const EQUIPES_DISPOSITIF = {
  paps: {
    placesMin: 2,
    resume: '2 secouristes minimum',
    alternatives: [[{ role: 'secouriste', n: 2 }]],
  },
  ps: {
    placesMin: 3,
    resume: '2 secouristes + 1 AMU/ATNUP',
    alternatives: [[
      { role: 'secouriste', n: 2 },
      { role: 'ambulancier_atnup', n: 1 },
    ]],
  },
  echo: {
    placesMin: 5,
    resume: '4 secouristes + 1 AMU/ATNUP (5 personnes)',
    alternatives: [[
      { role: 'secouriste', n: 4 },
      { role: 'ambulancier_atnup', n: 1 },
    ]],
  },
  pma_cat2: {
    placesMin: 4,
    resume: '2 secouristes + 1 AMU + 1 infirmier',
    alternatives: [[
      { role: 'secouriste', n: 2 },
      { role: 'ambulancier_amu', n: 1 },
      { role: 'infirmier', n: 1 },
    ]],
  },
  pma_cat1: {
    placesMin: 4,
    resume: '2 secouristes + 1 AMU + 1 infirmier SIAMU',
    alternatives: [[
      { role: 'secouriste', n: 2 },
      { role: 'ambulancier_amu', n: 1 },
      { role: 'infirmier_siamu', n: 1 },
    ]],
  },
  pma_cat0: {
    placesMin: 5,
    resume: '2 secouristes + 1 AMU + 1 infirmier SIAMU + 1 médecin',
    alternatives: [[
      { role: 'secouriste', n: 2 },
      { role: 'ambulancier_amu', n: 1 },
      { role: 'infirmier_siamu', n: 1 },
      { role: 'medecin', n: 1 },
    ]],
  },
  ambu_112: {
    placesMin: 2,
    resume: '2 AMU, ou 1 AMU + 1 infirmier SIAMU',
    alternatives: [
      [{ role: 'ambulancier_amu', n: 2 }],
      [
        { role: 'ambulancier_amu', n: 1 },
        { role: 'infirmier_siamu', n: 1 },
      ],
    ],
  },
  ambu: {
    placesMin: 2,
    resume: '2 ATNUP (ambulanciers) minimum',
    alternatives: [[{ role: 'ambulancier_atnup', n: 2 }]],
  },
}

/** Checklist d’armement par défaut (liée au terrain, pas un inventaire parallèle). */
export const CHECKLIST_ARMEMENT = {
  paps: ['Trousse premiers secours', 'Radio / téléphone', 'Gilet haute visibilité'],
  ps: ['Matériel poste de secours', 'O₂ / insufflateur', 'Radio / téléphone', 'Véhicule si prévu'],
  echo: ['Matériel écho', 'Radio / téléphone', 'Véhicule si prévu'],
  pma_cat2: ['Lot PMA', 'O₂', 'Brancard / chaise', 'Radio', 'Véhicule'],
  pma_cat1: ['Lot PMA CAT 1', 'O₂ / monitorage', 'Brancard', 'Radio', 'Véhicule'],
  pma_cat0: ['Lot PMA CAT 0', 'O₂ / monitorage', 'Brancard', 'Radio', 'Véhicule médecin'],
  ambu_112: ['Ambulance équipée 112', 'O₂', 'Brancard', 'Radio 112'],
  ambu: ['Ambulance ATNUP', 'O₂', 'Brancard', 'Radio'],
}

export const DISPOSITIFS_CONNUS = new Set(DISPOSITIFS.map(d => d.v))

export function libelleDispositif(v, court = false) {
  const d = DISPOSITIFS.find(x => x.v === v)
  if (!d) return ''
  return court ? d.court : d.l
}

export function libelleRoleEquipe(v) {
  return ROLES_EQUIPE.find(r => r.v === v)?.l || v
}

export function equipeDuDispositif(v) {
  return EQUIPES_DISPOSITIF[v] || null
}

/** Normalise 1..n équipes depuis dispositif / dispositifs. */
export function dispositifsDeActivite(activiteOuListe) {
  if (Array.isArray(activiteOuListe)) {
    return [...new Set(activiteOuListe.filter(v => DISPOSITIFS_CONNUS.has(v)))]
  }
  const a = activiteOuListe || {}
  const fromArr = Array.isArray(a.dispositifs) ? a.dispositifs : []
  const list = fromArr.length ? fromArr : (a.dispositif ? [a.dispositif] : [])
  return [...new Set(list.filter(v => DISPOSITIFS_CONNUS.has(v)))]
}

/** Compétence affichée pour un rôle d’équipe (pastilles). */
function competencePourRole(role) {
  if (role === 'ambulancier_atnup' || role === 'ambulancier_amu') return role
  return role
}

/** Places + compétences suggérées pour une ou plusieurs équipes. */
export function suggestionDepuisDispositifs(liste) {
  const ids = dispositifsDeActivite(liste)
  if (!ids.length) return null
  const roles = new Set()
  let places = 0
  const resumes = []
  for (const id of ids) {
    const eq = equipeDuDispositif(id)
    if (!eq) continue
    places += eq.placesMin
    resumes.push(`${libelleDispositif(id, true)} : ${eq.resume}`)
    for (const alt of eq.alternatives) {
      for (const b of alt) roles.add(competencePourRole(b.role))
    }
  }
  return {
    places: String(Math.max(places, 1)),
    competences: [...roles],
    resume: resumes.join(' · '),
    dispositifs: ids,
  }
}

/** @deprecated préfère suggestionDepuisDispositifs */
export function suggestionDepuisDispositif(v) {
  return suggestionDepuisDispositifs(v ? [v] : [])
}

export function checklistArmementDefaut(dispositifOuListe) {
  const ids = dispositifsDeActivite(dispositifOuListe)
  const labels = []
  const vus = new Set()
  for (const id of (ids.length ? ids : [null])) {
    for (const label of (CHECKLIST_ARMEMENT[id] || ['Matériel de base', 'Radio / téléphone', 'Véhicule si prévu'])) {
      if (vus.has(label)) continue
      vus.add(label)
      labels.push(label)
    }
  }
  return labels.map((label, i) => ({ id: `c${i + 1}`, label, ok: false }))
}

export function normaliserArmement(raw, dispositifOuListe) {
  const a = raw && typeof raw === 'object' ? raw : {}
  const items = Array.isArray(a.items) && a.items.length
    ? a.items.map((it, i) => ({
      id: String(it?.id || `c${i + 1}`),
      label: String(it?.label || `Point ${i + 1}`),
      ok: !!it?.ok,
    }))
    : checklistArmementDefaut(dispositifOuListe)
  return {
    plaque: String(a.plaque || ''),
    note: String(a.note || ''),
    items,
  }
}

export function armementComplet(armement) {
  const a = normaliserArmement(armement)
  if (!a.items.length) return false
  return a.items.every(it => it.ok)
}

/** null si vide, nombre si valide, undefined si illisible. */
export function publicAttenduOuNull(v) {
  if (v === '' || v == null) return null
  const n = Number(v)
  if (!Number.isInteger(n) || n < 0 || n > 500000) return undefined
  return n
}

/** La sélection médicale est échue et l’activité demande un chauffeur. */
export function selectionChauffeurEchue(profile, activite, maintenant = new Date()) {
  const req = Array.isArray(activite?.competences) ? activite.competences : []
  if (!req.includes('chauffeur')) return false
  const iso = profile?.fiche?.permis?.selection_validite
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(String(iso))) return false
  const [y, m, d] = String(iso).split('-').map(Number)
  const fin = new Date(y, m - 1, d, 23, 59, 59, 999)
  return maintenant.getTime() > fin.getTime()
}

/** Qualifications / rangs affichés sur l’activité (+ types). */
export const COMPETENCES_ACTIVITE = [
  { v: 'secouriste', l: 'Secouriste' },
  { v: 'ambulancier_atnup', l: 'Ambulancier ATNUP' },
  { v: 'ambulancier_amu', l: 'Ambulancier AMU' },
  { v: 'ambulancier', l: 'Ambulancier(ère)' },
  { v: 'infirmier', l: 'Infirmier(ère)' },
  { v: 'infirmier_siamu', l: 'Infirmier(ère) SIAMU' },
  { v: 'medecin', l: 'Médecin' },
  { v: 'medecin_urgentiste', l: 'Médecin urgentiste' },
  { v: 'kine', l: 'Kiné' },
  { v: 'psychologue', l: 'Psychologue' },
  { v: 'chauffeur', l: 'Chauffeur' },
  { v: 'autre', l: 'Autre' },
  { v: 'medical', l: 'Type médical' },
  { v: 'non_medical', l: 'Type non médical' },
]

const CLES = new Set(COMPETENCES_ACTIVITE.map(c => c.v))

export function libelleCompetence(v) {
  return COMPETENCES_ACTIVITE.find(c => c.v === v)?.l
    || ROLES_EQUIPE.find(r => r.v === v)?.l
    || v
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

function aSpecialisationSiamu(fiche) {
  const specs = fiche?.infirmier?.specialisations
  return Array.isArray(specs) && specs.includes('siamu')
}

function estMedecinUrgentiste(fiche) {
  return !!(fiche?.medecin?.urgentiste || fiche?.medecin?.specialite === 'urgentiste')
}

function aBadge112(fiche) {
  return !!(fiche?.ambulancier?.badge_112 && String(fiche.ambulancier.badge_112).trim())
}

/**
 * Rang max 1–7 d’après la fiche.
 * ATNUP = ambulancier sans badge 112 · AMU = ambulancier avec badge 112.
 */
export function rangQualifDuProfil(profile) {
  const fiche = profile?.fiche || {}
  const comps = new Set(qualsImplicites(profile?.role, fiche))
  let rang = 0
  if (comps.has('secouriste') || comps.has('volontaire_non_medical') || fiche.type_benevole === 'non_medical') {
    rang = Math.max(rang, RANGS_QUALIF.secouriste)
  }
  if (comps.has('ambulancier')) {
    rang = Math.max(rang, aBadge112(fiche) ? RANGS_QUALIF.ambulancier_amu : RANGS_QUALIF.ambulancier_atnup)
  }
  if (comps.has('infirmier')) {
    rang = Math.max(rang, aSpecialisationSiamu(fiche) ? RANGS_QUALIF.infirmier_siamu : RANGS_QUALIF.infirmier)
  }
  if (comps.has('medecin')) {
    rang = Math.max(rang, estMedecinUrgentiste(fiche) ? RANGS_QUALIF.medecin_urgentiste : RANGS_QUALIF.medecin)
  }
  return rang
}

/** Ce que la fiche couvre vraiment : qualifications dérivées + type. */
export function competencesDuProfil(profile) {
  const fiche = profile?.fiche || {}
  const set = new Set(qualsImplicites(profile?.role, fiche))
  if (fiche.type_benevole === 'medical' || profile?.role === 'volontaire_medical') set.add('medical')
  if (fiche.type_benevole === 'non_medical' || profile?.role === 'volontaire_non_medical') set.add('non_medical')
  if (set.has('ambulancier')) {
    set.add(aBadge112(fiche) ? 'ambulancier_amu' : 'ambulancier_atnup')
  }
  if (set.has('infirmier') && aSpecialisationSiamu(fiche)) set.add('infirmier_siamu')
  if (set.has('medecin') && estMedecinUrgentiste(fiche)) set.add('medecin_urgentiste')
  return set
}

export function rolesEquipeDuProfil(profile) {
  const rang = rangQualifDuProfil(profile)
  return ROLES_EQUIPE.filter(r => rang >= RANGS_QUALIF[r.v]).map(r => r.v)
}

function rangRequisPourRole(role) {
  return RANGS_QUALIF[role] || 99
}

/** Une personne = un poste. Poste = rang minimum. On assigne d’abord les rangs les plus hauts. */
function compositionSatisfaite(profils, besoins) {
  const slots = besoins
    .flatMap(b => Array.from({ length: b.n }, () => b.role))
    .sort((a, b) => rangRequisPourRole(b) - rangRequisPourRole(a))
  const pool = (profils || []).map(p => ({
    rang: rangQualifDuProfil(p),
    used: false,
  }))
  const manqueParRole = {}
  for (const role of slots) {
    const besoin = rangRequisPourRole(role)
    // Préférer la personne « juste assez » (rang le plus bas qui convient) pour garder les plus forts.
    const candidats = pool
      .map((p, i) => ({ ...p, i }))
      .filter(p => !p.used && p.rang >= besoin)
      .sort((a, b) => a.rang - b.rang)
    const cand = candidats[0]
    if (cand) pool[cand.i].used = true
    else manqueParRole[role] = (manqueParRole[role] || 0) + 1
  }
  const manques = Object.entries(manqueParRole).map(([role, manque]) => {
    const besoin = besoins.find(b => b.role === role)?.n || manque
    return { role, besoin, present: Math.max(0, besoin - manque), manque }
  })
  return { ok: manques.length === 0, manques }
}

function evaluerUneEquipe(dispositif, profilsInscrits) {
  const eq = equipeDuDispositif(dispositif)
  if (!eq) {
    return { ok: true, resume: '', manques: [], alternativeOk: null, placesMin: 0, dispositif }
  }
  let meilleure = null
  for (let i = 0; i < eq.alternatives.length; i++) {
    const r = compositionSatisfaite(profilsInscrits, eq.alternatives[i])
    if (r.ok) {
      return { ok: true, resume: eq.resume, manques: [], alternativeOk: i, placesMin: eq.placesMin, dispositif }
    }
    const score = r.manques.reduce((s, m) => s + m.manque, 0)
    if (!meilleure || score < meilleure.score) {
      meilleure = { ...r, score, alternativeOk: null }
    }
  }
  return {
    ok: false,
    resume: eq.resume,
    manques: meilleure?.manques || [],
    alternativeOk: null,
    placesMin: eq.placesMin,
    dispositif,
  }
}

/** Évalue une ou plusieurs équipes (préventif multi-équipes) contre les inscrits. */
export function evaluerEquipeDispositif(dispositifOuActivite, profilsInscrits) {
  const ids = typeof dispositifOuActivite === 'string' || Array.isArray(dispositifOuActivite)
    ? dispositifsDeActivite(dispositifOuActivite)
    : dispositifsDeActivite(dispositifOuActivite)
  if (!ids.length) {
    return { ok: true, resume: '', manques: [], alternativeOk: null, placesMin: 0, parEquipe: [] }
  }
  // Pool partagé : on consomme les personnes équipe par équipe (rangs les plus exigeants d’abord).
  const ordre = [...ids].sort((a, b) => {
    const ra = Math.max(...(equipeDuDispositif(a)?.alternatives?.[0] || []).map(x => rangRequisPourRole(x.role)), 0)
    const rb = Math.max(...(equipeDuDispositif(b)?.alternatives?.[0] || []).map(x => rangRequisPourRole(x.role)), 0)
    return rb - ra
  })
  let restants = [...(profilsInscrits || [])]
  const parEquipe = []
  const manques = []
  let placesMin = 0
  const resumes = []
  for (const id of ordre) {
    const ev = evaluerUneEquipe(id, restants)
    parEquipe.push(ev)
    placesMin += ev.placesMin || 0
    if (ev.resume) resumes.push(`${libelleDispositif(id, true)} : ${ev.resume}`)
    if (!ev.ok) {
      for (const m of ev.manques) {
        manques.push({ ...m, dispositif: id })
      }
      continue
    }
    // Retirer du pool les personnes assignées à cette équipe (approximation : consommer n placesMin meilleurs rangs requis).
    const eq = equipeDuDispositif(id)
    const alt = eq?.alternatives?.[ev.alternativeOk ?? 0] || []
    const slots = alt
      .flatMap(b => Array.from({ length: b.n }, () => b.role))
      .sort((a, b) => rangRequisPourRole(b) - rangRequisPourRole(a))
    const usedIdx = new Set()
    for (const role of slots) {
      const besoin = rangRequisPourRole(role)
      let best = -1
      let bestRang = Infinity
      restants.forEach((p, i) => {
        if (usedIdx.has(i)) return
        const r = rangQualifDuProfil(p)
        if (r >= besoin && r < bestRang) { best = i; bestRang = r }
      })
      if (best >= 0) usedIdx.add(best)
    }
    restants = restants.filter((_, i) => !usedIdx.has(i))
  }
  return {
    ok: manques.length === 0,
    resume: resumes.join(' · '),
    manques,
    alternativeOk: null,
    placesMin,
    parEquipe,
  }
}

export function texteManquesEquipe(evalEq) {
  if (!evalEq || evalEq.ok) return ''
  if (!evalEq.manques?.length) return `Équipe incomplète (min. ${evalEq.placesMin}).`
  return evalEq.manques
    .map(m => {
      const prefix = m.dispositif ? `${libelleDispositif(m.dispositif, true)} · ` : ''
      return `${prefix}${m.manque}× ${libelleRoleEquipe(m.role)}`
    })
    .join(', ')
}

export function requiertMesCompetences(activite, mes) {
  const req = Array.isArray(activite?.competences) ? activite.competences : []
  if (!req.length || !mes || mes.size === 0) return false
  return req.some(c => mes.has(c))
}

/**
 * a_venir : le début n’est pas encore passé.
 * en_cours : le début est passé et la fin, s’il y en a une, non.
 * terminee : la fin est passée, ou le début s’il n’y a pas de fin.
 */
export function statutActivite(activite, maintenant = new Date()) {
  const debut = new Date(activite?.debut)
  const fin = activite?.fin ? new Date(activite.fin) : null
  const t = maintenant.getTime()
  if (Number.isNaN(debut.getTime()) || t < debut.getTime()) return 'a_venir'
  if (fin && !Number.isNaN(fin.getTime()) && t <= fin.getTime()) return 'en_cours'
  return 'terminee'
}

export function libelleStatutActivite(statut) {
  if (statut === 'en_cours') return 'En cours'
  if (statut === 'terminee') return 'Terminée'
  return 'À venir'
}

/** Durée entre le début et la fin, ou null s’il n’y a pas de fin. */
export function dureeActivite(activite) {
  if (!activite?.debut || !activite?.fin) return null
  const ms = new Date(activite.fin).getTime() - new Date(activite.debut).getTime()
  if (!(ms > 0)) return null
  const min = Math.round(ms / 60000)
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h && m) return `${h} h ${String(m).padStart(2, '0')}`
  if (h) return `${h} h`
  return `${m} min`
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

function escHtml(s) {
  return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
}

/** Bilan de fin d’un dispositif, à partir des inscriptions réelles. */
export function htmlBilanDispositif({
  organisation,
  adresse,
  logo,
  imprimePar,
  numero,
  titre,
  type,
  dispositif,
  publicAttendu,
  debut,
  fin,
  duree,
  lieu,
  places,
  inscrits,
  competences,
  personnel,
  statut,
}) {
  const quand = new Date()
  const imprime = `imprimé par ${imprimePar || 'Heart’s Angels'} le ${quand.toLocaleDateString('fr-BE')} à ${String(quand.getHours()).padStart(2, '0')}:${String(quand.getMinutes()).padStart(2, '0')}`
  const lignes = (personnel || []).length
    ? personnel.map(p => `<tr><td>${escHtml(`${p.prenom || ''} ${p.nom || ''}`.trim() || 'Compte retiré')}</td><td>${escHtml(p.fonction || '—')}</td><td>${escHtml(p.couverture || '—')}</td></tr>`).join('')
    : '<tr><td colspan="3">Personne n’est inscrite.</td></tr>'
  const comps = (competences || []).length ? competences.map(escHtml).join(', ') : 'Aucune'
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>Bilan de fin — ${escHtml(titre)}</title>
<style>
  body { margin: 24px; color: #1A1514; font: 13px/1.4 "Segoe UI", system-ui, sans-serif; }
  header { display: flex; justify-content: space-between; gap: 16px; align-items: center; border-bottom: 3px solid #0E4A5A; padding-bottom: 10px; }
  header img { width: 64px; height: 64px; object-fit: contain; }
  header h1 { margin: 0; font-size: 16px; color: #0E4A5A; text-align: right; }
  header p { margin: 2px 0 0; text-align: right; color: #5c564f; }
  h2 { margin: 22px 0 8px; color: #0E4A5A; font-size: 22px; border-bottom: 3px solid #0E4A5A; display: flex; justify-content: space-between; gap: 12px; }
  h2 span { font-size: 11px; font-weight: 500; color: #5c564f; }
  h3 { margin: 18px 0 8px; color: #0E4A5A; font-size: 15px; border-left: 4px solid #1BB0CE; padding-left: 8px; }
  dl { display: grid; grid-template-columns: 180px 1fr; gap: 4px 12px; margin: 0; }
  dt { color: #7A7470; }
  dd { margin: 0; font-weight: 650; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { background: #0E4A5A; color: #fff; text-align: left; padding: 6px 8px; }
  td { padding: 5px 8px; border-bottom: 1px solid #e3eaf3; }
  tbody tr:nth-child(even) td { background: #f7fafc; }
  .note { margin-top: 10px; color: #5c564f; font-size: 11.5px; }
  footer { margin-top: 28px; border-top: 1px solid #d5dee8; padding-top: 8px; color: #7A7470; font-size: 11px; }
  @media print { body { margin: 12mm; } }
</style></head><body>
<header>
  ${logo ? `<img src="${escHtml(logo)}" alt="">` : '<div></div>'}
  <div><h1>${escHtml(organisation)}</h1><p>${escHtml(adresse)}</p></div>
</header>
<h2>Bilan de fin <span>${escHtml(imprime)}</span></h2>
<h3>${escHtml(titre || 'Activité')}</h3>
<dl>
  <dt>N°</dt><dd>${escHtml(numero ?? '—')}</dd>
  <dt>Statut</dt><dd>${escHtml(statut || '—')}</dd>
  <dt>Type</dt><dd>${escHtml(type || '—')}</dd>
  <dt>Dispositif</dt><dd>${escHtml(dispositif || '—')}</dd>
  <dt>Public attendu</dt><dd>${escHtml(publicAttendu ?? '—')}</dd>
  <dt>Début</dt><dd>${escHtml(debut || '—')}</dd>
  <dt>Fin</dt><dd>${escHtml(fin || '—')}</dd>
  <dt>Durée</dt><dd>${escHtml(duree || '—')}</dd>
  <dt>Lieu</dt><dd>${escHtml(lieu || '—')}</dd>
  <dt>Équipe</dt><dd>${escHtml(inscrits)} / ${escHtml(places)}</dd>
  <dt>Compétences demandées</dt><dd>${escHtml(comps)}</dd>
</dl>
<h3>Équipe armée</h3>
<table><thead><tr><th>Personne</th><th>Fonction</th><th>Compétences demandées</th></tr></thead><tbody>${lignes}</tbody></table>
<p class="note">Document généré à partir des inscriptions. Il ne contient ni victime, ni devis, ni facture.</p>
<footer>${escHtml(organisation)}${adresse ? ' · ' + escHtml(adresse) : ''}</footer>
</body></html>`
}

function blobBilan(donnees) {
  return new Blob([htmlBilanDispositif(donnees)], { type: 'text/html;charset=utf-8' })
}

export function nomFichierBilan(titre) {
  const base = `bilan-dispositif-${titre || ''}`
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `${base || 'bilan-dispositif'}.html`
}

export function telechargerBilan(donnees) {
  if (typeof document === 'undefined') return false
  const url = URL.createObjectURL(blobBilan(donnees))
  const a = document.createElement('a')
  a.href = url
  a.download = nomFichierBilan(donnees.titre)
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
  return true
}

export function ouvrirBilan(donnees) {
  if (typeof window === 'undefined') return false
  const url = URL.createObjectURL(blobBilan(donnees))
  const w = window.open(url, '_blank')
  if (!w) { URL.revokeObjectURL(url); return false }
  const tenter = () => { try { w.focus(); w.print() } catch { /* la fenêtre reste ouverte */ } }
  w.addEventListener('load', tenter)
  setTimeout(tenter, 400)
  setTimeout(() => URL.revokeObjectURL(url), 60000)
  return true
}
