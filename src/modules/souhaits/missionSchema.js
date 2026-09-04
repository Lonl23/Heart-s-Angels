// Configuration de la feuille de mission (reproduit les écrans).
// Chaque groupe = un sous-onglet. Types de champ : text, textarea, toggle,
// number, date, datetime, time, select.

export const GROUPES = [
  { id:'administratif', label:'Administratif', fields:[
    { k:'registre_national', l:'Registre national', t:'text' },
    { k:'patient_adresse', l:'Adresse du domicile du patient', t:'address' },
    { k:'consentement', l:'Consentement', t:'toggle' },
    { k:'autorisation_photos', l:'Autorisation photos', t:'toggle' },
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

export const STATUTS_BASE = [
  { v: 'en_route', l: 'En chemin' },
  { v: 'arrive',   l: 'Arrivé à la base' },
  { v: 'pret',     l: 'Prêt' },
]

export const lblStatutBase = v => STATUTS_BASE.find(s => s.v === v)?.l || ''

/** Parcours terrain : sur place, puis départ vers le lieu suivant. */
export const PARCOURS_TERRAIN = [
  { id:'base_sur_place',   l:'Sur place Base',            chip:'Sur place Base',     lieu:'base',     itin:'base',         checklist:'base',        patient:false },
  { id:'depart_pec',       l:'Départ vers prise en charge', chip:'Départ → PEC',    lieu:'pec',      itin:'pec',          checklist:'base',        patient:false },
  { id:'pec_sur_place',    l:'Sur place prise en charge', chip:'Sur place PEC',      lieu:'pec',      itin:'pec',          checklist:'pec',         patient:true },
  { id:'depart_dest',      l:'Départ vers destination',   chip:'Départ → dest.',     lieu:'dest',     itin:'destination',  checklist:'pec',         patient:true },
  { id:'dest_sur_place',   l:'Sur place destination',     chip:'Sur place dest.',    lieu:'dest',     itin:'destination',  checklist:null,          patient:true },
  { id:'depart_retour',    l:'Départ retour',             chip:'Départ retour',      lieu:'retour',   itin:'retour',       checklist:null,          patient:true },
  { id:'retour_sur_place', l:'Sur place retour',          chip:'Sur place retour',   lieu:'retour',   itin:'retour',       checklist:'retour_pec',  patient:true },
  { id:'depart_base',      l:'Départ retour base',        chip:'Départ → base',      lieu:'base_fin', itin:'base',         checklist:'retour_pec',  patient:false },
  { id:'base_rentre',      l:'Rentré base',               chip:'Rentré base',        lieu:'base_fin', itin:'base',         checklist:'retour_base', patient:false },
]

const ETAPE_LEGACY = {
  vehicule: 'base_sur_place',
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
  if (!etape) return 'base_sur_place'
  if (ETAPE_LEGACY[etape]) return ETAPE_LEGACY[etape]
  if (PARCOURS_TERRAIN.some(e => e.id === etape)) return etape
  return 'base_sur_place'
}

export function etapeParId(etape) {
  const id = normaliserEtape(etape)
  return PARCOURS_TERRAIN.find(e => e.id === id) || PARCOURS_TERRAIN[0]
}

export function idxEtape(etape) {
  return PARCOURS_TERRAIN.findIndex(e => e.id === normaliserEtape(etape))
}

export function etapeSuivante(etape) {
  return PARCOURS_TERRAIN[idxEtape(etape) + 1] || null
}

export function lblEtapeTerrain(etape, vecteurStatut) {
  if (vecteurStatut === 'realise') return 'Rentré base'
  return etapeParId(etape).l
}

export const O2_LIGNES = ['B10','B10','B5','B5','B2']
