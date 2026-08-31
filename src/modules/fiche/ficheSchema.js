// Listes de référence de la fiche volontaire.

export const QUALIFS = [
  { v:'ambulancier', l:'Ambulancier' },
  { v:'infirmier',   l:'Infirmier(ère)' },
  { v:'medecin',     l:'Médecin' },
  { v:'kine',        l:'Kiné' },
  { v:'psychologue', l:'Psychologue' },
  { v:'chauffeur',   l:'Chauffeur' },
  { v:'autre',       l:'Autre' },
]

export const ROLES_MISSION = [
  ...QUALIFS,
  { v:'volontaire_non_medical', l:'Volontaire non médical' },
]

export const lblRoleMission = v => ROLES_MISSION.find(r => r.v === v)?.l || v

/** Qualifications utiles en mission, d’après la fiche (pas de saisie à la dispo). */
export function qualsImplicites(role, fiche) {
  const qs = new Set(fiche?.qualifications || [])
  if (['ambulancier_bleu', 'ambulancier_gris'].includes(role)) qs.add('ambulancier')
  if (role === 'infirmier') qs.add('infirmier')
  if (role === 'medecin') qs.add('medecin')
  if (role === 'volontaire_non_medical' || fiche?.type_benevole === 'non_medical') qs.add('volontaire_non_medical')
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
  if (list.includes('volontaire_non_medical')) return 'nonmed'
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
  autre: 'un volontaire',
}

export function phraseIlManque(codes) {
  const bits = (codes || []).map(c => UN[c] || ('un ' + String(c).replace(/_/g, ' ')))
  if (!bits.length) return ''
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
