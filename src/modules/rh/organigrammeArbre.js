import { canonRoleAsbl, lblRoleAsbl } from '@/modules/fiche/ficheSchema'

/** Siège retenu pour placer la personne une seule fois. Le premier gagne. */
const PRIORITE = [
  'president',
  'vice_president',
  'resp_logistique',
  'coord_transport',
  'coord_medical',
  'resp_informatique',
  'coord_medical_adjoint',
  'resp_logistique_adjoint',
  'coord_transport_adjoint',
  'coord_benevoles',
  'tresorier',
  'relations_publiques',
  'recolteur_souhait',
  'administrateur_asbl',
  'coord_benevoles_adjoint',
  'tresorier_adjoint',
  'relations_publiques_adjoint',
  'resp_informatique_adjoint',
]

/** Enfants d’un siège. Un siège vide laisse remonter ses enfants. */
const ENFANTS = {
  president: ['vice_president', 'resp_logistique', 'coord_medical', 'coord_transport', 'resp_informatique'],
  vice_president: ['relations_publiques', 'administrateur_asbl', 'coord_benevoles', 'tresorier', 'recolteur_souhait'],
  resp_logistique: ['resp_logistique_adjoint'],
  coord_transport: ['coord_transport_adjoint'],
  coord_medical: ['coord_medical_adjoint'],
  coord_benevoles: ['coord_benevoles_adjoint'],
  tresorier: ['tresorier_adjoint'],
  relations_publiques: ['relations_publiques_adjoint'],
  resp_informatique: ['resp_informatique_adjoint'],
}

const ORDRE_LIBELLES = [
  'administrateur_asbl',
  'president',
  'vice_president',
  'coord_medical',
  'coord_medical_adjoint',
  'resp_logistique',
  'resp_logistique_adjoint',
  'coord_transport',
  'coord_transport_adjoint',
  'coord_benevoles',
  'coord_benevoles_adjoint',
  'tresorier',
  'tresorier_adjoint',
  'relations_publiques',
  'relations_publiques_adjoint',
  'recolteur_souhait',
  'resp_informatique',
  'resp_informatique_adjoint',
]

const LIBELLES = {
  administrateur_asbl: 'Administrateur',
  vice_president: 'Vice-président',
  resp_logistique: 'Coordinateur logistique',
  resp_logistique_adjoint: 'Coordinateur logistique adjoint',
  coord_transport: 'Coordinateur transports',
  coord_transport_adjoint: 'Coordinateur transports adjoint',
  coord_medical_adjoint: 'Coordinateur médical adjoint',
  coord_benevoles: 'Coordinateur des bénévoles',
  coord_benevoles_adjoint: 'Adjoint coordinateur des bénévoles',
  tresorier_adjoint: 'Adjoint comptabilité',
  recolteur_souhait: 'Récolteur de souhaits',
}

export function rolesDe(personne) {
  return [...new Set((personne?.fiche?.roles_asbl || []).map(canonRoleAsbl).filter(r => r && r !== 'simple_volontaire'))]
}

function siegeDe(roles) {
  return PRIORITE.find(r => roles.includes(r)) || null
}

function libelles(roles) {
  const restants = new Set(roles)
  const ordre = [
    ...ORDRE_LIBELLES.filter(r => restants.has(r)),
    ...roles.filter(r => !ORDRE_LIBELLES.includes(r)),
  ]
  return ordre.map(r => LIBELLES[r] || lblRoleAsbl(r))
}

function texte(v) {
  return String(v || '').trim()
}

function personneVue(p) {
  const roles = rolesDe(p)
  return {
    id: p.id,
    prenom: p.prenom || '',
    nom: p.nom || '',
    photo: p.fiche?.photo_url || '',
    email: texte(p.email),
    telephone: texte(p.fiche?.telephone) || texte(p.telephone),
    siege: siegeDe(roles),
    labels: libelles(roles),
  }
}

function comparer(a, b) {
  return `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`, 'fr')
}

/**
 * Arbre : président en haut, puis les responsables, puis leur équipe.
 * La personne juste au-dessus est le N+1, celle encore au-dessus le N+2.
 * Chaque personne n’apparaît qu’une fois, avec tous ses rôles.
 * Un simple volontaire, ou une fiche sans rôle ASBL, n’a pas de siège : il est omis.
 */
export function construireArbre(gens) {
  const parSiege = new Map()
  for (const p of gens || []) {
    const vue = personneVue(p)
    if (!vue.siege) continue
    const liste = parSiege.get(vue.siege) || []
    liste.push(vue)
    parSiege.set(vue.siege, liste)
  }
  for (const liste of parSiege.values()) liste.sort(comparer)

  function branches(siege) {
    const occupants = parSiege.get(siege) || []
    const sous = (ENFANTS[siege] || []).flatMap(branches)
    if (!occupants.length) return sous
    if (!sous.length) {
      return occupants.map(p => ({ key: p.id, gens: [p], enfants: [] }))
    }
    return [
      { key: siege, gens: [occupants[0]], enfants: sous },
      ...occupants.slice(1).map(p => ({ key: p.id, gens: [p], enfants: [] })),
    ]
  }

  return branches('president')
}
