import { supabase } from '@/lib/supabase'

/** Envoie l’invitation depuis laurent@heartsangels.be (fonction serveur). */
export async function envoyerInvitationEmail(code) {
  const c = String(code || '').trim()
  if (!c) return { ok: false, error: 'Code d’invitation manquant.' }
  const { data, error } = await supabase.functions.invoke('envoyer-invitation', { body: { code: c } })
  if (data?.ok) return { ok: true, email: data.email }
  let msg = data?.error
  if (!msg && error) {
    try {
      if (typeof error.context?.json === 'function') {
        const body = await error.context.json()
        msg = body?.error
      }
    } catch { /* ignore */ }
    msg = msg || error.message
  }
  return { ok: false, error: msg || 'Envoi impossible.' }
}

/** Mail « ton compte est prêt » avec le bouton Accéder à l’application. */
export async function envoyerMailBienvenue() {
  const { data, error } = await supabase.functions.invoke('envoyer-invitation', { body: { action: 'bienvenue' } })
  if (data?.ok) return { ok: true }
  return { ok: false, error: data?.error || error?.message || 'Envoi impossible.' }
}
