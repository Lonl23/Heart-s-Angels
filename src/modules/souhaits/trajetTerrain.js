/** Helpers trajet terrain — sans import UI (évite cycle Vite / écran noir). */

function fmtAdresseLocal(a) {
  if (!a || typeof a !== 'object') return typeof a === 'string' ? a : ''
  const l1 = [a.rue, a.numero].filter(Boolean).join(' ')
  const l2 = [a.cp, a.localite].filter(Boolean).join(' ')
  return [l1, l2, a.pays].filter(Boolean).join(', ')
}

function texteGpsLocal(a) {
  if (!a) return ''
  if (typeof a === 'string') return a.trim()
  return fmtAdresseLocal(a)
}

/** Clé normalisée pour comparer deux adresses. */
export function cleAdresse(a) {
  return texteGpsLocal(a).toLowerCase().replace(/\s+/g, ' ').trim()
}

export function memeAdresse(a, b) {
  const ca = cleAdresse(a)
  const cb = cleAdresse(b)
  if (!ca || !cb) return false
  return ca === cb
}

export function adressePecMission(mission) {
  if (!mission) return null
  return mission.pec_type === 'Domicile du patient' ? mission.patient_adresse : mission.pec_adresse
}

/**
 * Arrêts qui nécessitent le véhicule (adresses différentes).
 * Les activités sans adresse distincte restent « sur place » rattachées à l’arrêt précédent.
 */
export function arretsVehicule(mission) {
  const stops = []
  const destAdr = mission?.dest_adresse
  if (fmtAdresseLocal(destAdr) || (mission?.dest_nom || '').trim()) {
    stops.push({
      key: 'dest',
      nom: (mission.dest_nom || '').trim() || 'Destination',
      adresse: destAdr,
      heure: mission.arrivee_destination || '',
      telephone: '',
      notes: mission.dest_precisions || '',
      activitesSurPlace: [],
    })
  }
  for (const a of (Array.isArray(mission?.activites_sur_place) ? mission.activites_sur_place : [])) {
    if (!a) continue
    const last = stops[stops.length - 1]
    const hasAdr = !!fmtAdresseLocal(a.adresse)
    if (!hasAdr || (last && memeAdresse(a.adresse, last.adresse))) {
      if (last) last.activitesSurPlace.push(a)
      else {
        stops.push({
          key: a.id || 'act-0',
          nom: (a.nom || '').trim() || 'Destination',
          adresse: a.adresse || null,
          heure: a.heure || '',
          telephone: a.telephone || '',
          notes: a.notes || '',
          activitesSurPlace: [],
        })
      }
      continue
    }
    stops.push({
      key: a.id,
      nom: (a.nom || '').trim() || 'Destination',
      adresse: a.adresse,
      heure: a.heure || '',
      telephone: a.telephone || '',
      notes: a.notes || '',
      activitesSurPlace: [],
    })
  }
  return stops
}

export function indexArretCourant(etape, mission) {
  const stops = arretsVehicule(mission)
  if (!stops.length) return -1
  const id = String(etape || '')
  const m = id.match(/^(?:depart_activite|activite_sur_place):(.+)$/)
  if (m) {
    const i = stops.findIndex(s => s.key === m[1])
    return i >= 0 ? i : -1
  }
  if (id === 'depart_dest' || id === 'dest_sur_place') return 0
  return -1
}

export function arretParKey(mission, key) {
  return arretsVehicule(mission).find(s => s.key === key) || null
}

export function idDepartArret(stop) {
  if (!stop) return 'depart_dest'
  return stop.key === 'dest' ? 'depart_dest' : `depart_activite:${stop.key}`
}

export function idSurPlaceArret(stop) {
  if (!stop) return 'dest_sur_place'
  return stop.key === 'dest' ? 'dest_sur_place' : `activite_sur_place:${stop.key}`
}

/**
 * Cible Google Maps / Waze selon l’étape terrain du véhicule.
 * — Base / en route PEC → adresse PEC
 * — Sur place PEC / en route 1ʳᵉ dest → 1ʳᵉ destination
 * — Entre destinations véhicule → prochaine destination
 * — Dernière dest / départ retour → PEC
 * — Sur place retour / départ base → base
 */
export function navCibleTerrain(etape, mission) {
  const id = String(etape || '')
  const pec = adressePecMission(mission)
  const base = mission?.base_adresse
  const stops = arretsVehicule(mission)
  const first = stops[0] || null

  if (id === 'a_la_base' || id === 'depart_plein' || id === 'depart_pec') {
    return {
      mode: 'nav',
      titre: 'Vers la prise en charge',
      sousTitre: mission?.pec_institution || mission?.pec_type || 'Prise en charge',
      adresse: pec,
      heure: mission?.arrivee_pec || '',
      telephone: '',
      notes: '',
    }
  }

  if (id === 'pec_sur_place' || id === 'depart_dest') {
    if (!first) {
      return {
        mode: 'nav',
        titre: 'Vers le retour prise en charge',
        sousTitre: 'Pas de destination encodée',
        adresse: pec,
        heure: mission?.retour_heure || '',
        telephone: '',
        notes: '',
      }
    }
    return {
      mode: 'nav',
      titre: `Vers ${first.nom}`,
      sousTitre: first.notes || 'Destination',
      adresse: first.adresse,
      heure: first.heure,
      telephone: first.telephone,
      notes: first.notes,
      arret: first,
    }
  }

  const depAct = id.match(/^depart_activite:(.+)$/)
  if (depAct) {
    const stop = arretParKey(mission, depAct[1])
    if (stop) {
      return {
        mode: 'nav',
        titre: `Vers ${stop.nom}`,
        sousTitre: 'Prochaine destination',
        adresse: stop.adresse,
        heure: stop.heure,
        telephone: stop.telephone,
        notes: stop.notes,
        arret: stop,
      }
    }
  }

  const surAct = id.match(/^activite_sur_place:(.+)$/)
  if (id === 'dest_sur_place' || surAct) {
    const idx = id === 'dest_sur_place' ? 0 : stops.findIndex(s => s.key === surAct[1])
    const courant = idx >= 0 ? stops[idx] : null
    const suivant = idx >= 0 ? stops[idx + 1] : null
    if (suivant) {
      return {
        mode: 'nav',
        titre: `Ensuite : ${suivant.nom}`,
        sousTitre: 'Prochain déplacement véhicule',
        adresse: suivant.adresse,
        heure: suivant.heure,
        telephone: suivant.telephone,
        notes: suivant.notes,
        arret: suivant,
        courant,
      }
    }
    return {
      mode: 'nav',
      titre: 'Retour prise en charge',
      sousTitre: 'Dernière destination — rentrer le patient',
      adresse: pec,
      heure: mission?.retour_heure || '',
      telephone: '',
      notes: mission?.retour_precisions || '',
      courant,
    }
  }

  if (id === 'depart_retour') {
    return {
      mode: 'nav',
      titre: 'Retour prise en charge',
      sousTitre: mission?.pec_institution || mission?.pec_type || 'Prise en charge',
      adresse: pec,
      heure: mission?.retour_heure || '',
      telephone: '',
      notes: mission?.retour_precisions || '',
    }
  }

  if (id === 'retour_sur_place' || id === 'depart_base') {
    return {
      mode: 'nav',
      titre: 'Retour base',
      sousTitre: mission?.base_nom || 'Base',
      adresse: base,
      heure: '',
      telephone: '',
      notes: '',
    }
  }

  return null
}

/** Peut-on sauter le reste des destinations pour un retour d’urgence ? */
export function peutRetourUrgence(etape, mission) {
  const id = String(etape || '')
  if (id === 'depart_retour' || id === 'retour_sur_place' || id === 'depart_base' || id === 'base_rentre') return false
  if (id === 'a_la_base' || id === 'depart_plein' || id === 'depart_pec') return false
  const stops = arretsVehicule(mission)
  const i = indexArretCourant(etape, mission)
  if (id === 'pec_sur_place' || id === 'depart_dest') return stops.length > 1
  if (i >= 0) return (i < stops.length - 1) || stops.length > 1
  return id.startsWith('depart_lieu:') || id.startsWith('lieu_sur_place:')
}
