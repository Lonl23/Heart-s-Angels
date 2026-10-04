// ════════════════════════════════════════════════════════════════════════
//  © 2026 Heart's Angels ASBL & Laurent Noulin — Tous droits réservés.
//  Envoie la file d'alertes stock (Resend) au responsable logistique
//  et à son adjoint. Appelée par le cron du matin, par un changement
//  de stock, ou par un responsable qui ouvre la page Stock.
// ════════════════════════════════════════════════════════════════════════
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-alertes-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

function echapper(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Méthode refusée.' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const attendu = Deno.env.get('ALERTES_SECRET') || ''
  const recu = req.headers.get('x-alertes-secret') || ''
  const auth = req.headers.get('Authorization') || ''

  const admin = createClient(url, serviceKey)
  let autorise = !!(attendu && recu === attendu)
  if (!autorise) {
    const commeLui = createClient(url, anonKey, { global: { headers: { Authorization: auth } } })
    const { data: { user } } = await commeLui.auth.getUser()
    if (!user) return json({ error: 'Non authentifié.' }, 401)
    const { data: peut } = await commeLui.rpc('peut_gerer_stock')
    if (!peut) return json({ error: 'Réservé à la logistique.' }, 403)
  }

  const prep = await admin.rpc('preparer_alertes_stock')
  if (prep.error) return json({ error: prep.error.message }, 500)

  const cle = Deno.env.get('RESEND_API_KEY') || ''
  const from = Deno.env.get('ALERTES_FROM') || ''
  if (!cle || !from) {
    return json({
      ok: false,
      error: 'Messagerie non configurée : RESEND_API_KEY et ALERTES_FROM.',
    }, 503)
  }

  let envoyes = 0
  let pris = 0
  const erreurs: string[] = []

  for (let tour = 0; tour < 5; tour++) {
    const { data: rows, error: pErr } = await admin.rpc('prendre_alertes_mail')
    if (pErr) return json({ error: pErr.message, envoyes, erreurs }, 500)
    const file = rows || []
    if (file.length === 0) break
    pris += file.length

    for (const row of file) {
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${cle}`,
          },
          body: JSON.stringify({
            from,
            to: [row.email],
            subject: row.sujet,
            text: row.corps,
            html: `<div style="font-family:sans-serif;white-space:pre-wrap">${echapper(row.corps)}</div>`,
          }),
        })
        if (!res.ok) {
          const detail = await res.text()
          erreurs.push(detail.slice(0, 180))
          await admin.rpc('marquer_alerte_mail', { p_id: row.id, p_erreur: detail.slice(0, 500) })
          continue
        }
        await admin.rpc('marquer_alerte_mail', { p_id: row.id, p_erreur: null })
        envoyes += 1
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        erreurs.push(msg)
        await admin.rpc('marquer_alerte_mail', { p_id: row.id, p_erreur: msg })
      }
    }
  }

  return json({ ok: erreurs.length === 0, envoyes, en_attente: pris - envoyes, erreurs })
})
