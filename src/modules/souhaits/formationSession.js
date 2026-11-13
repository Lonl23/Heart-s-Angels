/** Superpose la session individuelle sur le dossier de formation partagé. */

export function sessionVide(etat) {
  return !etat || (typeof etat === 'object' && !Object.keys(etat).length)
}

export function fusionMissionDemo(mission, etat, vecteurId, userId) {
  const e = etat && typeof etat === 'object' ? etat : {}
  const next = { ...(mission || {}) }
  const etape = e.etape || 'a_la_base'
  next.etape_terrain = etape
  next.rapport_observations = e.observations || ''
  next.rapport_medical = e.rapport_medical || ''
  next.injections_detresse = Array.isArray(e.injections) ? e.injections : []
  if (vecteurId) {
    next.vecteur_etapes = { ...(next.vecteur_etapes || {}), [vecteurId]: etape }
    next.vecteur_statuts = { ...(next.vecteur_statuts || {}), [vecteurId]: e.vecteur_statut || null }
    next.vecteur_checklists = { ...(next.vecteur_checklists || {}), [vecteurId]: e.checks || {} }
    next.terrain_photos = { ...(next.terrain_photos || {}), [vecteurId]: e.photos || {} }
    next.vecteurs = (next.vecteurs || []).map(v => {
      if (v.id !== vecteurId) return v
      return { ...v, ...(e.releves || {}), ...(e.plaque ? { plaque: e.plaque } : {}) }
    })
  }
  if (userId) {
    next.personnel_statuts = { ...(next.personnel_statuts || {}), [userId]: e.statut_base || '' }
  }
  return next
}

export function fusionRpcDemo(rpc, etat) {
  const e = etat && typeof etat === 'object' ? etat : {}
  const vecteur = rpc?.vecteur
    ? { ...rpc.vecteur, ...(e.releves || {}), ...(e.plaque ? { plaque: e.plaque } : {}) }
    : rpc?.vecteur
  return {
    ...rpc,
    statut: e.statut || 'pret',
    etape_terrain: e.etape || 'a_la_base',
    vecteur_statut: e.vecteur_statut || null,
    photos: e.photos || {},
    check_base: e.checks?.base || {},
    check_pec: e.checks?.pec || {},
    check_retour_pec: e.checks?.retour_pec || {},
    check_retour_base: e.checks?.retour_base || {},
    rapport_observations: e.observations || '',
    statut_base: e.statut_base || '',
    vecteur,
  }
}
