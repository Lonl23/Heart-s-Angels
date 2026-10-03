import { supabase } from '@/lib/supabase'

async function jetonSession() {
  const { data: sess } = await supabase.auth.getSession()
  let token = sess?.session?.access_token
  if (!token) {
    const { data: refreshed } = await supabase.auth.refreshSession()
    token = refreshed?.session?.access_token
  }
  return token || ''
}

async function invokeEnvoyerInvitation(body) {
  const token = await jetonSession()
  if (!token) {
    return { data: null, error: { message: 'Session expirée. Reconnecte-toi puis réessaie.' } }
  }
  return supabase.functions.invoke('envoyer-invitation', {
    body,
    headers: { Authorization: `Bearer ${token}` },
  })
}

async function lireErreur(data, error) {
  if (data?.error) return data.error
  if (error?.context) {
    try {
      const body = await error.context.json()
      if (body?.error) return body.error
      if (body?.message) return body.message
    } catch { /* ignore */ }
  }
  if (error?.message && error.message !== 'Edge Function returned a non-2xx status code') {
    return error.message
  }
  return 'Envoi impossible.'
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
