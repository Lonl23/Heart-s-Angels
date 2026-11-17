// © 2026 Heart's Angels ASBL & Laurent Noulin — Tous droits réservés.
// Biométrie WebAuthn : enregistrement et défi 2FA (Face ID / empreinte / Windows Hello).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from 'npm:@simplewebauthn/server@11.0.0'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const RP_NAME = "Heart's Angels"

function b64urlFromBytes(bytes: Uint8Array) {
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function bytesFromB64url(s: string) {
  const pad = '='.repeat((4 - (s.length % 4)) % 4)
  const b64 = (s + pad).replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function originsOk(origin: string): boolean {
  try {
    const u = new URL(origin)
    const h = u.hostname.toLowerCase()
    if (h === 'localhost' || h === '127.0.0.1') return true
    if (u.protocol !== 'https:') return false
    return (
      h === 'app.heartsangels.be'
      || h === 'appbetaapp.heartsangels.be'
      || h === 'heart-s-angels.web.app'
      || h === 'heart-s-angels.firebaseapp.com'
      || (h.includes('heart-s-angels--beta') && h.endsWith('.web.app'))
    )
  } catch {
    return false
  }
}

function preuveAleatoire() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(url, serviceKey)

    const authHeader = req.headers.get('Authorization') || ''
    const jwt = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!jwt || jwt.startsWith('sb_')) return json({ error: 'Non authentifié.' }, 401)

    let user = (await admin.auth.getUser(jwt)).data.user
    if (!user) {
      const asCaller = createClient(url, anonKey)
      user = (await asCaller.auth.getUser(jwt)).data.user
    }
    if (!user) return json({ error: 'Non authentifié.' }, 401)

    const body = await req.json().catch(() => ({})) as {
      action?: string
      origin?: string
      response?: unknown
      device_name?: string
      credential_db_id?: string
    }
    const action = String(body.action || '').trim()
    const origin = String(body.origin || req.headers.get('origin') || '').trim()
    if (!originsOk(origin)) return json({ error: 'Origine non autorisée.' }, 400)
    const rpID = new URL(origin).hostname

    if (action === 'register-options') {
      const { data: existing } = await admin
        .from('mfa_webauthn_credentials')
        .select('credential_id, transports')
        .eq('user_id', user.id)
      const exclude = (existing || []).map((c: { credential_id: string; transports: string[] }) => ({
        id: c.credential_id,
        type: 'public-key' as const,
        transports: c.transports || [],
      }))
      const options = await generateRegistrationOptions({
        rpName: RP_NAME,
        rpID,
        userID: new TextEncoder().encode(user.id),
        userName: user.email || user.id,
        userDisplayName: user.email || 'Volontaire',
        attestationType: 'none',
        excludeCredentials: exclude,
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'preferred',
        },
      })
      await admin.from('mfa_webauthn_challenges').upsert({
        user_id: user.id,
        challenge: options.challenge,
        kind: 'register',
        expire_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      })
      return json({ ok: true, options })
    }

    if (action === 'register-verify') {
      const { data: ch } = await admin
        .from('mfa_webauthn_challenges')
        .select('*')
        .eq('user_id', user.id)
        .eq('kind', 'register')
        .maybeSingle()
      if (!ch || new Date(ch.expire_at) < new Date()) {
        return json({ error: 'Défi expiré. Recommencez.' }, 400)
      }
      const verification = await verifyRegistrationResponse({
        response: body.response as never,
        expectedChallenge: ch.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        requireUserVerification: true,
      })
      if (!verification.verified || !verification.registrationInfo) {
        return json({ error: 'Enregistrement biométrique refusé.' }, 400)
      }
      const info = verification.registrationInfo as {
        credential?: { id?: string | Uint8Array; publicKey?: Uint8Array; counter?: number }
        credentialID?: string | Uint8Array
        credentialPublicKey?: Uint8Array
        counter?: number
      }
      const rawId = info.credential?.id ?? info.credentialID
      const rawKey = info.credential?.publicKey ?? info.credentialPublicKey
      const rawCounter = info.credential?.counter ?? info.counter ?? 0
      if (!rawId || !rawKey) return json({ error: 'Clé biométrique incomplète.' }, 400)
      const credentialID = typeof rawId === 'string'
        ? rawId
        : b64urlFromBytes(rawId instanceof Uint8Array ? rawId : new Uint8Array(rawId as ArrayBuffer))
      const publicKey = b64urlFromBytes(
        rawKey instanceof Uint8Array ? rawKey : new Uint8Array(rawKey as ArrayBuffer),
      )
      const transports = ((body.response as { response?: { transports?: string[] } })?.response?.transports) || []
      const deviceName = String(body.device_name || 'Cet appareil').slice(0, 80)
      await admin.from('mfa_webauthn_credentials').upsert({
        user_id: user.id,
        credential_id: credentialID,
        public_key: publicKey,
        counter: rawCounter || 0,
        device_name: deviceName,
        transports,
        last_used_at: new Date().toISOString(),
      }, { onConflict: 'user_id,credential_id' })
      await admin.from('mfa_webauthn_challenges').delete().eq('user_id', user.id)
      const { data: reg } = await admin.from('mfa_reglages').select('email_actif').eq('user_id', user.id).maybeSingle()
      await admin.from('mfa_reglages').upsert({
        user_id: user.id,
        email_actif: !!reg?.email_actif,
        webauthn_actif: true,
        updated_at: new Date().toISOString(),
      })
      const preuve = preuveAleatoire()
      await admin.from('mfa_webauthn_ok').upsert({
        user_id: user.id,
        preuve,
        valide_jusqua: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
      })
      return json({ ok: true, preuve })
    }

    if (action === 'auth-options') {
      const { data: creds } = await admin
        .from('mfa_webauthn_credentials')
        .select('credential_id, transports')
        .eq('user_id', user.id)
      if (!creds?.length) return json({ error: 'Aucune biométrie enregistrée.' }, 400)
      const options = await generateAuthenticationOptions({
        rpID,
        userVerification: 'required',
        allowCredentials: creds.map((c: { credential_id: string; transports: string[] }) => ({
          id: c.credential_id,
          type: 'public-key' as const,
          transports: c.transports || [],
        })),
      })
      await admin.from('mfa_webauthn_challenges').upsert({
        user_id: user.id,
        challenge: options.challenge,
        kind: 'authenticate',
        expire_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      })
      return json({ ok: true, options })
    }

    if (action === 'auth-verify') {
      const { data: ch } = await admin
        .from('mfa_webauthn_challenges')
        .select('*')
        .eq('user_id', user.id)
        .eq('kind', 'authenticate')
        .maybeSingle()
      if (!ch || new Date(ch.expire_at) < new Date()) {
        return json({ error: 'Défi expiré. Réessayez.' }, 400)
      }
      const resp = body.response as { id?: string }
      const credId = String(resp?.id || '')
      const { data: cred } = await admin
        .from('mfa_webauthn_credentials')
        .select('*')
        .eq('user_id', user.id)
        .eq('credential_id', credId)
        .maybeSingle()
      if (!cred) return json({ error: 'Appareil inconnu.' }, 400)
      const credential = {
        id: cred.credential_id,
        publicKey: bytesFromB64url(cred.public_key),
        counter: Number(cred.counter) || 0,
        transports: cred.transports || [],
      }
      const verification = await verifyAuthenticationResponse({
        response: body.response as never,
        expectedChallenge: ch.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        requireUserVerification: true,
        credential,
        // Ancien nom (compat) — SimpleWebAuthn v11 préfère `credential`.
        authenticator: {
          credentialID: bytesFromB64url(cred.credential_id),
          credentialPublicKey: bytesFromB64url(cred.public_key),
          counter: Number(cred.counter) || 0,
          transports: cred.transports || [],
        },
      } as never)
      if (!verification.verified) return json({ error: 'Biométrie refusée.' }, 400)
      const authInfo = verification.authenticationInfo as { newCounter?: number } | undefined
      const newCounter = authInfo?.newCounter
      await admin.from('mfa_webauthn_credentials').update({
        counter: typeof newCounter === 'number' ? newCounter : cred.counter,
        last_used_at: new Date().toISOString(),
      }).eq('id', cred.id)
      await admin.from('mfa_webauthn_challenges').delete().eq('user_id', user.id)
      const preuve = preuveAleatoire()
      await admin.from('mfa_webauthn_ok').upsert({
        user_id: user.id,
        preuve,
        valide_jusqua: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
      })
      return json({ ok: true, preuve })
    }

    if (action === 'remove') {
      const id = String(body.credential_db_id || '').trim()
      if (id) {
        await admin.from('mfa_webauthn_credentials').delete().eq('user_id', user.id).eq('id', id)
      } else {
        await admin.from('mfa_webauthn_credentials').delete().eq('user_id', user.id)
      }
      const { count } = await admin
        .from('mfa_webauthn_credentials')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
      if (!count) {
        const { data: reg } = await admin.from('mfa_reglages').select('email_actif').eq('user_id', user.id).maybeSingle()
        await admin.from('mfa_reglages').upsert({
          user_id: user.id,
          email_actif: !!reg?.email_actif,
          webauthn_actif: false,
          updated_at: new Date().toISOString(),
        })
        await admin.from('mfa_webauthn_ok').delete().eq('user_id', user.id)
      }
      return json({ ok: true })
    }

    return json({ error: 'Action inconnue.' }, 400)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('webauthn-2fa', msg)
    return json({ error: msg }, 500)
  }
})
