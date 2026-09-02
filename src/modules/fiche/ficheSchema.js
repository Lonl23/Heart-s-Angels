// Listes de référence de la fiche volontaire.

export const QUALIFS = [
  { v:'ambulancier', l:'Ambulancier' },
  { v:'infirmier',   l:'Infirmier(ère)' },
  { v:'medecin',     l:'Médecin' },
  { v:'kine',        l:'Kiné' },
  { v:'psychologue', l:'Psychologue' },
  { v:'secouriste',  l:'Secouriste' },
  { v:'chauffeur',   l:'Chauffeur' },
  { v:'autre',       l:'Autre' },
]

/** Non médical : secouriste puis chauffeur (sélection médicale / permis reste un chip explicite). */
const QUALS_FICHE_NON_MED = ['secouriste', 'chauffeur']

export function qualifsPourType(type) {
  if (type === 'non_medical') return QUALIFS.filter(q => QUALS_FICHE_NON_MED.includes(q.v))
  return QUALIFS.filter(q => q.v !== 'secouriste')
}

/** En changeant de type, on retire les quals qui n’appartiennent plus à la liste. */
export function qualificationsCompatibles(type, qs) {
  const list = Array.isArray(qs) ? qs : []
  if (type === 'non_medical') return list.filter(q => q === 'secouriste' || q === 'chauffeur')
  if (type === 'medical') return list.filter(q => q !== 'secouriste')
  return list
}

export const ROLES_MISSION = [
  ...QUALIFS,
  { v:'volontaire_non_medical', l:'Volontaire non médical' },
]

export const lblRoleMission = v => ROLES_MISSION.find(r => r.v === v)?.l || v

const ROLES_PROFIL_MEDICAUX = ['medecin', 'infirmier', 'ambulancier_bleu', 'ambulancier_gris']
const QUALS_MEDICALES = ['ambulancier', 'infirmier', 'medecin']

/** Infirmier, médecin, ambulancier (y compris dual infi+ambu). Chauffeur / secouriste / VNM : non. */
export function personneEstMedicale(p = {}) {
  const role = p.role || p.profiles?.role
  const fiche = p.fiche || p.profiles?.fiche
  const rm = p.role_mission
  if (fiche?.type_benevole === 'non_medical') return false
  if (QUALS_MEDICALES.includes(rm)) return true
  if (ROLES_PROFIL_MEDICAUX.includes(role)) return true
  if (fiche?.type_benevole === 'medical') return true
  const qs = Array.isArray(fiche?.qualifications) ? fiche.qualifications : []
  return qs.some(q => QUALS_MEDICALES.includes(q))
}

/** L’équipage affecté à ce vecteur a-t-il au moins un médical ? (pas les rôles requis, l’affectation réelle.) */
export function vecteurAEquipageMedical(membres) {
  return (membres || []).some(e => personneEstMedicale(e))
}

/** Qualifications utiles en mission, d’après la fiche (pas de saisie à la dispo). */
export function qualsImplicites(role, fiche) {
  const qs = new Set(fiche?.qualifications || [])
  if (['ambulancier_bleu', 'ambulancier_gris'].includes(role)) qs.add('ambulancier')
  if (role === 'infirmier') qs.add('infirmier')
  if (role === 'medecin') qs.add('medecin')
  if (role === 'volontaire_non_medical' || fiche?.type_benevole === 'non_medical' || qs.has('secouriste')) {
    qs.add('volontaire_non_medical')
  }
  const p = fiche?.permis || {}
  const permis = !!(p.B || p.C || p.E)
  if (qs.has('ambulancier') && permis && p.selection_medicale) qs.add('chauffeur')
  return [...qs]
}

export function teinteDepuisQuals(qs) {
  const list = qs || []
  const ambu = list.includes('ambulancier')
  const infi = list.includes('infirmier')
  if (ambu && infi) return 'dual'
  if (infi) return 'infi'
  if (ambu) return 'ambu'
  if (list.includes('volontaire_non_medical') || list.includes('secouriste')) return 'nonmed'
  return 'autre'
}

export function teinteDispo(role, fiche) {
  return teinteDepuisQuals(qualsImplicites(role, fiche))
}

export const EQUIPAGE_DEFAUT = ['ambulancier', 'infirmier']

/** Si rien n’est coché : ambulancier + infirmier. Si chauffeur seul est coché, on ne rajoute pas le défaut. */
export function rolesRequisEffectifs(requis) {
  return (requis && requis.length) ? requis : EQUIPAGE_DEFAUT
}

/** Rôles d’un vecteur. Tableau présent (même vide) = ce véhicule ; sinon repli mission puis défaut. */
export function rolesRequisVecteur(vecteur, missionRolesRequis) {
  if (Array.isArray(vecteur?.roles_requis)) return rolesRequisEffectifs(vecteur.roles_requis)
  return rolesRequisEffectifs(missionRolesRequis)
}

/** Concaténation par vecteur : deux véhicules infi+ambu = deux infi + deux ambu, pas 1+1. */
export function rolesRequisTousVecteurs(mission) {
  const vecteurs = mission?.vecteurs || []
  if (!vecteurs.length) return rolesRequisEffectifs(mission?.roles_requis)
  return vecteurs.flatMap(v => rolesRequisVecteur(v, mission?.roles_requis))
}

/** Retranche `couverts` de `requis` en tenant compte des doublons (un rôle par occurrence). */
export function rolesManquantsMultiset(requis, couverts) {
  const used = [...(couverts || [])]
  const out = []
  for (const r of requis || []) {
    const i = used.indexOf(r)
    if (i >= 0) used.splice(i, 1)
    else out.push(r)
  }
  return out
}

function qualsDunePersonne(p) {
  if (!p) return []
  if (Array.isArray(p.quals) && p.quals.length) return p.quals
  return qualsImplicites(p.role || p.profiles?.role, p.fiche || p.profiles?.fiche)
}

/**
 * Couverture agrégée d’une mission : chaque vecteur est pourvu par son équipage,
 * puis les personnes restantes (sans vecteur, ou seulement dispo) comblent les trous
 * une seule fois. Un infi+ambu n’occupe qu’un côté, sur un seul vecteur.
 */
export function couvertureMission(mission, equipe = [], extras = []) {
  const vecteurs = (mission?.vecteurs || []).length
    ? mission.vecteurs
    : [{ id: null, roles_requis: mission?.roles_requis }]
  const used = new Set()
  const requisAll = []
  const couvertsAll = []

  for (const v of vecteurs) {
    const need = rolesRequisVecteur(v, mission?.roles_requis)
    requisAll.push(...need)
    const membres = v.id ? equipe.filter(e => e.vecteur_id === v.id) : equipe
    for (const e of membres) if (e.user_id) used.add(e.user_id)
    const missing = rolesEncoreManquants(need, membres.map(e => ({ quals: qualsDunePersonne(e) })))
    couvertsAll.push(...need.filter(r => !missing.includes(r)))
  }

  let remaining = rolesManquantsMultiset(requisAll, couvertsAll)
  const seen = new Set(used)
  const pool = []
  for (const e of equipe) {
    if (!e.user_id || seen.has(e.user_id)) continue
    seen.add(e.user_id)
    pool.push({ user_id: e.user_id, quals: qualsDunePersonne(e) })
  }
  for (const p of extras) {
    const uid = p.user_id
    if (uid && seen.has(uid)) continue
    if (uid) seen.add(uid)
    pool.push({ user_id: uid, quals: qualsDunePersonne(p) })
  }
  const dejaGreedy = []
  for (const p of pool) {
    if (!remaining.length) break
    const quals = p.quals || []
    let role = roleSuggere(quals, remaining, dejaGreedy)
    if (!role || !remaining.includes(role) || !quals.includes(role)) {
      role = remaining.find(r => quals.includes(r)) || ''
    }
    if (!role) continue
    remaining = remaining.slice()
    remaining.splice(remaining.indexOf(role), 1)
    couvertsAll.push(role)
    dejaGreedy.push(role)
  }
  return { requis: requisAll, couverts: couvertsAll }
}

/** Rôle proposé à l’affectation : un infi+ambu va du côté le moins déjà pourvu. */
export function roleSuggere(quals, requis, rolesDeja) {
  const q = quals || []
  const need = rolesRequisEffectifs(requis)
  const deja = rolesDeja || []
  const dual = q.includes('ambulancier') && q.includes('infirmier')
  const nInfi = deja.filter(r => r === 'infirmier').length
  const nAmbu = deja.filter(r => r === 'ambulancier').length
  const needI = need.includes('infirmier')
  const needA = need.includes('ambulancier')
  if (dual && needI && needA) return nInfi <= nAmbu ? 'infirmier' : 'ambulancier'
  if (dual && needI) return 'infirmier'
  if (dual && needA) return 'ambulancier'
  for (const r of need) if (q.includes(r)) return r
  if (q.includes('infirmier')) return 'infirmier'
  if (q.includes('ambulancier')) return 'ambulancier'
  return q[0] || ''
}

const UN = {
  ambulancier: 'un ambulancier',
  infirmier: 'un infirmier',
  chauffeur: 'un chauffeur',
  medecin: 'un médecin',
  kine: 'un kiné',
  psychologue: 'un psychologue',
  volontaire_non_medical: 'un volontaire non médical',
  secouriste: 'un secouriste',
  autre: 'un volontaire',
}

const PLURIEL = {
  ambulancier: 'ambulanciers',
  infirmier: 'infirmiers',
  chauffeur: 'chauffeurs',
  medecin: 'médecins',
  kine: 'kinés',
  psychologue: 'psychologues',
  volontaire_non_medical: 'volontaires non médicaux',
  secouriste: 'secouristes',
  autre: 'volontaires',
}

const NOMBRE = { 2: 'deux', 3: 'trois', 4: 'quatre', 5: 'cinq' }

function bitManque(c, n) {
  if (n <= 1) return UN[c] || ('un ' + String(c).replace(/_/g, ' '))
  const qte = NOMBRE[n] || String(n)
  return qte + ' ' + (PLURIEL[c] || String(c).replace(/_/g, ' '))
}

export function phraseIlManque(codes) {
  if (!codes?.length) return ''
  const order = []
  const n = Object.create(null)
  for (const c of codes) {
    if (!n[c]) { order.push(c); n[c] = 0 }
    n[c]++
  }
  const bits = order.map(c => bitManque(c, n[c]))
  if (bits.length === 1) return 'il manque ' + bits[0]
  if (bits.length === 2) return 'il manque ' + bits[0] + ' et ' + bits[1]
  return 'il manque ' + bits.slice(0, -1).join(', ') + ' et ' + bits[bits.length - 1]
}

/**
 * Rôles encore manquants après affectés ∪ personnes dispo plein sans conflit.
 * Un infi+ambu ne remplit qu’un côté (le plus rare). Chauffeur : via quals (permis + sélection médicale).
 */
export function rolesEncoreManquants(requis, personnes) {
  const need = rolesRequisEffectifs(requis)
  const couverts = []
  let nInfi = 0, nAmbu = 0, nDual = 0
  for (const p of personnes || []) {
    const q = p.quals || []
    const hasInfi = q.includes('infirmier')
    const hasAmbu = q.includes('ambulancier')
    if (hasInfi && hasAmbu) nDual++
    else if (hasInfi) nInfi++
    else if (hasAmbu) nAmbu++
    for (const role of q) {
      if (need.includes(role) && role !== 'infirmier' && role !== 'ambulancier' && !couverts.includes(role)) {
        couverts.push(role)
      }
    }
  }
  for (let i = 0; i < nDual; i++) {
    if (need.includes('infirmier') && need.includes('ambulancier')) {
      if (nInfi <= nAmbu) nInfi++; else nAmbu++
    } else if (need.includes('infirmier')) nInfi++
    else if (need.includes('ambulancier')) nAmbu++
  }
  if (need.includes('infirmier') && nInfi > 0) couverts.push('infirmier')
  if (need.includes('ambulancier') && nAmbu > 0) couverts.push('ambulancier')
  return need.filter(r => !couverts.includes(r))
}

export function libelleQualsImplicites(role, fiche) {
  const qs = qualsImplicites(role, fiche)
  if (!qs.length) return ''
  const dual = qs.includes('ambulancier') && qs.includes('infirmier')
  const rest = qs.filter(q => q !== 'ambulancier' && q !== 'infirmier')
  const head = dual
    ? (lblRoleMission('infirmier') + ' / ' + lblRoleMission('ambulancier'))
    : qs.filter(q => q === 'ambulancier' || q === 'infirmier').map(lblRoleMission).join(' · ')
  const tail = rest.map(lblRoleMission).join(' · ')
  return [head, tail].filter(Boolean).join(' · ')
}

export const ROLES_ASBL = [
  { v:'simple_volontaire',            l:'Simple volontaire' },
  { v:'president',                    l:'Président' },
  { v:'vice_president',               l:'Vice-président' },
  { v:'tresorier',                    l:'Trésorier' },
  { v:'tresorier_adjoint',            l:'Trésorier adjoint' },
  { v:'resp_logistique',             l:'Responsable logistique' },
  { v:'resp_logistique_adjoint',     l:'Adjoint logistique' },
  { v:'coord_transport',             l:'Coordinateur transport' },
  { v:'coord_transport_adjoint',     l:'Adjoint coordinateur transport' },
  { v:'coord_medical',               l:'Coordinateur médical' },
  { v:'coord_medical_adjoint',       l:'Adjoint coordinateur médical' },
  { v:'coordinateur_medical',        l:'Coordinateur médical' },
  { v:'recolteur_souhait',           l:'Récolteur de souhait' },
  { v:'coord_benevoles',             l:'Coordinateur bénévoles' },
  { v:'coord_benevoles_adjoint',     l:'Adjoint coordinateur bénévoles' },
  { v:'relations_publiques',         l:'Relations publiques' },
  { v:'relations_publiques_adjoint', l:'Adjoint relations publiques' },
  { v:'resp_informatique',           l:'Responsable informatique' },
  { v:'resp_informatique_adjoint',   l:'Adjoint informatique' },
  { v:'administrateur_asbl',         l:"Administrateur de l'ASBL" },
]

export const SPECIALISATIONS_INF = [
  { v:'siamu',            l:'SIAMU (soins intensifs / urgences)' },
  { v:'oncologie',        l:'Oncologie' },
  { v:'soins_palliatifs', l:'Soins palliatifs' },
  { v:'pediatrie',        l:'Pédiatrie' },
  { v:'geriatrie',        l:'Gériatrie' },
  { v:'sante_mentale',    l:'Santé mentale et psychiatrie' },
  { v:'salle_operation',  l:"Salle d'opération" },
  { v:'anesthesie',       l:'Anesthésie' },
  { v:'autre',            l:'Autre' },
]
