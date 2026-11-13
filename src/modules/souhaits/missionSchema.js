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

/**
 * Vecteur sans médical (souvent un VNM seul) : aucune checklist.
 * Terrain = photos, km, essence. Pas d’emport de matériel.
 */
export const CHECKLISTS_VNM_SEUL = {
  base: [],
  pec: [],
  retour_pec: [],
  retour_base: [],
}

/** Items que CETTE personne doit cocher. Un VNM ne voit jamais d’item médical, même avec un équipage médical à bord. */
export function itemsChecklistVisibles(section, { userMedical, vecteurMedical, mission } = {}) {
  const def = CHECKLISTS[section]
  if (!def) return []
  if (!vecteurMedical) return CHECKLISTS_VNM_SEUL[section] || []
  if (!userMedical) {
    return itemsChecklistTous(section, mission).filter(it => !itemChecklistEstMedical(section, it, mission))
  }
  const items = itemsChecklistTous(section, mission)
  return items.filter(it => {
    const med = itemChecklistEstMedical(section, it, mission)
    if (!med) return true
    return !!vecteurMedical
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

/** Hôtel, parking, restaurant… encodés en préparation, jouables sur le terrain. */
export const TYPES_LIEU_ANNEXE = [
  { v: 'hotel', l: 'Hôtel' },
  { v: 'parking', l: 'Parking' },
  { v: 'restaurant', l: 'Restaurant' },
  { v: 'autre', l: 'Autre lieu' },
]
export const lblTypeLieu = v => TYPES_LIEU_ANNEXE.find(t => t.v === v)?.l || 'Lieu'

const RE_ETAPE_LIEU = /^(depart_lieu|lieu_sur_place):(hotel|parking|restaurant|autre):([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/

export function parseEtapeLieu(etape) {
  const m = String(etape || '').match(RE_ETAPE_LIEU)
  if (!m) return null
  return {
    phase: m[1] === 'depart_lieu' ? 'depart' : 'sur_place',
    type: m[2],
    lieuId: m[3],
    id: etape,
  }
}

export function idEtapeLieu(phase, type, lieuId) {
  return `${phase === 'depart' ? 'depart_lieu' : 'lieu_sur_place'}:${type}:${lieuId}`
}

export function lieuxAnnexes(mission) {
  return Array.isArray(mission?.lieux_annexes) ? mission.lieux_annexes.filter(l => l && l.id) : []
}

export function documentsLieu(l) {
  return Array.isArray(l?.documents) ? l.documents.filter(d => d && d.path) : []
}

export function lieuEstWaypoint(l) {
  if (!l || !l.id) return false
  const nom = (l.nom || '').trim()
  const adr = l.adresse && typeof l.adresse === 'object'
    ? !!(l.adresse.rue || l.adresse.localite || l.adresse.cp)
    : false
  if (l.type === 'parking') return !!(nom || adr)
  return l.type === 'hotel' || l.type === 'restaurant' || l.type === 'autre'
}

export function defEtapeLieu(etape, mission) {
  const extra = parseEtapeLieu(etape)
  if (!extra) return null
  const lieu = lieuxAnnexes(mission).find(l => l.id === extra.lieuId)
  const typeL = lblTypeLieu(extra.type)
  const nom = (lieu?.nom || '').trim()
  const cible = nom || typeL
  return {
    id: extra.id,
    l: extra.phase === 'depart' ? `Départ vers ${cible}` : `Sur place ${cible}`,
    chip: extra.phase === 'depart' ? `Vers ${typeL.toLowerCase()}` : typeL,
    lieu: 'annexe',
    itin: 'annexe',
    checklist: null,
    patient: true,
    lieuId: extra.lieuId,
    typeLieu: extra.type,
    phase: extra.phase,
  }
}

export function prochainsTransports(etape, mission) {
  const id = normaliserEtape(etape)
  const extra = parseEtapeLieu(id)
  const waypoints = lieuxAnnexes(mission).filter(lieuEstWaypoint)
  const atDest = id === 'dest_sur_place'
  const atPec = id === 'pec_sur_place'
  const atLieu = extra?.phase === 'sur_place'
  if (!atDest && !atPec && !atLieu) return []
  if (!waypoints.length && !atLieu) return []

  const opts = []
  const seen = new Set()
  const add = o => {
    if (!o?.id || seen.has(o.id)) return
    seen.add(o.id)
    opts.push(o)
  }

  if (!atDest) {
    add({ id: 'depart_dest', l: 'Départ vers destination', hint: 'Lieu de réalisation du souhait' })
  }
  for (const l of waypoints) {
    if (l.id === extra?.lieuId) continue
    const nom = (l.nom || '').trim() || lblTypeLieu(l.type)
    add({
      id: idEtapeLieu('depart', l.type || 'autre', l.id),
      l: `Départ vers ${nom}`,
      hint: lblTypeLieu(l.type),
    })
  }
  if (!atPec) {
    add({ id: 'depart_retour', l: 'Départ vers prise en charge', hint: 'Retour du patient' })
    add({ id: 'depart_base', l: 'Départ retour base', hint: 'Fin de mission' })
  }
  return opts
}

export function besoinChoixTransport(etape, mission) {
  return prochainsTransports(etape, mission).length > 0
}

export function documentsSejourVisibles(etape, mission) {
  const all = lieuxAnnexes(mission).flatMap(l => documentsLieu(l).map(d => ({
    ...d,
    lieuId: l.id,
    lieuNom: (l.nom || '').trim() || lblTypeLieu(l.type),
    typeLieu: l.type,
  })))
  if (!all.length) return []
  const extra = parseEtapeLieu(etape)
  const id = normaliserEtape(etape)
  const priorite = extra?.lieuId
    || ((id === 'dest_sur_place' || id === 'depart_dest') ? 'parking' : null)
  if (!priorite) return all
  return [
    ...all.filter(d => d.lieuId === priorite || d.typeLieu === priorite),
    ...all.filter(d => d.lieuId !== priorite && d.typeLieu !== priorite),
  ]
}

export const ETAPE_DEPART_PLEIN = {
  id: 'depart_plein',
  l: 'Départ pour aller faire le plein',
  chip: 'Plein',
  lieu: 'plein',
  itin: 'base',
  checklist: null,
  patient: false,
}

export function normaliserEtape(etape) {
  if (etape === 'depart_plein') return 'depart_plein'
  if (!etape || etape === 'vehicule' || etape === 'base_sur_place' || etape === 'a_la_base') return 'a_la_base'
  if (ETAPE_LEGACY[etape]) return ETAPE_LEGACY[etape]
  if (parseEtapeLieu(etape)) return etape
  if (PARCOURS_TERRAIN.some(e => e.id === etape)) return etape
  return 'a_la_base'
}

export function estALaBase(etape) {
  return normaliserEtape(etape) === 'a_la_base'
}

export function etapeParId(etape, mission) {
  const extra = defEtapeLieu(etape, mission)
  if (extra) return extra
  const id = normaliserEtape(etape)
  if (id === 'depart_plein') return ETAPE_DEPART_PLEIN
  if (id === 'a_la_base') return ETAPE_A_LA_BASE
  return PARCOURS_TERRAIN.find(e => e.id === id) || ETAPE_A_LA_BASE
}

export function idxEtape(etape) {
  const extra = parseEtapeLieu(etape)
  if (extra) return extra.phase === 'depart' ? idxEtape('depart_dest') : idxEtape('dest_sur_place')
  const id = normaliserEtape(etape)
  if (id === 'a_la_base') return -1
  return PARCOURS_TERRAIN.findIndex(e => e.id === id)
}

export function etapeSuivante(etape, mission) {
  if (normaliserEtape(etape) === 'depart_plein') return etapeParId('depart_pec', mission)
  const extra = parseEtapeLieu(etape)
  if (extra?.phase === 'depart') return etapeParId(idEtapeLieu('sur_place', extra.type, extra.lieuId), mission)
  if (besoinChoixTransport(etape, mission)) return null
  return PARCOURS_TERRAIN[idxEtape(etape) + 1] || null
}

export function etapePrecedente(etape, mission) {
  if (normaliserEtape(etape) === 'depart_plein') return ETAPE_A_LA_BASE
  const extra = parseEtapeLieu(etape)
  if (extra?.phase === 'sur_place') return etapeParId(idEtapeLieu('depart', extra.type, extra.lieuId), mission)
  if (extra?.phase === 'depart') return etapeParId('dest_sur_place', mission)
  const i = idxEtape(etape)
  if (i < 0) return null
  if (i === 0) return ETAPE_A_LA_BASE
  return PARCOURS_TERRAIN[i - 1]
}

/** Patient à bord : sur place PEC jusqu’au départ base (détresse + traitements), y compris hôtel. */
export function etapeProtocoleDetresse(etape) {
  const i = idxEtape(etape)
  return i >= idxEtape('pec_sur_place') && i < idxEtape('depart_base')
}

export function lblEtapeTerrain(etape, vecteurStatut, mission) {
  if (vecteurStatut === 'terminee_terrain') return 'Terminée terrain'
  if (vecteurStatut === 'realise') return 'Rentré base'
  return etapeParId(etape, mission).l
}

/** Étape de CE vecteur. Ne jamais reprendre l’étape globale (souvent celle d’un autre véhicule). */
export function etapeDuVecteur(mission, vecteurId, vecteurStatut) {
  if (vecteurStatut === 'realise' || vecteurStatut === 'terminee_terrain') return 'base_rentre'
  if (vecteurId && mission?.vecteur_etapes && Object.prototype.hasOwnProperty.call(mission.vecteur_etapes, vecteurId)) {
    return normaliserEtape(mission.vecteur_etapes[vecteurId])
  }
  const plusieurs = (mission?.vecteurs || []).filter(v => v?.id).length > 1
  if (vecteurId && plusieurs) return 'a_la_base'
  return normaliserEtape(mission?.etape_terrain)
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

/** Horaires utiles au partenaire : le trajet patient, pas la base. */
export const IDS_HORAIRES_PARTENAIRE = [
  'pec_sur_place', 'depart_dest', 'dest_sur_place', 'depart_retour', 'retour_sur_place',
]

export function defsHorairesPartenaire() {
  return IDS_HORAIRES_PARTENAIRE.map(id => PARCOURS_TERRAIN.find(e => e.id === id)).filter(Boolean)
}

export function heureEtapeVecteur(mission, vecteurId, etapeId) {
  const h = heuresEtapeVecteur(mission, vecteurId)
  if (h[etapeId]) return h[etapeId]
  if (etapeId === 'base_rentre') return mission?.vecteur_clotures?.[vecteurId] || mission?.cloture_le || null
  return null
}

/** Instantané des horaires patient, sans plaque / km / base — pour le rapport partenaire. */
export function snapshotHorairesPartenaire(mission) {
  const vecteurs = Array.isArray(mission?.vecteurs) ? mission.vecteurs : []
  return vecteurs.map(v => ({
    id: v.id,
    nom: [v.nom, v.type_transport].filter(Boolean).join(' · ') || 'Véhicule',
    heures: Object.fromEntries(
      IDS_HORAIRES_PARTENAIRE.map(id => [id, heureEtapeVecteur(mission, v.id, id)])
    ),
  }))
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
  if (Array.isArray(raw)) return { lignes: raw, notes: '', document: null }
  if (raw && typeof raw === 'object') {
    return {
      lignes: Array.isArray(raw.lignes) ? raw.lignes : [],
      notes: raw.notes || '',
      document: raw.document || null,
    }
  }
  return { lignes: [], notes: '', document: null }
}

export function dosesLigne(r) {
  if (Array.isArray(r?.doses) && r.doses.length) return r.doses
  if (r?.dosage) return [{ ordre: 1, dosage: r.dosage }]
  return [{ ordre: 1, dosage: '' }]
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

export function estProfilRecolteur(p) {
  const roles = p?.fiche?.roles_asbl
  return Array.isArray(roles) && roles.includes('recolteur_souhait')
}

export function recolteursDuSouhait(mission) {
  const arr = Array.isArray(mission?.recolteurs) ? mission.recolteurs : []
  const clean = arr.filter(r => r && (r.id || r.nom || r.prenom))
  if (clean.length) return clean
  const t = String(mission?.recolteur || '').trim()
  if (!t) return []
  return t.split(/\s*,\s*/).filter(Boolean).map(nom => ({ id: null, prenom: '', nom }))
}

export function nomsRecolteurs(mission) {
  return recolteursDuSouhait(mission)
    .map(r => [r.prenom, r.nom].filter(Boolean).join(' ').trim())
    .filter(Boolean)
    .join(', ')
}

export function personnePluriRemplie(r) {
  if (!r) return false
  return !!(nomPluri(r) || (r.tel || '').trim() || (r.organisme || '').trim() || r.annuaire_id)
}

export function telephonesPluri(r) {
  if (!r) return []
  return [
    { n: r.tel, p: Number(r.tel_priorite) || 1 },
    { n: r.tel2, p: Number(r.tel2_priorite) || 2 },
    { n: r.tel3, p: Number(r.tel3_priorite) || 3 },
  ].filter(x => String(x.n || '').trim()).sort((a, b) => a.p - b.p)
}

export function telPluri(r) {
  return telephonesPluri(r)[0]?.n || ''
}

/** Médecin de garde en priorité, sinon le premier médecin joignable. */
export function medecinPluri(mission) {
  const rows = equipePluri(mission).filter(r => r.role === 'medecin' && personnePluriRemplie(r))
  const garde = rows.find(r => r.type_medecin === 'garde' && telPluri(r))
  if (garde) return garde
  return rows.find(r => telPluri(r)) || rows[0] || null
}
