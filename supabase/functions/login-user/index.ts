// Edge Function : connexion par login (username)
// Déploiement : supabase functions deploy login-user --no-verify-jwt

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { login, password } = await req.json()
    console.log('[login-user] tentative login:', login)

    if (!login || !password) {
      return json({ error: 'Login et mot de passe requis.' }, 400)
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const ANON_KEY     = Deno.env.get('SUPABASE_ANON_KEY')

    if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
      console.error('[login-user] Variables env manquantes')
      return json({ error: 'Configuration serveur incomplète.' }, 500)
    }

    // 1. Retrouver l'email depuis le login (service role)
    const admin = createClient(SUPABASE_URL, SERVICE_KEY)
    const { data: profile, error: pErr } = await admin
      .from('profiles')
      .select('email, actif')
      .eq('login', String(login).toLowerCase().trim())
      .maybeSingle()

    console.log('[login-user] profil trouvé:', profile?.email, 'erreur:', pErr?.message)

    if (pErr) {
      return json({ error: 'Erreur base de données : ' + pErr.message }, 500)
    }
    if (!profile) {
      return json({ error: 'Identifiant inconnu.' }, 401)
    }
    if (profile.actif === false) {
      return json({ error: 'Compte désactivé.' }, 403)
    }
    if (!profile.email) {
      return json({ error: 'Aucun email associé à ce login.' }, 500)
    }

    // 2. Connexion avec l'email réel
    const authClient = createClient(SUPABASE_URL, ANON_KEY)
    const { data: sess, error: sErr } = await authClient.auth.signInWithPassword({
      email: profile.email,
      password,
    })

    console.log('[login-user] signIn résultat — session:', !!sess?.session, 'erreur:', sErr?.message)

    if (sErr || !sess?.session) {
      return json({ error: 'Mot de passe incorrect.' }, 401)
    }

    return json({ session: sess.session, user: sess.user }, 200)

  } catch (e) {
    console.error('[login-user] exception:', e)
    return json({ error: (e instanceof Error ? e.message : 'Erreur serveur.') }, 500)
  }
})

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}