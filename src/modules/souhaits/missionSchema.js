// Configuration de la feuille de mission (reproduit les écrans).
// Chaque groupe = un sous-onglet. Types de champ : text, textarea, toggle,
// number, date, datetime, time, select.

export const GROUPES = [
  { id:'administratif', label:'Administratif', fields:[
    { k:'registre_national', l:'Registre national', t:'text' },
    { k:'patient_adresse', l:'Adresse du domicile du patient', t:'address' },
    { k:'consentement', l:'Consentement', t:'toggle' },
    { k:'autorisation_photos', l:'Autorisation photos', t:'photos' },
    { k:'priorite_elevee', l:'Priorité élevée', t:'toggle' },
    { k:'date_demande', l:'Date demande', t:'date' },
    { k:'origine', l:'Origine', t:'text' },
    { k:'date_rencontre', l:'Date rencontre', t:'datetime' },
    { k:'recolteur', l:'Récolteur de souhait', t:'text' },
    { k:'consignes_equipage', l:'Consignes pour l\'équipage (lues sur le terrain)', t:'textarea' },
  ]},
  { id:'base', label:'Base', fields:[
    { k:'base_nom', l:'Base', t:'text' },
    { k:'base_adresse', l:'Adresse de la base', t:'address' },
    { k:'rdv_base', l:'Heure de rendez-vous', t:'datetime' },
    { k:'depart_base', l:'Heure de départ', t:'datetime' },
  ]},
  { id:'prise_en_charge', label:'Prise en charge', fields:[
    { k:'pec_type', l:'Lieu de prise en charge', t:'select', options:['','Domicile du patient','Institution'] },
    { k:'pec_institution', l:'Nom de l\'institution', t:'text' },
    { k:'pec_adresse', l:'Adresse', t:'address' },
    { k:'pec_service', l:'Service', t:'text' },
    { k:'pec_etage', l:'Étage', t:'text' },
    { k:'pec_aile', l:'Aile / route', t:'text' },
    { k:'pec_chambre', l:'Chambre', t:'text' },
    { k:'arrivee_pec', l:'Heure de prise en charge souhaitée', t:'datetime' },
    { k:'depart_pec', l:'Heure de départ souhaitée', t:'datetime' },
    { k:'pec_precisions', l:'Précisions', t:'textarea' },
  ]},
  { id:'destination', label:'Destination', fields:[
    { k:'dest_adresse', l:'Adresse complète', t:'address' },
    { k:'dest_precisions', l:'Précisions destination', t:'textarea' },
    { k:'arrivee_destination', l:'Heure souhaitée sur place', t:'datetime' },
  ]},
  { id:'retour', label:'Retour', fields:[
    { k:'retour_type', l:'Type de retour', t:'select', options:['','Sur envie du patient','Patient attendu à une heure'] },
    { k:'retour_heure', l:'Heure attendue (si patient attendu)', t:'datetime' },
    { k:'retour_precisions', l:'Précisions retour / planning particulier', t:'textarea' },
  ]},
  { id:'medical', label:'Infos médicales', fields:[
    { k:'allergies', l:'Allergies', t:'textarea' },
    { k:'ne_pas_reanimer', l:'Ne pas réanimer', t:'toggle' },
    { k:'details_acharnement', l:'Détails acharnement', t:'textarea' },
    { k:'pathologies', l:'Pathologies', t:'textarea' },
    { k:'antecedents', l:'Antécédents', t:'textarea' },
    { k:'douleurs', l:'Douleurs', t:'textarea' },
    { k:'voie_acces', l:"Voie d'accès", t:'text' },
    { k:'mobilisations', l:'Mobilisations', t:'textarea' },
    { k:'communication', l:'Communication', t:'textarea' },
    { k:'deglutition', l:'Déglutition', t:'text' },
    { k:'alimentation', l:'Alimentation', t:'text' },
    { k:'continence_urinaire', l:'Continence urinaire', t:'text' },
    { k:'continence_fecale', l:'Continence fécale', t:'text' },
    { k:'precisions_continences', l:'Précisions continences', t:'textarea' },
    { k:'sep', l:'— Paramètres —', t:'sep' },
    { k:'cible_saturation_o2', l:'Cible saturation O2', t:'text' },
    { k:'debit_o2', l:'Débit O2 (L/min)', t:'text' },
    { k:'apport_o2', l:'Apport O2', t:'text' },
    { k:'cible_ta', l:'Cible TA', t:'text' },
    { k:'cible_fc', l:'Cible FC', t:'text' },
  ]},
]

// Checklists terrain. kind : logistique (tout l’équipage du vecteur) |
// médical (seulement infi / médecin / ambulancier) | mixte (medicalItems).
export const CHECKLISTS = {
  base: {
    titre: 'Checklist Base',
    kind: 'logistique',
    items: ['GPS', 'Carte VISA + Essence', 'SN Requis', 'Dégâts véhicule ou pannes'],
  },
  pec: {
    titre: 'Checklist PEC',
    kind: 'medical',
    items: ['Consentement', 'Autorisation photos', 'Feuille de traitements', 'Traitements avec surplus sécurité', 'Protections, sondes et sachet à diurèse (SN)', 'Divers requis'],
  },
  retour_pec: {
    titre: 'Checklist Retour PEC',
    kind: 'mixte',
    items: ['Traitements en surplus rendu', 'Divers patients rendu', 'Si institution, échange draps/matériel', 'Reprise matériels et sacs'],
    medicalItems: ['Traitements en surplus rendu', 'Divers patients rendu', 'Si institution, échange draps/matériel'],
  },
  retour_base: {
    titre: 'Checklist Retour Base',
    kind: 'logistique',
    items: ['Plein du véhicule', 'Rangement matériel (cfr Checklist Base)', 'Remplacement matériel pris dans le véhicule', 'Remise en ordre et nettoyage véhicule', 'Linge sale dans sac de linge', 'Remise des clés et papiers', 'Dégâts ou pannes durant la mission'],
  },
}

export function extrasChecklist(mission, section) {
  const raw = mission?.checklist_extras?.[section]
  if (!Array.isArray(raw)) return []
  return raw.map(x => {
    if (typeof x === 'string') return { id: x, libelle: x, medical: CHECKLISTS[section]?.kind === 'medical' }
    const libelle = (x?.libelle || '').trim()
    if (!libelle) return null
    return { id: x.id || libelle, libelle, medical: !!x.medical }
  }).filter(Boolean)
}

export function itemsChecklistTous(section, mission) {
  const def = CHECKLISTS[section]
  if (!def) return []
  const seen = new Set(def.items)
  const extra = extrasChecklist(mission, section).map(x => x.libelle).filter(l => !seen.has(l))
  return [...def.items, ...extra]
}

export function itemChecklistEstMedical(section, item, mission) {
  const def = CHECKLISTS[section]
  if (!def) return false
  if ((def.items || []).includes(item)) {
    if (def.kind === 'medical') return true
    if (def.kind === 'logistique') return false
    return (def.medicalItems || []).includes(item)
  }
  const ex = extrasChecklist(mission, section).find(x => x.libelle === item)
  if (ex) return !!ex.medical || def.kind === 'medical'
  return def.kind === 'medical'
}

/** Items que CETTE personne doit cocher sur CE vecteur (jamais le médical si pas médical, ou si le vecteur n’a pas de médical). */
export function itemsChecklistVisibles(section, { userMedical, vecteurMedical, mission } = {}) {
  const def = CHECKLISTS[section]
  if (!def) return []
  const items = itemsChecklistTous(section, mission)
  return items.filter(it => {
    const med = itemChecklistEstMedical(section, it, mission)
    if (!med) return true
    return !!(vecteurMedical && userMedical)
  })
}

export function itemsChecklistManquants(section, etat, opts) {
  return itemsChecklistVisibles(section, opts).filter(it => !etat?.[it])
}

export const STATUT_SUR_PLACE = 'arrive'
export function estSurPlace(v) { return v === STATUT_SUR_PLACE }
export function lblStatutBase(v) { return v === STATUT_SUR_PLACE ? 'Sur place' : '' }

/** Véhicule encore à la base : pas un statut d’équipage partagé. */
export const ETAPE_A_LA_BASE = {
  id: 'a_la_base',
  l: 'Sur place',
  chip: 'Sur place',
  lieu: 'base',
  itin: 'base',
  checklist: 'base',
  patient: false,
}

/** Parcours du vecteur (partagé). « Sur place » personnel n’est pas ici. */
export const PARCOURS_TERRAIN = [
  { id:'depart_pec',       l:'Départ vers prise en charge', lieu:'pec',      itin:'pec',          checklist:null,          patient:false },
  { id:'pec_sur_place',    l:'Sur place prise en charge',   lieu:'pec',      itin:'pec',          checklist:'pec',         patient:true },
  { id:'depart_dest',      l:'Départ vers destination',     lieu:'dest',     itin:'destination',  checklist:null,          patient:true },
  { id:'dest_sur_place',   l:'Sur place destination',       lieu:'dest',     itin:'destination',  checklist:null,          patient:true },
  { id:'depart_retour',    l:'Départ retour',               lieu:'retour',   itin:'retour',       checklist:null,          patient:true },
  { id:'retour_sur_place', l:'Sur place retour',            lieu:'retour',   itin:'retour',       checklist:'retour_pec',  patient:true },
  { id:'depart_base',      l:'Départ retour base',          lieu:'base_fin', itin:'base',         checklist:null,          patient:false },
  { id:'base_rentre',      l:'Rentré base',                 lieu:'base_fin', itin:'base',         checklist:'retour_base', patient:false },
]

const ETAPE_LEGACY = {
  pec: 'pec_sur_place',
  retour_pec: 'dest_sur_place',
  retour_base: 'depart_base',
  base_depart: 'depart_pec',
  pec_route: 'depart_pec',
  pec_depart: 'depart_dest',
  dest_route: 'depart_dest',
  dest_depart: 'depart_retour',
  retour_route: 'depart_retour',
}

export function normaliserEtape(etape) {
  if (!etape || etape === 'vehicule' || etape === 'base_sur_place' || etape === 'a_la_base') return 'a_la_base'
  if (ETAPE_LEGACY[etape]) return ETAPE_LEGACY[etape]
  if (PARCOURS_TERRAIN.some(e => e.id === etape)) return etape
  return 'a_la_base'
}

export function estALaBase(etape) {
  return normaliserEtape(etape) === 'a_la_base'
}

export function etapeParId(etape) {
  const id = normaliserEtape(etape)
  if (id === 'a_la_base') return ETAPE_A_LA_BASE
  return PARCOURS_TERRAIN.find(e => e.id === id) || ETAPE_A_LA_BASE
}

export function idxEtape(etape) {
  const id = normaliserEtape(etape)
  if (id === 'a_la_base') return -1
  return PARCOURS_TERRAIN.findIndex(e => e.id === id)
}

export function etapeSuivante(etape) {
  return PARCOURS_TERRAIN[idxEtape(etape) + 1] || null
}

export function etapePrecedente(etape) {
  const i = idxEtape(etape)
  if (i < 0) return null
  if (i === 0) return ETAPE_A_LA_BASE
  return PARCOURS_TERRAIN[i - 1]
}

export function lblEtapeTerrain(etape, vecteurStatut) {
  if (vecteurStatut === 'realise') return 'Rentré base'
  return etapeParId(etape).l
}

export const NB_ECRANS_TERRAIN = PARCOURS_TERRAIN.length + 1

export function numEcranTerrain(etape) {
  return idxEtape(etape) + 2
}

export const O2_LIGNES = ['B10','B10','B5','B5','B2']

export const AUTORISATION_PHOTOS = [
  { v:'refus', l:'Refus catégorique' },
  { v:'oui', l:'Oui' },
  { v:'sans_visage', l:'Oui, sans le visage' },
]

/** Ancien booléen true/false → 3 niveaux. */
export function normaliserAutorisationPhotos(v) {
  if (v === true || v === 'oui' || v === 'true' || v === 'Oui') return 'oui'
  if (v === 'sans_visage' || v === 'oui_sans_visage' || v === 'sans visage') return 'sans_visage'
  if (v === false || v === 'non' || v === 'refus' || v === 'false' || v === 'Refus catégorique') return 'refus'
  if (v == null || v === '') return ''
  return 'refus'
}

export function lblAutorisationPhotos(v) {
  const n = normaliserAutorisationPhotos(v)
  return AUTORISATION_PHOTOS.find(x => x.v === n)?.l || ''
}

export function maintenantIso() {
  return new Date().toISOString()
}

/** Première heure à laquelle ce vecteur a atteint cette étape (ne s’écrase pas). */
export function marquerHeureEtape(mission, vecteurId, etapeId, iso) {
  if (!vecteurId || !etapeId) return mission || {}
  const next = { ...(mission || {}) }
  const all = { ...(next.vecteur_etape_heures || {}) }
  const cur = { ...(all[vecteurId] || {}) }
  if (!cur[etapeId]) cur[etapeId] = iso || maintenantIso()
  all[vecteurId] = cur
  next.vecteur_etape_heures = all
  return next
}

export function heuresEtapeVecteur(mission, vecteurId) {
  if (!mission?.vecteur_etape_heures || !vecteurId) return {}
  return mission.vecteur_etape_heures[vecteurId] || {}
}

/** Première heure « Sur place » du volontaire. */
export function marquerHeurePersonnel(mission, userId, iso) {
  if (!userId) return mission || {}
  const next = { ...(mission || {}) }
  const h = { ...(next.personnel_heures || {}) }
  if (!h[userId]) h[userId] = iso || maintenantIso()
  next.personnel_heures = h
  return next
}

export const VOIES_DETRESSE = [
  { v: 'IV', l: 'IV' },
  { v: 'IM', l: 'IM' },
  { v: 'SC', l: 'SC' },
  { v: 'SL', l: 'SL' },
  { v: 'IN', l: 'IN' },
  { v: 'IO', l: 'IO' },
  { v: 'PO', l: 'Per os' },
  { v: 'nebulisation', l: 'Nébulisation' },
  { v: 'autre', l: 'Autre' },
]
export const lblVoieDetresse = v => VOIES_DETRESSE.find(x => x.v === v)?.l || v || ''

export function protocoleDetresse(mission) {
  const raw = mission?.protocole_detresse
  if (Array.isArray(raw)) return { lignes: raw, notes: '' }
  if (raw && typeof raw === 'object') {
    return { lignes: Array.isArray(raw.lignes) ? raw.lignes : [], notes: raw.notes || '' }
  }
  return { lignes: [], notes: '' }
}

export function injectionsDetresse(mission) {
  return Array.isArray(mission?.injections_detresse) ? mission.injections_detresse : []
}

export const ROLES_PLURI = [
  { v: 'medecin', l: 'Médecin' },
  { v: 'infirmier', l: 'Infirmier(ère)' },
  { v: 'aide_soignant', l: 'Aide-soignant(e)' },
  { v: 'psychologue', l: 'Psychologue' },
  { v: 'kine', l: 'Kinésithérapeute' },
]
export const lblRolePluri = v => ROLES_PLURI.find(x => x.v === v)?.l || v || ''

export function equipePluri(mission) {
  return Array.isArray(mission?.equipe_pluri) ? mission.equipe_pluri : []
}

export function nomPluri(r) {
  if (!r) return ''
  return [r.prenom, r.nom].filter(Boolean).join(' ').trim()
}

export function personnePluriRemplie(r) {
  if (!r) return false
  return !!(nomPluri(r) || (r.tel || '').trim() || (r.organisme || '').trim())
}

/** Premier médecin avec un n° (sinon le premier médecin nommé). */
export function medecinPluri(mission) {
  const rows = equipePluri(mission).filter(r => r.role === 'medecin' && personnePluriRemplie(r))
  return rows.find(r => (r.tel || '').trim()) || rows[0] || null
}
