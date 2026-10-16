import { canonRoleAsbl, lblRoleAsbl } from '@/modules/fiche/ficheSchema'

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
  resp_informatique: 'Coordinateur informatique',
  resp_informatique_adjoint: 'Coordinateur informatique adjoint',
}

export function rolesDe(personne) {
  return [...new Set((personne?.fiche?.roles_asbl || []).map(canonRoleAsbl).filter(r => r && r !== 'simple_volontaire'))]
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

export function nomPersonne(p) {
  return `${p?.prenom || ''} ${p?.nom || ''}`.trim()
}

export function vuePersonne(p) {
  const roles = rolesDe(p)
  return {
    id: p.id,
    prenom: p.prenom || '',
    nom: p.nom || '',
    photo: p.fiche?.photo_url || '',
    email: texte(p.email),
    telephone: texte(p.fiche?.telephone) || texte(p.telephone),
    actif: p.actif !== false,
    labels: libelles(roles),
    aUnRole: roles.length > 0,
  }
}

function comparer(a, b) {
  return nomPersonne(a).localeCompare(nomPersonne(b), 'fr')
}

/**
 * Arbre composé dans IT. liens = { profile_id, n1_id, ordre }.
 * Une personne sans rôle ASBL n’est pas dessinée : c’est un volontaire, le N.
 * Le niveau se compte depuis lui : la personne juste au-dessus est N+1,
 * celle encore au-dessus est N+2.
 */
export function arbrePlace(personnes, liens) {
  const vues = (personnes || []).map(vuePersonne).filter(v => v.aUnRole && v.actif)
  const parId = new Map(vues.map(v => [v.id, v]))
  const places = new Map()
  for (const l of liens || []) {
    if (!parId.has(l.profile_id)) continue
    places.set(l.profile_id, {
      profile_id: l.profile_id,
      n1_id: l.n1_id || null,
      ordre: Number(l.ordre) || 0,
      n1Volontaires: !!l.n1_volontaires,
    })
  }
  for (const l of places.values()) {
    if (!l.n1_id || !places.has(l.n1_id)) l.n1_id = null
  }

  function enfantsDe(id) {
    return [...places.values()]
      .filter(l => l.n1_id === id)
      .sort((a, b) => a.ordre - b.ordre || comparer(parId.get(a.profile_id), parId.get(b.profile_id)))
  }

  function noeud(lien, vus) {
    if (vus.has(lien.profile_id)) return null
    const suivant = new Set(vus)
    suivant.add(lien.profile_id)
    const enfants = enfantsDe(lien.profile_id).map(e => noeud(e, suivant)).filter(Boolean)
    const personne = { ...parId.get(lien.profile_id), n1Volontaires: lien.n1Volontaires }
    return { key: lien.profile_id, gens: [personne], enfants }
  }

  return annoterDepuisVolontaire(enfantsDe(null).map(l => noeud(l, new Set())).filter(Boolean))
}

/**
 * Le volontaire est le N. Les personnes cochées « N+1 des volontaires » sont
 * le cran juste au-dessus de lui. Chaque personne au-dessus d’elles monte d’un cran.
 */
function annoterDepuisVolontaire(noeuds) {
  function walk(n) {
    const enfants = n.enfants.map(walk)
    const p = n.gens[0]
    const sous = enfants.map(e => e.gens[0].niveau).filter(v => v > 0)
    const niveau = p.n1Volontaires ? 1 : (sous.length ? Math.max(...sous) + 1 : 0)
    return { ...n, enfants, gens: [{ ...p, niveau }] }
  }
  return noeuds.map(walk)
}

/** Liste plate, dans l’ordre de l’arbre, pour l’écran IT. */
export function listePlacee(personnes, liens) {
  const lignes = []
  function walk(noeuds, chaine) {
    const ids = noeuds.map(n => n.gens[0].id)
    noeuds.forEach((n, index) => {
      const p = n.gens[0]
      lignes.push({ personne: p, chaine, index, siblingIds: ids })
      walk(n.enfants, [nomPersonne(p), ...chaine])
    })
  }
  walk(arbrePlace(personnes, liens), [])
  return lignes
}
