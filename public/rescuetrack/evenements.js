// © 2026 Heart's Angels ASBL & Laurent Noulin — Tous droits réservés.
import { requireAuth, logout } from './auth.js'
import { listerPreventifs } from './data.js'
import { echapper, heureBruxelles } from './model.js'
function tick(){ document.getElementById('time').textContent = new Date().toLocaleTimeString('fr-BE',{hour:'2-digit',minute:'2-digit',second:'2-digit'}) }
setInterval(tick,1000); tick()
const session = await requireAuth()
if (!session) throw new Error('Auth requise')
const province = sessionStorage.getItem('selectedProvince')
if (!province) { location.href = '/rescuetrack/province.html'; throw new Error('Province requise') }
document.getElementById('connectedUser').textContent = `${session.profile.prenom||''} ${session.profile.nom||''} · ${province==='__aucune__'?'sans province':province}`
document.getElementById('pageTitle').textContent = province==='__aucune__' ? 'Préventifs sans province' : `Préventifs · ${province}`
document.getElementById('logoutBtn').addEventListener('click', async () => { await logout(); location.href='/rescuetrack/index.html' })
document.getElementById('changeProvinceBtn').addEventListener('click', () => { location.href='/rescuetrack/province.html' })
const fmt = d => { if(!d) return '—'; const [y,m,j]=d.split('-'); return `${j}-${m}-${y}` }
const body = document.getElementById('eventsTableBody')
try {
  const tous = await listerPreventifs()
  const events = tous.filter(ev => province==='__aucune__' ? !ev.province : ev.province===province)
  if (!events.length) {
    body.innerHTML = '<tr><td colspan="6" class="empty-row">Aucun préventif pour cette sélection. Ils se créent dans app.heartsangels.be.</td></tr>'
  } else {
    body.innerHTML = events.map(ev => `<tr><td><strong>${echapper(ev.description)}</strong></td><td>${fmt(ev.date)}${ev.debut?` · ${echapper(heureBruxelles(ev.debut))}`:''}</td><td>${echapper(ev.commune||'—')}</td><td>${echapper(ev.status)}</td><td>${ev.pmas.length}</td><td><button class="table-action-btn" data-id="${echapper(ev.id)}">Ouvrir</button></td></tr>`).join('')
    body.querySelectorAll('[data-id]').forEach(btn => btn.addEventListener('click', () => {
      sessionStorage.setItem('currentEventId', btn.dataset.id)
      sessionStorage.removeItem('currentPmaId'); sessionStorage.removeItem('currentPmaName')
      location.href = '/rescuetrack/event.html'
    }))
  }
} catch (error) {
  body.innerHTML = `<tr><td colspan="6" class="empty-row">${echapper(error.message)}</td></tr>`
}
