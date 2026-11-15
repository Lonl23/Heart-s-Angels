// © 2026 Heart's Angels ASBL & Laurent Noulin — Tous droits réservés.
import { requireAuth, logout } from './auth.js'
import { listerPreventifs, listerPatients } from './data.js'
import { echapper } from './model.js'

function tick() { document.getElementById('time').textContent = new Date().toLocaleTimeString('fr-BE', { hour:'2-digit', minute:'2-digit', second:'2-digit' }) }
setInterval(tick, 1000); tick()
const session = await requireAuth()
if (!session) throw new Error('Auth requise')
document.getElementById('connectedUser').textContent = `${session.profile.prenom || ''} ${session.profile.nom || ''}`.trim()
document.getElementById('backBtn').addEventListener('click', () => { location.href = '/rescuetrack/province.html' })
document.getElementById('logoutBtn').addEventListener('click', async () => { await logout(); location.href = '/rescuetrack/index.html' })

const fmt = d => { if (!d) return '—'; const [y,m,j] = String(d).split('-'); return j && m && y ? `${j}-${m}-${y}` : d }
const sexe = s => s === 'Homme' ? '♂' : s === 'Femme' ? '♀' : '?'
const normaliser = str => String(str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
let patients = []
let preventifs = {}
function render() {
  const q = normaliser(document.getElementById('searchInput').value)
  const triage = document.getElementById('triageFilter').value
  const eventId = document.getElementById('eventFilter2').value
  let results = patients
  if (eventId) results = results.filter(p => p.eventId === eventId)
  if (triage) results = results.filter(p => p.triageCurrent === triage)
  if (q.length >= 2) results = results.filter(p => [p.lastName, p.firstName, p.patientCode, p.nationalNumber, p.birthDate, p.locality].map(normaliser).some(f => f.includes(q)))
  results = [...results].sort((a,b) => String(b.createdAt).localeCompare(String(a.createdAt)))
  document.getElementById('resultCount').textContent = results.length === 0 ? 'Aucun résultat.' : results.length === 1 ? '1 fiche trouvée.' : `${results.length} fiches trouvées.`
  const tbody = document.getElementById('searchResultsBody')
  if (!results.length) { tbody.innerHTML = '<tr><td colspan="11" class="empty-row">Aucune fiche correspondante.</td></tr>'; return }
  tbody.innerHTML = results.map(p => {
    const ev = preventifs[p.eventId]
    return `<tr>
      <td style="font-family:'DM Mono',monospace;font-size:12px">${echapper(p.patientCode || '—')}</td>
      <td><strong>${echapper(p.lastName || '—')}</strong></td>
      <td>${echapper(p.firstName || '—')}</td>
      <td>${echapper(fmt(p.birthDate))}</td>
      <td>${sexe(p.sex)}</td>
      <td class="triage-${echapper(p.triageInitial)}">${echapper(p.triageInitial || '—')}</td>
      <td class="triage-${echapper(p.triageCurrent)}">${echapper(p.triageCurrent || '—')}</td>
      <td>${echapper(p.pmaName || '—')}</td>
      <td style="font-size:12px">${echapper(ev?.description || '—')}</td>
      <td>${p.timeOut ? '✓' : '—'}</td>
      <td><button class="table-action-btn" data-patient="${echapper(p.id)}" data-event="${echapper(p.eventId)}">Ouvrir</button></td>
    </tr>`
  }).join('')
  tbody.querySelectorAll('[data-patient]').forEach(btn => btn.addEventListener('click', () => {
    sessionStorage.setItem('currentEventId', btn.dataset.event)
    sessionStorage.setItem('selectedPatientId', btn.dataset.patient)
    location.href = '/rescuetrack/patient.html'
  }))
}
const liste = await listerPreventifs()
liste.forEach(ev => { preventifs[ev.id] = ev })
document.getElementById('eventFilter2').insertAdjacentHTML('beforeend', liste.map(ev => `<option value="${echapper(ev.id)}">${echapper(fmt(ev.date))} – ${echapper(ev.description)}</option>`).join(''))
patients = await listerPatients()
document.getElementById('searchInput').addEventListener('input', render)
document.getElementById('triageFilter').addEventListener('change', render)
document.getElementById('eventFilter2').addEventListener('change', render)
render()
