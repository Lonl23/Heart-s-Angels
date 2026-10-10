// © 2026 Heart's Angels ASBL & Laurent Noulin — Tous droits réservés.
// Envoie les notifications push (Web Push + FCM natif iOS/Android).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-ha-push-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const PUB = () => (Deno.env.get('APP_PUBLIC_URL') || 'https://heart-s-angels.web.app').replace(/\/$/, '')

type Cfg = {
  ok?: boolean
  vapid_public?: string
  vapid_private?: string
  hook_secret?: string
  fcm_service_account?: string
  subject?: string
}

function b64url(input: ArrayBuffer | Uint8Array) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input)
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

async function pemToKey(pem: string, usage: KeyUsage[]) {
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')
  const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
  return crypto.subtle.importKey('pkcs8', raw, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, usage)
}

async function fcmAccessToken(saRaw: string): Promise<string | null> {
  let sa: { client_email?: string; private_key?: string; token_uri?: string }
  try { sa = JSON.parse(saRaw) } catch { return null }
  if (!sa.client_email || !sa.private_key) return null
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(new TextEncoder().encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })))
  const payload = b64url(new TextEncoder().encode(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: sa.token_uri || 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })))
  const key = await pemToKey(sa.private_key, ['sign'])
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(`${header}.${payload}`),
  )
  const jwt = `${header}.${payload}.${b64url(sig)}`
  const res = await fetch(sa.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  if (!res.ok) return null
  const body = await res.json() as { access_token?: string }
  return body.access_token || null
}

async function envoyerFcm(token: string, titre: string, corps: string, lien: string, access: string) {
  const res = await fetch('https://fcm.googleapis.com/v1/projects/heart-s-angels/messages:send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        token,
        notification: { title: titre, body: corps },
        data: { lien, titre, corps },
        webpush: { fcm_options: { link: `${PUB()}${lien.startsWith('/') ? lien : '/' + lien}` } },
        android: { priority: 'HIGH', notification: { sound: 'default', click_action: 'FCM_PLUGIN_ACTIVITY' } },
        apns: { payload: { aps: { sound: 'default', badge: 1 } } },
      },
    }),
  })
  return res
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ ok: false, error: 'méthode' }, 405)

  const url = Deno.env.get('SUPABASE_URL') || ''
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  const sb = createClient(url, service, { auth: { persistSession: false } })
  const { data: cfg } = await sb.rpc('push_config') as { data: Cfg | null }
  const secret = String(cfg?.hook_secret || '').trim()
  const got = (req.headers.get('x-ha-push-secret') || '').trim()
  if (!secret || got !== secret) return json({ ok: false, error: 'interdit' }, 401)

  let body: { ids?: string[] } = {}
  try { body = await req.json() } catch { body = {} }
  const ids = Array.isArray(body.ids) ? body.ids.filter((x) => typeof x === 'string') : []
  if (!ids.length) return json({ ok: true, sent: 0 })

  const { data: notifs } = await sb
    .from('notifications')
    .select('id, destinataire_id, titre, message, lien, type')
    .in('id', ids)
  const rows = notifs || []
  if (!rows.length) return json({ ok: true, sent: 0 })

  const destIds = [...new Set(rows.map((n) => n.destinataire_id).filter(Boolean))]
  const { data: tokens } = await sb
    .from('push_tokens')
    .select('id, user_id, plateforme, token, abonnement')
    .in('user_id', destIds)
  const byUser = new Map<string, typeof tokens>()
  for (const t of tokens || []) {
    const list = byUser.get(t.user_id) || []
    list.push(t)
    byUser.set(t.user_id, list)
  }

  if (cfg?.ok && cfg.vapid_public && cfg.vapid_private) {
    webpush.setVapidDetails(cfg.subject || 'mailto:laurent@heartsangels.be', cfg.vapid_public, cfg.vapid_private)
  }

  let fcmTok: string | null = null
  if (cfg?.fcm_service_account) {
    try { fcmTok = await fcmAccessToken(cfg.fcm_service_account) } catch { fcmTok = null }
  }

  let sent = 0
  const stale: string[] = []
  for (const n of rows) {
    const titre = n.titre || "Heart's Angels"
    const corps = String(n.message || '').slice(0, 240)
    const lien = n.lien || '/app'
    const payload = JSON.stringify({ title: titre, body: corps, message: corps, lien, type: n.type, id: n.id })
    for (const t of byUser.get(n.destinataire_id) || []) {
      try {
        if (t.plateforme === 'web' && t.abonnement && cfg?.ok) {
          await webpush.sendNotification(t.abonnement, payload, { TTL: 86400, urgency: 'high' })
          sent++
        } else if ((t.plateforme === 'android' || t.plateforme === 'ios') && fcmTok) {
          const res = await envoyerFcm(t.token, titre, corps, lien, fcmTok)
          if (res.status === 404 || res.status === 410) stale.push(t.id)
          else if (res.ok) sent++
        }
      } catch (e) {
        const status = (e as { statusCode?: number })?.statusCode
        if (status === 404 || status === 410) stale.push(t.id)
      }
    }
  }
  if (stale.length) await sb.from('push_tokens').delete().in('id', stale)
  return json({ ok: true, sent })
})
