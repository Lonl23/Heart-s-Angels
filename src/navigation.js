// Menus de l'espace interne, posés sur les modules déjà en ligne.
// Un module sans droit n'est pas listé. Un département disparaît si le
// volontaire ne peut ouvrir aucun de ses modules, sauf s'il est marqué
// toujoursVisible : le département secours reste proposé, même vide.

export const DEPARTEMENTS = [
  {
    id: 'rh',
    label: 'Gestion RH',
    icon: '👥',
    to: '/app/departement/rh',
    modules: [
      { key: 'fiches', to: '/app/volontaires', label: 'Fiches volontaires', icon: '🗂️', desc: 'Invitations, membres et fiches' },
      { key: 'defraiements', to: '/app/defraiements', label: 'Défraiements', icon: '🧾', desc: 'Note de frais : forfait et km' },
      { key: 'annuaire', to: '/app/annuaire', label: 'Annuaire', icon: '📇', desc: 'Bénéficiaires, contacts rattachés, institutions' },
      { key: 'organigramme', to: '/app/rh/organigramme', label: 'Organigramme', icon: '🌳', desc: 'N+1, téléphone et e-mail des responsables' },
      { key: 'evenements', to: '/app/evenements', label: 'Événements internes', icon: '📣', desc: 'Vignettes ASBL : page d’inscription dans l’app' },
    ],
  },
  {
    id: 'souhaits',
    label: 'Département souhaits',
    icon: '⭐',
    to: '/app/departement/souhaits',
    modules: [
      { key: 'souhaits', to: '/app/souhaits', label: 'Préparation souhait', icon: '📝', desc: 'Encoder et préparer les dossiers' },
      { key: 'missions', to: '/app/missions', label: 'Mes souhaits', icon: '🎁', desc: 'Terrain : checklists, démarrer, terminer' },
      { key: 'disponibilites', to: '/app/disponibilites', label: 'Disponibilités', icon: '📅', desc: 'Agenda : vos jours et les missions' },
    ],
  },
  {
    id: 'logistique',
    label: 'Département logistique',
    icon: '📦',
    to: '/app/departement/logistique',
    modules: [
      { key: 'stock', to: '/app/stock', label: 'Stock', icon: '📦', desc: 'Matériel, lieux et mouvements' },
    ],
  },
  {
    id: 'secours',
    label: 'Département secours',
    icon: '🩺',
    to: '/app/departement/secours',
    toujoursVisible: true,
    modules: [],
  },
  {
    id: 'tresorerie',
    label: 'Trésorerie',
    icon: '💶',
    to: '/app/departement/tresorerie',
    modules: [
      { key: 'tresorerie', to: '/app/tresorerie', label: 'Suivi des notes', icon: '💶', desc: 'Notes demandées, autorisées et payées' },
    ],
  },
  {
    id: 'it',
    label: 'IT',
    icon: '⚙️',
    to: '/app/departement/it',
    modules: [
      { key: 'admin', to: '/app/admin', label: 'Administration', icon: '🔐', desc: 'Photos de fond, partenaires et accès' },
      { key: 'organigramme_edition', to: '/app/it/organigramme', label: 'Organigramme', icon: '🌳', desc: 'Choisir les personnes et leur N+1' },
      { key: 'config_souhaits', to: '/app/it/configuration', label: 'Configuration souhaits', icon: '⚙️', desc: 'Bases, institutions, matériel, plaques, destinations' },
    ],
  },
]

export function moduleAutorise(key, auth) {
  if (!auth?.can?.('staff')) return false
  if (key === 'fiches') return auth.peutGererFiches()
  if (key === 'admin' || key === 'organigramme_edition' || key === 'config_souhaits') return auth.peutGererApp()
  if (key === 'organigramme') return true
  if (key === 'tresorerie') return auth.peutGererDefraiements()
  return auth.canAccess(key)
}

export function cheminDepartement(departement) {
  return departement.to || `/app/departement/${departement.id}`
}

export function filtrerDepartements(departements, autoriser) {
  return departements
    .map(d => ({ ...d, modules: d.modules.filter(m => autoriser(m.key)) }))
    .filter(d => d.toujoursVisible || d.modules.length > 0)
}

export function cheminActif(pathname, to) {
  if (!to) return false
  if (to === '/app') return pathname === '/app'
  return pathname === to || pathname.startsWith(to + '/')
}

export function departementActif(pathname, departements) {
  return departements.find(d =>
    cheminActif(pathname, cheminDepartement(d)) || d.modules.some(m => cheminActif(pathname, m.to))
  ) || null
}

export function titrePage(pathname, departements = DEPARTEMENTS) {
  const routes = [
    ...departements.flatMap(d => [
      [cheminDepartement(d), d.label],
      ...d.modules.map(m => [m.to, m.label]),
    ]),
    ['/app/profil', 'Ma fiche'],
    ['/app', 'Accueil'],
  ].sort((a, b) => b[0].length - a[0].length)
  for (const [to, label] of routes) {
    if (cheminActif(pathname, to)) return label
  }
  return 'Espace interne'
}
