// ════════════════════════════════════════════════════════════════════════════
//  © 2026 Heart's Angels ASBL & Laurent Noulin — Tous droits réservés.
//  Fonction serveur sécurisée : création/gestion des comptes par un admin.
//  Utilise la clé service_role (JAMAIS exposée au navigateur) et vérifie que
//  l'appelant est bien admin/président avant toute action.
// ════════════════════════════════════════════════════════════════════════════
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const url        = Deno.env.get('SUPABASE_URL')!
    const anonKey    = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // 1) Identifier l'appelant à partir de son jeton
    const authHeader = req.headers.get('Authorization') || ''
    const asCaller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: { user }, error: uErr } = await asCaller.auth.getUser()
    if (uErr || !user) return json({ error: 'Non authentifié.' }, 401)

    // 2) Client admin (service_role) + vérification du rôle de l'appelant
    const admin = createClient(url, serviceKey)
    const { data: prof } = await admin.from('profiles').select('role').eq('id', user.id).single()
    if (!prof || !['admin', 'president'].includes(prof.role)) return json({ error: 'Accès refusé.' }, 403)

    const body = await req.json()

    switch (body.action) {
      case 'create': {
        const { email, password, prenom, nom, role, partenaire_id, doit_changer_mdp } = body
        if (!email || !password || !role) return json({ error: 'Champs manquants.' }, 400)
        const { data: created, error } = await admin.auth.admin.createUser({
          email, password, email_confirm: true, user_metadata: { prenom, nom },
        })
        if (error) return json({ error: error.message }, 400)
        const { error: pErr } = await admin.from('profiles').upsert({
          id: created.user.id, email, prenom, nom, role,
          partenaire_id: partenaire_id || null, doit_changer_mdp: !!doit_changer_mdp, actif: true,
        })
        if (pErr) return json({ error: pErr.message }, 400)
        return json({ ok: true, id: created.user.id })
      }
      case 'set_password': {
        const { user_id, password } = body
        if (!user_id || !password) return json({ error: 'Champs manquants.' }, 400)
        const { error } = await admin.auth.admin.updateUserById(user_id, { password })
        if (error) return json({ error: error.message }, 400)
        // un mot de passe fixé par l'admin ne force pas de changement
        await admin.from('profiles').update({ doit_changer_mdp: false }).eq('id', user_id)
        return json({ ok: true })
      }
      case 'set_active': {
        const { user_id, actif } = body
        const { error } = await admin.from('profiles').update({ actif }).eq('id', user_id)
        if (error) return json({ error: error.message }, 400)
        return json({ ok: true })
      }
      default:
        return json({ error: 'Action inconnue.' }, 400)
    }
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
