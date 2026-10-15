import { supabase } from '@/lib/supabase'
import { origineAutorisee } from '@/lib/environnement'

export const MSG_AUCUN_COMPTE_HA = 'Aucun compte Heart’s Angels pour cette adresse'

export function urlRedirectOAuth() {
  const origine = typeof window !== 'undefined' ? origineAutorisee(window.location.origin) : ''
  const base = origine || (typeof window !== 'undefined' ? window.location.origin : '')
  return `${String(base).replace(/\/$/, '')}/login`
}

export const MSG_GOOGLE_MAL_CONFIGURE =
  'La connexion Google n’est pas configurée. Dans Supabase → Authentication → Providers → Google, le Client ID doit ressembler à « ….apps.googleusercontent.com » (ce n’est pas gmail.com ni une adresse e-mail). Créez-le dans Google Cloud → Identifiants → ID client OAuth → Application Web, puis collez l’ID et le secret dans Supabase.'

export function clientIdGoogleValide(urlOuId) {
  const s = String(urlOuId || '')
  let id = s
  try {
    if (s.includes('://')) id = new URL(s).searchParams.get('client_id') || ''
  } catch { /* pas une URL */ }
  return /\.apps\.googleusercontent\.com$/i.test(id.trim())
}

export function traduireErreurAuth(brut) {
  const t = String(brut || '')
  const low = t.toLowerCase()
  if (!t) return null
  if (/upstream unreachable|invalid_client|unauthorized_client|invalid client/i.test(low)) {
    return MSG_GOOGLE_MAL_CONFIGURE
  }
  if (/provider is not enabled|unsupported provider|validation failed/i.test(t)) {
    return 'La connexion Google n’est pas encore activée. L’administrateur doit la configurer (Google Cloud + Supabase).'
  }
  if (/redirect|redirect_uri|redirect uri/i.test(low)) {
    return 'Adresse de retour Google non autorisée. Ajoutez cette adresse dans Supabase (URL Configuration) et Google Cloud.'
  }
  if (/aucun compte heart/i.test(low)) return MSG_AUCUN_COMPTE_HA
  if (/already registered|already been registered/i.test(low)) {
    return 'Cette adresse a déjà un compte. Connectez-vous par e-mail et mot de passe.'
  }
  if (/invalid login|invalid credentials|invalid_grant/i.test(low)) {
    return 'Identifiants incorrects.'
  }
  if (low === 'access_denied' || /access_denied/.test(low)) {
    return 'Connexion Google annulée.'
  }
  return t
}

export function erreurOAuthDepuisUrl(search = '', hash = '') {
  const q = new URLSearchParams(String(search || '').replace(/^\?/, ''))
  const h = new URLSearchParams(String(hash || '').replace(/^#/, ''))
  const brut = q.get('error_description') || h.get('error_description')
    || q.get('error') || h.get('error')
  return traduireErreurAuth(brut)
}

export function estIdentiteGoogle(user) {
  const providers = user?.app_metadata?.providers
  if (Array.isArray(providers) && providers.includes('google')) return true
  return user?.app_metadata?.provider === 'google'
}

export async function continuerAvecGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: urlRedirectOAuth(),
      skipBrowserRedirect: true,
      queryParams: { access_type: 'offline', prompt: 'select_account' },
    },
  })
  if (error) return { ok: false, error: traduireErreurAuth(error.message) || error.message }
  const url = data?.url
  if (!url) return { ok: false, error: MSG_GOOGLE_MAL_CONFIGURE }
  if (!clientIdGoogleValide(url)) return { ok: false, error: MSG_GOOGLE_MAL_CONFIGURE }
  if (typeof window !== 'undefined') window.location.assign(url)
  return { ok: true, url }
}

export async function validerSessionGoogle() {
  const { data: v, error } = await supabase.rpc('valider_connexion_google')
  if (error) return { ok: false, error: traduireErreurAuth(error.message) || error.message }
  if (v && v.ok === false) return { ok: false, error: v.error || MSG_AUCUN_COMPTE_HA }
  return { ok: true }
}
