// © 2026 Heart's Angels ASBL & Laurent Noulin — Tous droits réservés.
import { requireAuth } from './auth.js'
import { lirePreventif, listerPatients, enregistrerPatient, listerLogbook, ajouterLogbook } from './data.js'
import { TRIAGES, TRIAGE_LIBELLES, echapper, heureBruxelles } from './model.js'
import { rt } from './paths.js'

function tick() { document.getElementById('time').textContent = new Date().toLocaleTimeString('fr-BE', { hour:'2-digit', minute:'2-digit', second:'2-digit' }) }
setInterval(tick, 1000); tick()
const session = await requireAuth()
if (!session) throw new Error('Auth requise')
const eventId = sessionStorage.getItem('currentEventId')
if (!eventId) { location.href = rt('evenements.html'); throw new Error('Préventif requis') }

const event = await lirePreventif(eventId)
if (!event) { location.href = rt('evenements.html'); throw new Error('Préventif introuvable') }
document.getElementById('eventTitle').textContent = event.description
document.getElementById('eventMeta').textContent = [event.date, event.commune, event.status].filter(Boolean).join(' · ')
document.getElementById('eventInfo').textContent = `${session.profile.prenom || ''} ${session.profile.nom || ''}`.trim()
document.getElementById('backBtn').addEventListener('click', () => { location.href = rt('evenements.html') })
document.getElementById('addPatientBtn').addEventListener('click', () => {
  sessionStorage.removeItem('selectedPatientId')
  location.href = rt('patient.html')
})
const pmaModal = document.getElementById('pmaModal')
document.getElementById('choosePmaBtn').addEventListener('click', () => pmaModal.classList.remove('hidden'))
document.getElementById('closePmaBtn').addEventListener('click', () => pmaModal.classList.add('hidden'))
const pmaLabel = document.getElementById('currentPmaLabel')
function pmaActif() { return sessionStorage.getItem('currentPmaId') || '' }
function majPma() {
  const id = pmaActif()
  pmaLabel.textContent = id ? (sessionStorage.getItem('currentPmaName') || 'Dispositif') : 'Vue de tout le préventif'
}
function choisirPma(id, nom) {
  if (id) { sessionStorage.setItem('currentPmaId', id); sessionStorage.setItem('currentPmaName', nom) }
  else { sessionStorage.removeItem('currentPmaId'); sessionStorage.removeItem('currentPmaName') }
  majPma(); pmaModal.classList.add('hidden'); render()
}
const choices = document.getElementById('pmaChoiceList')
choices.innerHTML = `<button class="btn-secondary" type="button" data-pma="">Tout le préventif</button>` + event.pmas.map(p =>
  `<button class="btn-secondary" type="button" data-pma="${echapper(p.id)}" data-name="${echapper(p.name)}">${echapper(p.name)}</button>`
).join('')
choices.querySelectorAll('button').forEach(btn => btn.addEventListener('click', () => choisirPma(btn.dataset.pma, btn.dataset.name || '')))
if (event.pmas.length === 1 && !pmaActif()) choisirPma(event.pmas[0].id, event.pmas[0].name)
majPma()

function compte(liste, pred) { return liste.filter(pred).length }
function grille(el, patients, champ, extra) {
  el.innerHTML = TRIAGES.map(t => `<div class="triage-counter ${t.toLowerCase()}"><span class="triage-counter-label">${t}</span><span class="triage-counter-value">${compte(patients, p => p[champ] === t && (!extra || extra(p)))}</span><span class="triage-counter-hint">${echapper(TRIAGE_LIBELLES[t] || '')}</span></div>`).join('')
}
function surPlace(p) { return !p.timeOut && !p.destination }

let patients = []
async function render() {
  patients = await listerPatients(eventId)
  const visibles = pmaActif() ? patients.filter(p => p.pmaId === pmaActif()) : patients
  grille(document.getElementById('inCounters'), visibles, 'triageInitial')
  grille(document.getElementById('outCounters'), visibles, 'triageOut')
  grille(document.getElementById('stayCounters'), visibles, 'triageCurrent', surPlace)
  const body = document.getElementById('patientsTableBody')
  if (!visibles.length) {
    body.innerHTML = '<tr><td colspan="11" class="empty-row">Aucune fiche patient pour ce préventif.</td></tr>'
    return
  }
  body.innerHTML = visibles.map(p => `<tr>
    <td>${echapper(p.patientCode)}</td>
    <td>${echapper(p.lastName)}</td>
    <td>${echapper(p.firstName)}</td>
    <td>${echapper(p.sex || '')}</td>
    <td>${echapper(p.triageCurrent || '')}</td>
    <td>${echapper(p.triageOut || '')}</td>
    <td>${echapper(p.destination || '')}</td>
    <td>${echapper(p.pmaName || '')}</td>
    <td>${echapper(heureBruxelles(p.timeIn))}</td>
    <td>${echapper(heureBruxelles(p.timeOut))}</td>
    <td><button class="table-action-btn" data-open="${echapper(p.id)}">Ouvrir</button>
        ${p.timeOut ? '' : `<button class="table-action-btn" data-exit="${echapper(p.id)}">Sortie</button>`}</td>
  </tr>`).join('')
  body.querySelectorAll('[data-open]').forEach(btn => btn.addEventListener('click', () => {
    sessionStorage.setItem('selectedPatientId', btn.dataset.open)
    location.href = rt('patient.html')
  }))
  body.querySelectorAll('[data-exit]').forEach(btn => btn.addEventListener('click', () => ouvrirSortie(btn.dataset.exit)))
}
await render()

const exitModal = document.getElementById('exitModal')
const dest = document.getElementById('exitDestination')
const hospital = document.getElementById('exitHospitalBlock')
dest.addEventListener('change', () => hospital.classList.toggle('hidden', dest.value !== 'Hopital'))
document.getElementById('closeExitModalBtn').addEventListener('click', () => exitModal.classList.add('hidden'))
let sortieId = null
function ouvrirSortie(id) {
  sortieId = id
  document.getElementById('exitError').textContent = ''
  dest.value = ''; document.getElementById('exitTriageOut').value = ''
  hospital.classList.add('hidden')
  exitModal.classList.remove('hidden')
}
document.getElementById('confirmExitBtn').addEventListener('click', async () => {
  const err = document.getElementById('exitError')
  err.textContent = ''
  const patient = patients.find(p => p.id === sortieId)
  if (!patient) return
  const destination = dest.value
  const triageOut = document.getElementById('exitTriageOut').value
  if (!destination || !triageOut) { err.textContent = 'Destination et triage OUT sont requis.'; return }
  const transport = document.getElementById('exitTransportMode').value
  if (destination === 'Hopital' && transport === 'Ambulance 112' && !document.getElementById('exitMission112Number').value.trim()) {
    err.textContent = 'Le numéro de mission 112 est requis.'; return
  }
  const fiche = {
    ...patient,
    destination,
    triageOut,
    triageCurrent: triageOut,
    hospitalTransportMode: destination === 'Hopital' ? transport : '',
    hospitalName: destination === 'Hopital' ? document.getElementById('exitHospitalName').value.trim() : '',
    hospitalVectorName: destination === 'Hopital' ? document.getElementById('exitVectorName').value.trim() : '',
    mission112Number: destination === 'Hopital' ? document.getElementById('exitMission112Number').value.trim() : '',
    timeOut: new Date().toISOString(),
  }
  delete fiche.id
  try {
    await enregistrerPatient(eventId, fiche, sortieId)
    exitModal.classList.add('hidden')
    await render()
  } catch (error) { err.textContent = error.message }
})

async function renderLog() {
  const lignes = await listerLogbook(eventId)
  const el = document.getElementById('logbookList')
  el.innerHTML = lignes.length ? lignes.map(l => `<div class="logbook-item"><strong>${echapper(heureBruxelles(l.created_at))}</strong> ${echapper(l.texte)}</div>`).join('') : '<p class="page-subtitle">Aucune entrée.</p>'
}
await renderLog()
document.getElementById('logbookForm').addEventListener('submit', async (e) => {
  e.preventDefault()
  const zone = document.getElementById('logbookText')
  const texte = zone.value.trim()
  if (!texte) return
  await ajouterLogbook(eventId, texte)
  zone.value = ''
  await renderLog()
})
