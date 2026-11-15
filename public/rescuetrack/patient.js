// © 2026 Heart's Angels ASBL & Laurent Noulin — Tous droits réservés.
import { requireAuth } from './auth.js'
import { lirePreventif, lirePatient, enregistrerPatient } from './data.js'
import { injectEidButton } from './eid.js'
import { rt } from './paths.js'

function tick() { document.getElementById('time').textContent = new Date().toLocaleTimeString('fr-BE', { hour:'2-digit', minute:'2-digit', second:'2-digit' }) }
setInterval(tick, 1000); tick()
const session = await requireAuth()
if (!session) throw new Error('Auth requise')

const currentEventId = sessionStorage.getItem('currentEventId')
if (!currentEventId) { location.href = rt('evenements.html'); throw new Error('Préventif requis') }
const selectedPatientId = sessionStorage.getItem('selectedPatientId')

const unknownIdentityCheckbox = document.getElementById('unknownIdentityCheckbox')
const sex = document.getElementById('sex')
const triageCurrent = document.getElementById('triageCurrent')
const lastName = document.getElementById('lastName')
const firstName = document.getElementById('firstName')
const birthDate = document.getElementById('birthDate')
const ageDisplay = document.getElementById('ageDisplay')
const nationality = document.getElementById('nationality')
const nationalNumber = document.getElementById('nationalNumber')
const patientAddress = document.getElementById('patientAddress')
const postalCode = document.getElementById('postalCode')
const locality = document.getElementById('locality')
const pmaDisplay = document.getElementById('pmaDisplay')
const triageInitialDisplay = document.getElementById('triageInitialDisplay')
const pathology = document.getElementById('pathology')
const chiefComplaint = document.getElementById('chiefComplaint')
const clinicalNotes = document.getElementById('clinicalNotes')

let currentEvent = null
let existingPatient = null
let unknownIdentity = false

function getCurrentPma() {
  return { id: sessionStorage.getItem('currentPmaId') || '', name: sessionStorage.getItem('currentPmaName') || '' }
}
function extractBirthDateFromBelgianNationalNumber(niss) {
  const digits = String(niss || '').replace(/\D/g, '')
  if (digits.length < 6) return ''
  const yy = parseInt(digits.slice(0, 2), 10)
  const mm = parseInt(digits.slice(2, 4), 10)
  const dd = parseInt(digits.slice(4, 6), 10)
  if (Number.isNaN(yy) || Number.isNaN(mm) || Number.isNaN(dd) || mm < 1 || mm > 12 || dd < 1 || dd > 31) return ''
  const currentYear = new Date().getFullYear() % 100
  const fullYear = yy <= currentYear ? 2000 + yy : 1900 + yy
  return `${fullYear}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
}
function calculateAge(dateString) {
  if (!dateString) return ''
  if (unknownIdentity && dateString === '1900-01-01') return ''
  const birth = new Date(dateString)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--
  return Number.isNaN(age) || age < 0 ? '' : age
}
function updateAgeField() {
  const age = calculateAge(birthDate.value)
  ageDisplay.value = age === '' ? '' : `${age} an(s)`
}
function updatePostalRules() {
  const age = calculateAge(birthDate.value)
  const optional = unknownIdentity || (age !== '' && age < 18)
  postalCode.required = !optional
  locality.required = !optional
}
function tryAutofillBirthDateFromNationalNumber() {
  if (nationality.value !== 'BE' || unknownIdentity) return
  const extracted = extractBirthDateFromBelgianNationalNumber(nationalNumber.value)
  if (extracted) { birthDate.value = extracted; updateAgeField(); updatePostalRules() }
}
function applyUnknownIdentityState() {
  if (unknownIdentity) {
    lastName.value = 'Doe'; firstName.value = 'Jane'; birthDate.value = '1900-01-01'
    nationality.value = ''; nationalNumber.value = ''; sex.value = 'Indéterminé / inconnu'
  }
  updateAgeField(); updatePostalRules()
}
function validateBaseData() {
  if (!triageCurrent.value) { alert('Le triage courant est obligatoire.'); return false }
  if (!unknownIdentity && (!lastName.value.trim() || !firstName.value.trim() || !birthDate.value || !sex.value || !nationality.value)) {
    alert("Les champs d'identité obligatoires ne sont pas complets."); return false
  }
  return true
}
function buildFiche() {
  const nowIso = new Date().toISOString()
  const currentPma = getCurrentPma()
  const pathologie = pathology.value
  return {
    pmaId: existingPatient?.pmaId || currentPma.id,
    pmaName: existingPatient?.pmaName || currentPma.name,
    timeIn: existingPatient?.timeIn || nowIso,
    timeOut: existingPatient?.timeOut || null,
    unknownIdentity,
    triageInitial: existingPatient?.triageInitial || triageCurrent.value,
    triageCurrent: triageCurrent.value,
    triageOut: existingPatient?.triageOut || '',
    destination: existingPatient?.destination || '',
    hospitalTransportMode: existingPatient?.hospitalTransportMode || '',
    hospitalName: existingPatient?.hospitalName || '',
    hospitalVectorName: existingPatient?.hospitalVectorName || '',
    mission112Number: existingPatient?.mission112Number || '',
    sex: sex.value,
    lastName: lastName.value.trim(),
    firstName: firstName.value.trim(),
    birthDate: birthDate.value,
    nationality: nationality.value,
    nationalNumber: nationalNumber.value.trim(),
    patientAddress: patientAddress.value.trim(),
    postalCode: postalCode.value.trim(),
    locality: locality.value.trim(),
    pathology: pathologie,
    chiefComplaint: chiefComplaint.value.trim(),
    clinicalNotes: clinicalNotes.value.trim(),
    secouristeBlock: { pathology: pathologie },
  }
}
function fillPatient(patient) {
  unknownIdentity = Boolean(patient.unknownIdentity)
  unknownIdentityCheckbox.checked = unknownIdentity
  document.getElementById('patientCodeDisplay').textContent = patient.patientCode || 'En attente'
  sex.value = patient.sex || ''
  triageCurrent.value = patient.triageCurrent || patient.triageInitial || ''
  lastName.value = patient.lastName || ''
  firstName.value = patient.firstName || ''
  birthDate.value = patient.birthDate || ''
  nationality.value = patient.nationality || ''
  nationalNumber.value = patient.nationalNumber || ''
  patientAddress.value = patient.patientAddress || ''
  postalCode.value = patient.postalCode || ''
  locality.value = patient.locality || ''
  pmaDisplay.value = patient.pmaName || ''
  triageInitialDisplay.value = patient.triageInitial || ''
  pathology.value = patient.pathology || ''
  chiefComplaint.value = patient.chiefComplaint || ''
  clinicalNotes.value = patient.clinicalNotes || ''
  updateAgeField(); updatePostalRules()
}
function remplirEid(data) {
  unknownIdentity = false
  unknownIdentityCheckbox.checked = false
  if (data.lastName) lastName.value = data.lastName
  if (data.firstName) firstName.value = data.firstName
  if (data.birthDate) birthDate.value = data.birthDate
  if (data.sex) sex.value = data.sex
  if (data.nationalNumber) nationalNumber.value = data.nationalNumber
  if (data.nationality) nationality.value = data.nationality
  if (data.address) patientAddress.value = data.address
  updateAgeField(); updatePostalRules()
}

unknownIdentityCheckbox.addEventListener('change', () => { unknownIdentity = unknownIdentityCheckbox.checked; applyUnknownIdentityState() })
birthDate.addEventListener('change', () => { updateAgeField(); updatePostalRules() })
nationality.addEventListener('change', tryAutofillBirthDateFromNationalNumber)
nationalNumber.addEventListener('input', tryAutofillBirthDateFromNationalNumber)
injectEidButton(document.getElementById('eidMount'), remplirEid)

document.getElementById('savePatientBtn').addEventListener('click', async () => {
  if (!validateBaseData()) return
  const btn = document.getElementById('savePatientBtn')
  btn.disabled = true
  try {
    await enregistrerPatient(currentEvent.id, buildFiche(), existingPatient?.id || null)
    sessionStorage.removeItem('selectedPatientId')
    location.href = rt('event.html')
  } catch (error) {
    btn.disabled = false
    alert(error.message || "L'enregistrement a échoué.")
  }
})
document.getElementById('backToEventBtn').addEventListener('click', () => {
  sessionStorage.removeItem('selectedPatientId')
  location.href = rt('event.html')
})

currentEvent = await lirePreventif(currentEventId)
if (!currentEvent) { location.href = rt('evenements.html'); throw new Error('Préventif introuvable') }
if (selectedPatientId) existingPatient = await lirePatient(selectedPatientId)
document.getElementById('patientModeLabel').textContent = existingPatient ? 'Modification de fiche' : 'Nouvelle fiche patient'
document.getElementById('eventContext').textContent = [currentEvent.description, currentEvent.commune, currentEvent.province || 'province non renseignée'].filter(Boolean).join(' · ')
if (existingPatient) fillPatient(existingPatient)
else {
  const currentPma = getCurrentPma()
  pmaDisplay.value = currentPma.name || 'Tout le préventif'
  document.getElementById('patientCodeDisplay').textContent = "Attribué à l'enregistrement"
  updateAgeField(); updatePostalRules()
}
