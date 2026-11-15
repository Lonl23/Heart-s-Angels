// © 2026 Heart's Angels ASBL & Laurent Noulin — Tous droits réservés.
import { supabase } from './auth.js'

const time = document.getElementById('time')
setInterval(() => {
  time.textContent = new Date().toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}, 1000)

const params = new URLSearchParams(location.search)
const err = document.getElementById('loginError')
if (params.get('refus') === '1') {
  err.textContent = "Cet accès est réservé au personnel. Les dossiers de souhaits passent par Heart's Angels."
}

const { data } = await supabase.auth.getSession()
if (data.session && params.get('refus') !== '1') location.replace('/rescuetrack/province.html')

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault()
  err.textContent = ''
  const btn = document.getElementById('loginBtn')
  btn.disabled = true
  const { error } = await supabase.auth.signInWithPassword({
    email: document.getElementById('email').value.trim(),
    password: document.getElementById('password').value,
  })
  btn.disabled = false
  if (error) { err.textContent = 'Identifiants incorrects.'; return }
  const next = params.get('next')
  location.href = next && next.startsWith('/rescuetrack/') ? next : '/rescuetrack/province.html'
})
