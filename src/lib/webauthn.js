import { startRegistration, startAuthentication, browserSupportsWebAuthn } from '@simplewebauthn/browser'
import { supabase } from '@/lib/supabase'
import config from '@/app.config'

const CLE_PREUVE_WA = 'ha_2fa_webauthn_preuve'

export function lirePreuveWebauthn() {
  try { return sessionStorage.getItem(CLE_PREUVE_WA) || '' } catch { return '' }
}

export function poserPreuveWebauthn(preuve) {
  try {
    if (preuve) sessionStorage.setItem(CLE_PREUVE_WA, preuve)
    else sessionStorage.removeItem(CLE_PREUVE_WA)
  } catch { /* navigation privée */ }
}

export function biométrieDispo() {
  return typeof window !== 'undefined' && browserSupportsWebAuthn()
}

async function jetonFrais() {
  const { data: refreshed } = await supabase.auth.refreshSession()
  if (refreshed?.session?.access_token) return refreshed.session.access_token
  const { data: sess } = await supabase.auth.getSession()
  return sess?.session?.access_token || ''
}

async function appeler(body) {
  const token = await jetonFrais()
  if (!token) return { ok: false, error: 'Session expirée. Reconnectez-vous.' }
  const url = `${String(config.supabase.url).replace(/\/$/, '')}/functions/v1/webauthn-2fa`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: config.supabase.anonKey,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ ...body, origin: window.location.origin }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) return { ok: false, error: data?.error || data?.message || 'Biométrie impossible.' }
  return { ok: true, ...data }
}

export async function enrolerBiometrie(deviceName) {
  if (!biométrieDispo()) {
    return { ok: false, error: 'Cet appareil ne propose pas Face ID, empreinte ou Windows Hello dans ce navigateur.' }
  }
  const prep = await appeler({ action: 'register-options' })
  if (!prep.ok) return prep
  let attestation
  try {
    attestation = await startRegistration({ optionsJSON: prep.options })
  } catch (e) {
    const msg = String(e?.message || e || '')
    if (/cancel|not allowed|abort/i.test(msg)) return { ok: false, error: 'Biométrie annulée.' }
    return { ok: false, error: msg || 'Enregistrement impossible.' }
  }
  const verif = await appeler({
    action: 'register-verify',
    response: attestation,
    device_name: deviceName || nomAppareil(),
  })
  if (!verif.ok) return verif
  if (verif.preuve) poserPreuveWebauthn(verif.preuve)
  return { ok: true }
}

export async function verifierBiometrie() {
  if (!biométrieDispo()) {
    return { ok: false, error: 'Biométrie indisponible sur cet appareil.' }
  }
  const prep = await appeler({ action: 'auth-options' })
  if (!prep.ok) return prep
  let assertion
  try {
    assertion = await startAuthentication({ optionsJSON: prep.options })
  } catch (e) {
    const msg = String(e?.message || e || '')
    if (/cancel|not allowed|abort/i.test(msg)) return { ok: false, error: 'Biométrie annulée.' }
    return { ok: false, error: msg || 'Vérification impossible.' }
  }
  const verif = await appeler({ action: 'auth-verify', response: assertion })
  if (!verif.ok) return verif
  if (verif.preuve) poserPreuveWebauthn(verif.preuve)
  return { ok: true }
}

export async function retirerBiometrie(credentialDbId) {
  const res = await appeler({ action: 'remove', credential_db_id: credentialDbId || '' })
  if (res.ok) poserPreuveWebauthn('')
  return res
}

export function nomAppareil() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  if (/iPhone|iPad/i.test(ua)) return 'iPhone / iPad'
  if (/Android/i.test(ua)) return 'Android'
  if (/Mac/i.test(ua)) return 'Mac'
  if (/Windows/i.test(ua)) return 'Windows'
  return 'Cet appareil'
}
