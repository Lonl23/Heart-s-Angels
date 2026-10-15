// Droits d'ouverture des modules. Pur : même résultat dans le menu, les routes
// et les tests. La page d'un département ne liste que les modules autorisés.
// Un département vide est masqué, sauf le département secours (navigation.js).

const STAFF = ['admin','president','coordinateur','ambulancier_bleu','ambulancier_gris',
               'infirmier','medecin','volontaire_non_medical','tresorier','secretaire']
const ADMINS  = ['admin','president']
const MEDICAL = ['admin','president','medecin','infirmier']
const BASE = ['dashboard','missions','defraiements','disponibilites']
const ROLES_TOTAL = ['president','vice_president','resp_informatique','resp_informatique_adjoint','administrateur_asbl']

export function calculerDroits(profile, matrix = {}) {
  const role = profile?.role || null
  const fiche = profile?.fiche || {}
  const roles = Array.isArray(fiche.roles_asbl) ? fiche.roles_asbl : []
  const quals = Array.isArray(fiche.qualifications) ? fiche.qualifications : []

  function accesTotal() {
    if (ADMINS.includes(role)) return true
    return roles.some(r => ROLES_TOTAL.includes(r))
  }
  function estMedical() {
    if (['medecin','infirmier','ambulancier_bleu','ambulancier_gris'].includes(role)) return true
    return fiche.type_benevole === 'medical'
  }
  function peutGererSouhaits() {
    if (!role || role === 'partenaire') return false
    if (accesTotal() || role === 'coordinateur') return true
    return roles.some(r => ['coord_transport','coord_transport_adjoint','coord_medical','coord_medical_adjoint','recolteur_souhait'].includes(r))
  }
  function peutVoirSouhaitComplet() { return peutGererSouhaits() || estMedical() }
  function peutGererFiches() {
    if (accesTotal()) return true
    return roles.some(r => ['coord_benevoles','coord_benevoles_adjoint'].includes(r))
  }
  function peutVoirToutesDispos() {
    if (!role || role === 'partenaire') return false
    if (accesTotal() || role === 'coordinateur') return true
    return roles.some(r => [
      'president','vice_president',
      'coord_transport','coord_transport_adjoint',
      'recolteur_souhait',
      'coord_benevoles','coord_benevoles_adjoint',
    ].includes(r))
  }
  function peutGererDispos() {
    if (!role || role === 'partenaire') return false
    if (accesTotal() || role === 'coordinateur') return true
    return roles.some(r => [
      'president','vice_president',
      'coord_transport','coord_transport_adjoint',
      'coord_benevoles','coord_benevoles_adjoint',
    ].includes(r))
  }
  function peutGererStock() {
    if (!role || role === 'partenaire') return false
    if (accesTotal() || role === 'coordinateur') return true
    return roles.some(r => [
      'president','vice_president',
      'resp_logistique','resp_logistique_adjoint',
    ].includes(r))
  }
  function peutVoirSecours() {
    if (!role || role === 'partenaire') return false
    if (accesTotal() || role === 'coordinateur') return true
    if (estMedical()) return true
    if (roles.some(r => ['coord_medical','coord_medical_adjoint','coordinateur_medical'].includes(r))) return true
    return quals.includes('secouriste') || quals.includes('ambulancier')
  }
  function peutVoirTresorerie() {
    if (!role || role === 'partenaire') return false
    if (accesTotal() || role === 'tresorier') return true
    return roles.some(r => r === 'tresorier' || r === 'tresorier_adjoint')
  }
  function can(perm) {
    if (!role) return false
    if (perm === 'admin') return ADMINS.includes(role) || accesTotal()
    if (perm === 'medical') return MEDICAL.includes(role)
    if (perm === 'staff') return STAFF.includes(role)
    if (perm === 'partenaire') return role === 'partenaire'
    return STAFF.includes(role)
  }
  function canAccess(feature) {
    if (!role || role === 'partenaire') return false
    if (ADMINS.includes(role) || accesTotal()) return true
    if (BASE.includes(feature)) return true
    if (feature === 'souhaits') return peutGererSouhaits()
    const sujets = [
      fiche.type_benevole && ['type', fiche.type_benevole],
      ...quals.map(q => ['qualif', q]),
      ...roles.map(r => ['role', r]),
    ].filter(Boolean)
    return sujets.some(([d, sj]) => matrix[`${d}:${sj}:${feature}`] === true)
  }
  function peutOuvrir(feature) {
    if (!role || role === 'partenaire') return false
    if (feature === 'fiches') return peutGererFiches()
    if (feature === 'organigramme') return can('staff')
    if (feature === 'secours') return peutVoirSecours()
    if (feature === 'tresorerie') return peutVoirTresorerie()
    if (feature === 'admin') return can('admin')
    if (feature === 'stock') return canAccess(feature) && peutGererStock()
    return canAccess(feature)
  }
  function estVolontaireNonMedical() {
    if (peutVoirToutesDispos()) return false
    const t = fiche.type_benevole
    if (t === 'medical') return false
    return t === 'non_medical' || role === 'volontaire_non_medical'
  }

  return {
    can, canAccess, accesTotal, estMedical, peutGererSouhaits, peutVoirSouhaitComplet,
    peutGererFiches, peutVoirToutesDispos, peutGererDispos, peutGererStock,
    peutVoirSecours, peutVoirTresorerie, peutOuvrir, estVolontaireNonMedical,
  }
}
