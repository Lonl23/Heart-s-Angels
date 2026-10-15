// Menus de l'espace interne. Un département n'est proposé que si le volontaire
// peut ouvrir au moins un de ses modules. Les modules sans droit ne sont pas
// listés : un département vide disparaît donc entièrement.

export const DEPARTEMENTS = [
  {
    id: 'rh',
    label: 'Gestion RH',
    icon: '👥',
    modules: [
      { key: 'fiches', to: '/app/rh/fiches', label: 'Fiches volontaires', icon: '🗂️', desc: 'Consulter et mettre à jour les fiches' },
      { key: 'defraiements', to: '/app/defraiements', label: 'Défraiements', icon: '🧾', desc: 'Frais, validation et paiement' },
      { key: 'annuaire', to: '/app/annuaire', label: 'Annuaire', icon: '📇', desc: 'Contacts et institutions' },
      { key: 'organigramme', to: '/app/rh/organigramme', label: 'Organigramme', icon: '🌳', desc: 'Rôles et responsabilités dans l’ASBL' },
    ],
  },
  {
    id: 'souhaits',
    label: 'Département souhaits',
    icon: '⭐',
    modules: [
      { key: 'souhaits', to: '/app/souhaits', label: 'Préparation souhait', icon: '📝', desc: 'Encoder et préparer les dossiers' },
      { key: 'missions', to: '/app/missions', label: 'Mes souhaits', icon: '🎁', desc: 'Les souhaits qui vous sont confiés' },
      { key: 'disponibilites', to: '/app/disponibilites', label: 'Disponibilités', icon: '📅', desc: 'Vos jours et les missions' },
    ],
  },
  {
    id: 'logistique',
    label: 'Département logistique',
    icon: '📦',
    modules: [
      { key: 'stock', to: '/app/stock', label: 'Stock', icon: '📦', desc: 'Matériel, lieux et mouvements' },
    ],
  },
  {
    id: 'secours',
    label: 'Département secours',
    icon: '🩺',
    modules: [
      { key: 'secours', to: '/app/secours', label: 'Interventions', icon: '🚑', desc: 'Terrain : checklists, démarrer, terminer' },
    ],
  },
  {
    id: 'tresorerie',
    label: 'Trésorerie',
    icon: '💶',
    modules: [
      { key: 'tresorerie', to: '/app/tresorerie', label: 'Suivi des frais', icon: '💶', desc: 'Montants en attente, validés et payés' },
    ],
  },
  {
    id: 'it',
    label: 'IT',
    icon: '⚙️',
    modules: [
      { key: 'admin', to: '/app/admin', label: 'Administration', icon: '🔐', desc: 'Membres, partenaires et droits d’accès' },
    ],
  },
]

export function filtrerDepartements(departements, autoriser) {
  return departements
    .map(d => ({ ...d, modules: d.modules.filter(m => autoriser(m.key)) }))
    .filter(d => d.modules.length > 0)
}

export function cheminActif(pathname, to) {
  if (!to) return false
  if (to === '/app') return pathname === '/app'
  return pathname === to || pathname.startsWith(to + '/')
}

export function departementActif(pathname, departements) {
  return departements.find(d => d.modules.some(m => cheminActif(pathname, m.to))) || null
}

export function titrePage(pathname, departements = DEPARTEMENTS) {
  const routes = [
    ...departements.flatMap(d => d.modules.map(m => [m.to, m.label])),
    ['/app/profil', 'Ma fiche'],
    ['/app', 'Tableau de bord'],
  ].sort((a, b) => b[0].length - a[0].length)
  for (const [to, label] of routes) {
    if (cheminActif(pathname, to)) return label
  }
  return 'Espace interne'
}
