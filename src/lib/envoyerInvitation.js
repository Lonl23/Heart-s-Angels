import { supabase } from '@/lib/supabase'
import config from '@/app.config'

async function jetonFrais() {
  const { data: refreshed } = await supabase.auth.refreshSession()
  if (refreshed?.session?.access_token) return refreshed.session.access_token
  const { data: sess } = await supabase.auth.getSession()
  return sess?.session?.access_token || ''
}

async function invokeEnvoyerInvitation(body) {
  const token = await jetonFrais()
  if (!token) {
    return { data: null, error: { message: 'Session expirée. Déconnecte-toi, reconnecte-toi, puis réessaie.' } }
  }
  const url = `${String(config.supabase.url).replace(/\/$/, '')}/functions/v1/envoyer-invitation`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: config.supabase.anonKey,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return { data, error: { message: data?.error || data?.message || 'Envoi impossible.' } }
  }
  return { data, error: null }
}

async function lireErreur(data, error) {
  const msg = data?.error || data?.message || error?.message || 'Envoi impossible.'
  if (msg === 'Non authentifié.' || msg === 'Non authentifié') {
    return 'Session expirée. Déconnecte-toi, reconnecte-toi, puis réessaie.'
  }
  return msg
}

/** Envoie l’invitation depuis laurent@heartsangels.be (fonction serveur). */
export async function envoyerInvitationEmail(code) {
  const c = String(code || '').trim()
  if (!c) return { ok: false, error: 'Code d’invitation manquant.' }
  const { data, error } = await invokeEnvoyerInvitation({ code: c })
  if (data?.ok) return { ok: true, email: data.email }
  return { ok: false, error: await lireErreur(data, error) }
}

/** Mail « ton compte est prêt » avec le bouton Accéder à l’application. */
export async function envoyerMailBienvenue() {
  const { data, error } = await invokeEnvoyerInvitation({ action: 'bienvenue' })
  if (data?.ok) return { ok: true }
  return { ok: false, error: await lireErreur(data, error) }
}

/** Demande un lien de réinitialisation (sans session). Toujours le même message côté écran. */
export async function demanderResetMotDePasse(email) {
  const adresse = String(email || '').trim()
  if (!adresse) return { ok: false, error: 'Indique ton adresse e-mail.' }
  const url = `${String(config.supabase.url).replace(/\/$/, '')}/functions/v1/envoyer-invitation`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: config.supabase.anonKey,
      Authorization: `Bearer ${config.supabase.anonKey}`,
    },
    body: JSON.stringify({ action: 'mot_de_passe_oublie', email: adresse }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return { ok: false, error: data?.error || data?.message || 'Envoi impossible.' }
  }
  return { ok: true }
}
