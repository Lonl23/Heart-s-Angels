// © 2026 Heart's Angels ASBL & Laurent Noulin — Tous droits réservés.
import { requireAuth, logout, supabase } from './auth.js'
import { listerPreventifs, listerPatients } from './data.js'
import { echapper } from './model.js'

function tick() { document.getElementById('time').textContent = new Date().toLocaleTimeString('fr-BE', { hour:'2-digit', minute:'2-digit', second:'2-digit' }) }
setInterval(tick, 1000); tick()
const session = await requireAuth()
if (!session) throw new Error('Auth requise')
document.getElementById('connectedUser').textContent = `${session.profile.prenom || ''} ${session.profile.nom || ''}`.trim()
document.getElementById('backBtn').addEventListener('click', () => { location.href = '/rescuetrack/province.html' })
document.getElementById('logoutBtn').addEventListener('click', async () => { await logout(); location.href = '/rescuetrack/index.html' })

const fmt = d => { if (!d) return '—'; const [y,m,j] = d.split('-'); return `${j}-${m}-${y}` }
function countTriage(patients) {
  const r = { U1:0, U2:0, U3H:0, U3NH:0, IMPLIQUE:0, DCD:0 }
  patients.forEach(p => { if (r[p.triageCurrent] !== undefined) r[p.triageCurrent]++ })
  return r
}
let preventifs = []
let patients = []
function render() {
  const filtre = document.getElementById('eventFilter').value
  const visibles = filtre ? patients.filter(p => p.eventId === filtre) : patients
  const evs = filtre ? preventifs.filter(e => e.id === filtre) : preventifs
  const totals = countTriage(visibles)
  document.getElementById('statTotal').textContent = visibles.length
  ;['U1','U2','U3H','U3NH','IMPLIQUE','DCD'].forEach(k => { document.getElementById('stat'+k).textContent = totals[k] })
  const tbody = document.getElementById('eventsStatsBody')
  if (!evs.length) tbody.innerHTML = '<tr><td colspan="13" class="empty-row">Aucun préventif.</td></tr>'
  else tbody.innerHTML = evs.map(ev => {
    const evPatients = patients.filter(p => p.eventId === ev.id)
    const t = countTriage(evPatients)
    const evac = evPatients.filter(p => p.hospitalTransportMode === 'Ambulance 112').length
    return `<tr>
      <td>${fmt(ev.date)}</td><td><strong>${echapper(ev.description)}</strong></td><td>${echapper(ev.province || '—')}</td>
      <td>${echapper(ev.status)}</td><td><strong>${evPatients.length}</strong></td>
      <td class="triage-U1">${t.U1}</td><td class="triage-U2">${t.U2}</td><td class="triage-U3H">${t.U3H}</td>
      <td class="triage-U3NH">${t.U3NH}</td><td class="triage-IMPLIQUE">${t.IMPLIQUE}</td><td class="triage-DCD">${t.DCD}</td>
      <td>${evac}</td><td><button class="table-action-btn" data-id="${echapper(ev.id)}">Ouvrir</button></td>
    </tr>`
  }).join('')
  tbody.querySelectorAll('[data-id]').forEach(btn => btn.addEventListener('click', () => {
    sessionStorage.setItem('currentEventId', btn.dataset.id)
    sessionStorage.removeItem('currentPmaId'); sessionStorage.removeItem('currentPmaName')
    location.href = '/rescuetrack/event.html'
  }))
  const pathCount = {}
  visibles.forEach(p => { const path = p.secouristeBlock?.pathology || 'Non renseigné'; pathCount[path] = (pathCount[path] || 0) + 1 })
  const box = document.getElementById('pathologyStats')
  const entries = Object.entries(pathCount).sort((a,b) => b[1]-a[1])
  box.innerHTML = entries.length ? entries.map(([label, count]) => `<div class="stat-card"><span class="stat-label">${echapper(label)}</span><span class="stat-value">${count}</span></div>`).join('') : '<p class="page-subtitle">Aucune donnée.</p>'
}
async function charger() {
  preventifs = await listerPreventifs()
  patients = await listerPatients()
  const sel = document.getElementById('eventFilter')
  const courant = sel.value
  sel.innerHTML = '<option value="">Tous les préventifs</option>' + preventifs.map(ev => `<option value="${echapper(ev.id)}">${echapper(fmt(ev.date))} – ${echapper(ev.description)}</option>`).join('')
  if ([...sel.options].some(o => o.value === courant)) sel.value = courant
  render()
}
document.getElementById('eventFilter').addEventListener('change', render)
await charger()
supabase.channel('rescuetrack-fiches').on('postgres_changes', { event: '*', schema: 'public', table: 'rescuetrack_fiches' }, () => { charger() }).subscribe()
