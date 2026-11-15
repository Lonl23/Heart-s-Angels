import { supabase } from '@/lib/supabase'
import { demanderCodeEmail as envoyerCodeEmail } from '@/lib/envoyerInvitation'
import { lirePreuveWebauthn, poserPreuveWebauthn } from '@/lib/webauthn'

const CLE_PREUVE = 'ha_2fa_preuve'

export function lirePreuve() {
  try { return sessionStorage.getItem(CLE_PREUVE) || '' } catch { return '' }
}

export function poserPreuve(preuve) {
  try {
    if (preuve) sessionStorage.setItem(CLE_PREUVE, preuve)
    else sessionStorage.removeItem(CLE_PREUVE)
  } catch { /* navigation privée */ }
}

export function srcQr(qr) {
  const s = String(qr || '')
  if (!s) return ''
  const prefix = 'data:image/svg+xml;utf-8,'
  if (s.startsWith(prefix)) {
    const reste = s.slice(prefix.length)
    if (reste.startsWith('<')) return prefix + encodeURIComponent(reste)
    return s
  }
  if (s.startsWith('data:')) return s
  return prefix + encodeURIComponent(s)
}

/**
 * Défi 2FA après le mot de passe.
 * — Biométrie validée sur cet appareil → pas de défi.
 * — Sinon TOTP et/ou e-mail : si les deux sont actifs, l’un ou l’autre suffit.
 */
export function besoinDefi({ totpActif, aal2, emailActif, emailOk, webauthnActif, webauthnOk }) {
  if (webauthnActif && webauthnOk) return false
  const totpManque = !!totpActif && !aal2
  const emailManque = !!emailActif && !emailOk
  if (totpActif && emailActif) return totpManque && emailManque
  return totpManque || emailManque
}

export function messageCode(err) {
  const m = String(err?.message || err || '')
  if (/invalid/i.test(m)) return 'Code incorrect.'
  if (/expired/i.test(m)) return 'Code expiré. Réessayez.'
  if (/already exists/i.test(m)) return 'Recommencez l’enregistrement de l’application.'
  return m || 'Opération impossible.'
}

export async function chargerFacteurs() {
  const [{ data: aal, error: aalErr }, { data: factors, error: facErr }, mail, wa] = await Promise.all([
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.auth.mfa.listFactors(),
    supabase.rpc('etat_email_2fa'),
    supabase.rpc('etat_webauthn_2fa'),
  ])
  if (aalErr || facErr || mail.error) {
    return { erreur: messageCode(aalErr || facErr || mail.error) }
  }
  const totp = factors?.totp?.[0] || null
  const emailActif = !!mail.data?.email_actif
  const webauthnActif = !!(wa.data?.webauthn_actif || mail.data?.webauthn_actif)
  const appareils = wa.data?.appareils || []
  let emailOk = false
  if (emailActif) {
    const preuve = lirePreuve()
    if (preuve) {
      const { data } = await supabase.rpc('email_2fa_valide', { p_preuve: preuve })
      emailOk = !!data
      if (!emailOk) poserPreuve('')
    }
  }
  let webauthnOk = false
  if (webauthnActif) {
    const preuveWa = lirePreuveWebauthn()
    if (preuveWa) {
      const { data } = await supabase.rpc('webauthn_2fa_valide', { p_preuve: preuveWa })
      webauthnOk = !!data
      if (!webauthnOk) poserPreuveWebauthn('')
    }
  }
  return {
    totp,
    aal2: aal?.currentLevel === 'aal2',
    emailActif,
    emailOk,
    webauthnActif,
    webauthnOk,
    appareils,
    facteursBruts: factors,
  }
}

export async function verifierTotp(factorId, code) {
  const saisi = String(code || '').replace(/\D/g, '')
  if (saisi.length !== 6) return { ok: false, erreur: 'Entrez les 6 chiffres.' }
  const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({ factorId })
  if (cErr) return { ok: false, erreur: messageCode(cErr) }
  const { error: vErr } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code: saisi,
  })
  if (vErr) return { ok: false, erreur: messageCode(vErr) }
  return { ok: true }
}

export async function verifierEmail(code, activer) {
  const saisi = String(code || '').replace(/\D/g, '')
  if (saisi.length !== 6) return { ok: false, erreur: 'Entrez les 6 chiffres.' }
  const { data, error } = await supabase.rpc('verifier_code_email_2fa', {
    p_code: saisi,
    p_activer: !!activer,
  })
  if (error) return { ok: false, erreur: messageCode(error) }
  if (!data?.ok) return { ok: false, erreur: data?.erreur || 'Code incorrect.' }
  poserPreuve(data.preuve || '')
  return { ok: true }
}

export async function demanderCodeEmail() {
  return envoyerCodeEmail()
}

export async function desactiverEmail() {
  const { data, error } = await supabase.rpc('desactiver_email_2fa')
  if (error) return { ok: false, erreur: messageCode(error) }
  if (data && data.ok === false) return { ok: false, erreur: data.erreur || 'Retrait impossible.' }
  poserPreuve('')
  return { ok: true }
}

export async function enrolerTotp() {
  const { data: liste } = await supabase.auth.mfa.listFactors()
  const pendants = (liste?.all || []).filter(f => f.factor_type === 'totp' && f.status !== 'verified')
  for (const f of pendants) {
    await supabase.auth.mfa.unenroll({ factorId: f.id })
  }
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: "Heart's Angels",
    issuer: "Heart's Angels",
  })
  if (error) return { ok: false, erreur: messageCode(error) }
  return {
    ok: true,
    factorId: data.id,
    qr: srcQr(data.totp?.qr_code),
    secret: data.totp?.secret || '',
  }
}

export async function retirerTotp(factorId) {
  const { error } = await supabase.auth.mfa.unenroll({ factorId })
  if (error) return { ok: false, erreur: messageCode(error) }
  return { ok: true }
}

export async function annulerEnrollement(factorId) {
  if (!factorId) return
  await supabase.auth.mfa.unenroll({ factorId })
}
