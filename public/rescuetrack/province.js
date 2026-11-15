// © 2026 Heart's Angels ASBL & Laurent Noulin — Tous droits réservés.
import { requireAuth, logout } from './auth.js'

function tick() { document.getElementById('time').textContent = new Date().toLocaleTimeString('fr-BE', { hour:'2-digit', minute:'2-digit', second:'2-digit' }) }
setInterval(tick, 1000); tick()
const session = await requireAuth()
if (!session) throw new Error('Auth requise')
document.getElementById('connectedUser').textContent = `${session.profile.prenom || ''} ${session.profile.nom || ''}`.trim()
document.getElementById('logoutBtn').addEventListener('click', async () => { await logout(); location.href = '/rescuetrack/index.html' })
document.getElementById('dashboardBtn').addEventListener('click', () => { location.href = '/rescuetrack/dashboard.html' })
document.getElementById('searchBtn').addEventListener('click', () => { location.href = '/rescuetrack/search.html' })
const label = document.getElementById('selectedProvinceLabel')
const map = document.getElementById('svgMapContainer')
const libelle = p => !p ? 'Aucune province sélectionnée' : (p === '__aucune__' ? 'Préventifs sans province renseignée' : p)
function choisir(province) {
  if (!province) return
  map.querySelectorAll('[data-province]').forEach(el => el.classList.toggle('active', el.dataset.province === province))
  sessionStorage.setItem('selectedProvince', province)
  label.textContent = libelle(province)
  location.href = '/rescuetrack/evenements.html'
}
const res = await fetch('/rescuetrack/be.svg')
map.innerHTML = await res.text()
map.querySelectorAll('[data-province]').forEach(shape => {
  shape.classList.add('province-shape')
  shape.addEventListener('click', () => choisir(shape.dataset.province))
  shape.addEventListener('mouseenter', () => { label.textContent = libelle(shape.dataset.province) })
  shape.addEventListener('mouseleave', () => { label.textContent = libelle(sessionStorage.getItem('selectedProvince')) })
})
document.querySelectorAll('.province-list-btn').forEach(b => b.addEventListener('click', () => choisir(b.dataset.province)))
label.textContent = libelle(sessionStorage.getItem('selectedProvince'))
