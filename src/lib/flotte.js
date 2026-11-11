/** Véhicules = lieux stock de type vehicule (racine ou enfants). */

export function estVehicule(lieu) {
  return lieu?.type === 'vehicule' || lieu?.type === 'armoire_vehicule'
}

export function labelVehicule(lieu) {
  if (!lieu) return ''
  const plaque = (lieu.plaque || '').trim()
  return plaque ? `${lieu.nom} · ${plaque}` : lieu.nom
}

export function vehiculesDepuisLieux(lieux = []) {
  return (lieux || [])
    .filter(l => l.actif !== false && l.type === 'vehicule')
    .slice()
    .sort((a, b) => (a.nom || '').localeCompare(b.nom || '', 'fr'))
}

/** Parse « Nom · PLAQUE » venant d’anciennes saisies libres. */
export function trouverVehiculeParLabel(lieux, label) {
  if (!label) return null
  const list = vehiculesDepuisLieux(lieux)
  const exact = list.find(l => labelVehicule(l) === label || l.nom === label)
  if (exact) return exact
  return list.find(l => label.includes(l.nom) || (l.plaque && label.includes(l.plaque))) || null
}
