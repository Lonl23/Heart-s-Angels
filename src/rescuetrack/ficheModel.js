// Aides pures de RescueTrack. Ce module ne parle à aucune base.

export const LIBELLES_DISPOSITIF = {
  paps: 'PAPS',
  ps: 'Poste de secours',
  echo: 'Écho',
  pma_cat2: 'PMA cat. 2',
  pma_cat1: 'PMA cat. 1',
  pma_cat0: 'PMA cat. 0',
  ambu_112: 'Ambulance 112',
  ambu: 'Ambulance',
}

export const SEXE_OPTIONS = [
  { libelle: 'Homme', code: 'M' },
  { libelle: 'Femme', code: 'F' },
  { libelle: 'Indéterminé', code: 'inconnu' },
  { libelle: 'X', code: 'X' },
]

export const TRIAGES = ['U1', 'U2', 'U3H', 'U3NH', 'IMPLIQUE', 'DCD']

export const PATHOLOGIES = [
  'Intox', 'Trauma', 'Malaise', 'Brûlure', 'Cardio', 'Respiratoire', 'Neurologique', 'Autre',
]

export const ORIENTATIONS = [
  { v: 'sur place', l: 'Sur place' },
  { v: 'retour', l: 'Retour' },
  { v: 'conseil', l: 'Conseil' },
  { v: 'évacuation', l: 'Évacuation' },
  { v: 'refus', l: 'Refus' },
  { v: 'autre', l: 'Autre' },
]

export const NATIONALITES = [
  { v: 'BE', l: 'Belgique' },
  { v: 'FR', l: 'France' },
  { v: 'NL', l: 'Pays-Bas' },
  { v: 'DE', l: 'Allemagne' },
  { v: 'UK', l: 'Royaume-Uni' },
  { v: 'AUTRE', l: 'Autre' },
]

const FUSEAU = 'Europe/Brussels'

/** Un préventif : type preventif, ou un dispositif renseigné. */
export function estPreventif(activite) {
  if (!activite || typeof activite !== 'object') return false
  if (activite.type === 'preventif') return true
  if (activite.dispositif != null && activite.dispositif !== '') return true
  return Array.isArray(activite.dispositifs) && activite.dispositifs.length > 0
}

export function sexeVersCode(libelle) {
  if (libelle == null || libelle === '') return null
  const parLibelle = SEXE_OPTIONS.find(o => o.libelle === libelle)
  if (parLibelle) return parLibelle.code
  const parCode = SEXE_OPTIONS.find(o => o.code === libelle)
  return parCode ? parCode.code : null
}

export function sexeDepuisCode(code) {
  return SEXE_OPTIONS.find(o => o.code === code)?.libelle || ''
}

export function codesDispositifs(activite) {
  const liste = Array.isArray(activite?.dispositifs)
    ? activite.dispositifs.filter(code => code != null && code !== '')
    : []
  if (liste.length) return liste
  if (activite?.dispositif) return [activite.dispositif]
  return []
}

/** Numérote les doublons : PAPS 1, PAPS 2, Poste de secours. */
export function etiquettesDispositifs(codes) {
  const liste = Array.isArray(codes) ? codes : []
  const totaux = new Map()
  for (const code of liste) totaux.set(code, (totaux.get(code) || 0) + 1)
  const vus = new Map()
  return liste.map((code, index) => {
    const n = (vus.get(code) || 0) + 1
    vus.set(code, n)
    const base = LIBELLES_DISPOSITIF[code] || code
    const label = totaux.get(code) > 1 ? `${base} ${n}` : base
    return { code, index, label, cle: `${code}:${index}` }
  })
}

export function etiquettesDeLactivite(activite) {
  return etiquettesDispositifs(codesDispositifs(activite))
}

export function libelleOrientation(valeur) {
  return ORIENTATIONS.find(o => o.v === valeur)?.l || (valeur || '')
}

export function libelleLieu(activite) {
  if (!activite) return 'Lieu non précisé'
  const lieu = String(activite.lieu || '').trim()
  if (lieu) return lieu
  const rue = [activite.adresse_rue, activite.adresse_numero].filter(Boolean).join(' ').trim()
  const ville = [activite.adresse_cp, activite.adresse_ville].filter(Boolean).join(' ').trim()
  const compose = [rue, ville].filter(Boolean).join(', ')
  if (compose) return compose
  const adresse = String(activite.adresse || '').trim()
  return adresse || 'Lieu non précisé'
}

export function libelleIdentite(fiche) {
  const contenu = fiche?.contenu && typeof fiche.contenu === 'object' ? fiche.contenu : {}
  if (contenu.identite_inconnue) return '« identité inconnue »'
  const nom = [fiche?.nom, fiche?.prenom].map(v => String(v || '').trim()).filter(Boolean).join(' ')
  return nom || '« identité inconnue »'
}

export function statutPreventif(activite, maintenant = new Date()) {
  const debut = activite?.debut ? new Date(activite.debut) : null
  const fin = activite?.fin ? new Date(activite.fin) : null
  const now = maintenant.getTime()
  if (debut && !Number.isNaN(debut.getTime()) && debut.getTime() > now) return 'a_venir'
  if (fin && !Number.isNaN(fin.getTime()) && fin.getTime() < now) return 'passe'
  return 'en_cours'
}

function partsBruxelles(date) {
  const dtf = new Intl.DateTimeFormat('en-GB', {
    timeZone: FUSEAU,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const parts = Object.fromEntries(dtf.formatToParts(date).map(p => [p.type, p.value]))
  if (parts.hour === '24') parts.hour = '00'
  return parts
}

function decalageMillis(date) {
  const parts = partsBruxelles(date)
  const commeUtc = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour), Number(parts.minute), Number(parts.second),
  )
  return commeUtc - date.getTime()
}

/** Interprète un champ datetime-local comme l'heure de Bruxelles. */
export function heureLocaleVersIso(valeur) {
  if (!valeur) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(valeur)
  if (!m) return null
  const guess = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), 0))
  const instant = new Date(guess.getTime() - decalageMillis(guess))
  return new Date(guess.getTime() - decalageMillis(instant)).toISOString()
}

export function isoVersChampHeure(iso) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const parts = partsBruxelles(date)
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}

export function formaterDateHeure(iso) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('fr-BE', {
    timeZone: FUSEAU,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function formaterPlage(debut, fin) {
  const a = formaterDateHeure(debut)
  const b = formaterDateHeure(fin)
  if (a && b) return `${a} – ${b}`
  return a || b || 'Dates à préciser'
}

function texte(valeur) {
  const s = String(valeur ?? '').trim()
  return s || null
}

export function formulaireVide(etiquettes = [], maintenant = new Date()) {
  const seul = etiquettes.length === 1 ? etiquettes[0] : null
  return {
    identiteInconnue: false,
    sexe: '',
    nom: '',
    prenom: '',
    dateNaissance: '',
    nationalite: '',
    numeroNational: '',
    adresse: '',
    cp: '',
    localite: '',
    triage: '',
    pathologie: '',
    motif: '',
    remarques: '',
    orientation: '',
    heureDebut: isoVersChampHeure(maintenant.toISOString()),
    heureFin: '',
    dispositifCode: seul?.code || '',
    dispositifIndex: seul ? seul.index : null,
  }
}

export function formulaireDepuisFiche(fiche, etiquettes = []) {
  const c = fiche?.contenu && typeof fiche.contenu === 'object' ? fiche.contenu : {}
  let dispositifCode = ''
  let dispositifIndex = null
  if (Number.isInteger(c.dispositif_index) && etiquettes[c.dispositif_index]?.code === (c.dispositif || etiquettes[c.dispositif_index].code)) {
    dispositifCode = etiquettes[c.dispositif_index].code
    dispositifIndex = c.dispositif_index
  }
  return {
    identiteInconnue: Boolean(c.identite_inconnue),
    sexe: sexeVersCode(fiche?.sexe) || '',
    nom: fiche?.nom || '',
    prenom: fiche?.prenom || '',
    dateNaissance: fiche?.date_naissance || '',
    nationalite: c.nationalite || '',
    numeroNational: c.numero_national || '',
    adresse: c.adresse || '',
    cp: c.cp || '',
    localite: c.localite || '',
    triage: c.triage || '',
    pathologie: c.pathologie || '',
    motif: fiche?.motifs || '',
    remarques: fiche?.notes || '',
    orientation: fiche?.orientation || '',
    heureDebut: isoVersChampHeure(fiche?.heure_prise_en_charge),
    heureFin: isoVersChampHeure(fiche?.heure_fin),
    dispositifCode,
    dispositifIndex,
  }
}

export function erreursFiche(form, etiquettes = []) {
  const erreurs = []
  if (!form?.triage || !TRIAGES.includes(form.triage)) erreurs.push('Choisissez un triage.')
  if (!form?.identiteInconnue && !texte(form?.nom) && !texte(form?.prenom)) {
    erreurs.push('Indiquez le nom ou cochez « Identité inconnue ».')
  }
  if (form?.sexe && !sexeVersCode(form.sexe)) erreurs.push('Sexe non reconnu.')
  if (etiquettes.length > 0 && (form?.dispositifCode == null || form.dispositifCode === '' || form.dispositifIndex == null)) {
    erreurs.push('Choisissez le dispositif.')
  }
  if (form?.heureDebut && form?.heureFin && form.heureFin < form.heureDebut) {
    erreurs.push("L'heure de fin précède l'heure de début.")
  }
  return erreurs
}

export function payloadFiche(form) {
  const inconnue = Boolean(form?.identiteInconnue)
  const contenu = { identite_inconnue: inconnue }
  if (!inconnue) {
    const nationalite = texte(form?.nationalite)
    const numero = texte(form?.numeroNational)
    const adresse = texte(form?.adresse)
    const cp = texte(form?.cp)
    const localite = texte(form?.localite)
    if (nationalite) contenu.nationalite = nationalite
    if (numero) contenu.numero_national = numero
    if (adresse) contenu.adresse = adresse
    if (cp) contenu.cp = cp
    if (localite) contenu.localite = localite
  }
  if (form?.triage) contenu.triage = form.triage
  if (form?.pathologie) contenu.pathologie = form.pathologie
  if (form?.dispositifCode) {
    contenu.dispositif = form.dispositifCode
    contenu.dispositif_index = form.dispositifIndex
  }
  return {
    nom: inconnue ? null : texte(form?.nom),
    prenom: inconnue ? null : texte(form?.prenom),
    dateNaissance: inconnue ? null : (form?.dateNaissance || null),
    sexe: sexeVersCode(form?.sexe),
    motifs: texte(form?.motif),
    notes: texte(form?.remarques),
    orientation: form?.orientation || null,
    heureDebut: form?.heureDebut ? heureLocaleVersIso(form.heureDebut) : null,
    heureFin: form?.heureFin ? heureLocaleVersIso(form.heureFin) : null,
    contenu,
  }
}
