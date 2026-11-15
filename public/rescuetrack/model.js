// © 2026 Heart's Angels ASBL & Laurent Noulin — Tous droits réservés.
// Fiches des préventifs uniquement. Aucun lien avec un dossier de souhait.

export const CODES_PROVINCE = {
  'Liège': 'LIE', 'Namur': 'NAM', 'Hainaut': 'HAI', 'Luxembourg': 'LUX',
  'Bruxelles': 'BRU', 'Brabant wallon': 'BWA', 'Brabant flamand': 'BFL',
  'Anvers': 'ANV', 'Limbourg': 'LIM', 'Flandre orientale': 'FOR', 'Flandre occidentale': 'FOC',
}

export const LIBELLES_DISPOSITIF = {
  paps: 'PAPS', ps: 'Poste de secours', echo: 'Écho',
  pma_cat2: 'PMA cat. 2', pma_cat1: 'PMA cat. 1', pma_cat0: 'PMA cat. 0',
  ambu_112: 'Ambulance 112', ambu: 'Ambulance',
}

export const TRIAGES = ['U1', 'U2', 'U3H', 'U3NH', 'IMPLIQUE', 'DCD']

export const TRIAGE_LIBELLES = {
  U1: 'Urgence vitale',
  U2: 'Urgence relative',
  U3H: 'Non urgent, hôpital',
  U3NH: 'Non urgent, sans hôpital',
  IMPLIQUE: 'Impliqué',
  DCD: 'Décès',
}

export function estPreventif(activite) {
  if (!activite) return false
  if (activite.type === 'preventif') return true
  if (activite.dispositif) return true
  return Array.isArray(activite.dispositifs) && activite.dispositifs.length > 0
}

export function provinceDepuisCp(cp) {
  const m = String(cp || '').match(/(\d{4})/)
  if (!m) return ''
  const n = Number(m[1])
  if (n >= 1000 && n <= 1299) return 'Bruxelles'
  if (n >= 1300 && n <= 1499) return 'Brabant wallon'
  if ((n >= 1500 && n <= 1999) || (n >= 3000 && n <= 3499)) return 'Brabant flamand'
  if (n >= 2000 && n <= 2999) return 'Anvers'
  if (n >= 3500 && n <= 3999) return 'Limbourg'
  if (n >= 4000 && n <= 4999) return 'Liège'
  if (n >= 5000 && n <= 5999) return 'Namur'
  if ((n >= 6000 && n <= 6599) || (n >= 7000 && n <= 7999)) return 'Hainaut'
  if (n >= 6600 && n <= 6999) return 'Luxembourg'
  if (n >= 8000 && n <= 8999) return 'Flandre occidentale'
  if (n >= 9000 && n <= 9999) return 'Flandre orientale'
  return ''
}

export function provinceDuneActivite(activite) {
  if (!activite) return ''
  return provinceDepuisCp(activite.adresse_cp) || provinceDepuisCp(activite.adresse) || provinceDepuisCp(activite.lieu) || ''
}

export function codeProvince(nom) {
  return CODES_PROVINCE[nom] || 'XXX'
}

export function unitesDuPreventif(activite) {
  const raw = Array.isArray(activite?.dispositifs) && activite.dispositifs.length
    ? activite.dispositifs
    : (activite?.dispositif ? [activite.dispositif] : [])
  const totaux = {}
  raw.forEach(code => { totaux[code] = (totaux[code] || 0) + 1 })
  const vus = {}
  return raw.map(code => {
    vus[code] = (vus[code] || 0) + 1
    const label = LIBELLES_DISPOSITIF[code] || code
    const name = totaux[code] > 1 ? `${label} ${vus[code]}` : label
    return { id: `${code}:${vus[code]}`, name, type: code }
  })
}

export function jourBruxelles(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Brussels', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d)
}

export function heureBruxelles(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('fr-BE', {
    timeZone: 'Europe/Brussels', hour: '2-digit', minute: '2-digit',
  }).format(d)
}

export function statutPreventif(activite, maintenant = new Date()) {
  const debut = activite?.debut ? new Date(activite.debut) : null
  const fin = activite?.fin ? new Date(activite.fin) : null
  if (debut && maintenant < debut) return 'Prévu'
  if (fin && maintenant > fin) return 'Clôturé'
  return 'Ouvert'
}

export function codePatient(annee2, province, numeroActivite, sequence) {
  return `${String(annee2).slice(-2)}${codeProvince(province)}${String(numeroActivite || 0).padStart(3, '0')}${String(sequence).padStart(3, '0')}`
}

export function echapper(valeur) {
  return String(valeur ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;')
}

export function ficheVersPatient(row) {
  const f = row?.fiche && typeof row.fiche === 'object' ? row.fiche : {}
  const pathologie = f.pathology || f.secouristeBlock?.pathology || ''
  return {
    id: row.id,
    eventId: row.preventif_id,
    patientCode: row.code_patient || f.patientCode || '',
    patientSequence: row.numero_local,
    lastName: row.nom || f.lastName || '',
    firstName: row.prenom || f.firstName || '',
    birthDate: row.date_naissance || f.birthDate || '',
    sex: row.sexe || f.sex || '',
    triageInitial: row.triage_initial || f.triageInitial || '',
    triageCurrent: row.triage_actuel || f.triageCurrent || '',
    triageOut: row.triage_sortie || f.triageOut || '',
    timeIn: row.heure_entree || f.timeIn || null,
    timeOut: row.heure_sortie || f.timeOut || null,
    destination: row.destination || f.destination || '',
    hospitalTransportMode: f.hospitalTransportMode || '',
    hospitalName: f.hospitalName || '',
    hospitalVectorName: f.hospitalVectorName || '',
    mission112Number: f.mission112Number || '',
    pmaId: f.pmaId || '',
    pmaName: f.pmaName || '',
    unknownIdentity: Boolean(f.unknownIdentity),
    nationality: f.nationality || '',
    nationalNumber: f.nationalNumber || '',
    patientAddress: f.patientAddress || '',
    postalCode: f.postalCode || '',
    locality: f.locality || '',
    pathology: pathologie,
    chiefComplaint: f.chiefComplaint || '',
    clinicalNotes: f.clinicalNotes || '',
    secouristeBlock: { pathology: pathologie },
    createdAt: row.created_at || '',
  }
}
