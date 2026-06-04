// Edge Function : création d'un membre par un admin
// Déploiement : supabase functions deploy create-user

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Non autorisé.' }, 401)

    const token = authHeader.replace('Bearer ', '')
    const { data: { user: caller }, error: authErr } = await admin.auth.getUser(token)
    if (authErr || !caller) return json({ error: 'Session invalide.' }, 401)

    const { data: callerProfile } = await admin.from('profiles').select('role, roles_supplementaires').eq('id', caller.id).single()
    const callerRoles = [callerProfile?.role, ...(callerProfile?.roles_supplementaires || [])]
    const isAdmin = callerRoles.some(r => ['admin','president','vice_president','coordinateur'].includes(r))
    if (!isAdmin) return json({ error: 'Réservé aux administrateurs.' }, 403)

    const body = await req.json()
    const {
      prenom, nom, email, telephone, adresse, ville, notes,
      role = 'volontaire_non_medical', roles_supplementaires = [],
      type_benevole = 'non_medical', membre_ag = false,
      photo_url = null,
      quals = {},
    } = body

    if (!prenom || !nom || !email) {
      return json({ error: 'Prénom, nom et email requis.' }, 400)
    }

    const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')
    let baseLogin = slug(prenom)[0] + slug(nom)
    let login = baseLogin
    let n = 1
    while (true) {
      const { data: exist } = await admin.from('profiles').select('id').eq('login', login).maybeSingle()
      if (!exist) break
      login = baseLogin + n; n++
    }

    const password = genPassword()

    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { prenom, nom },
    })

    if (cErr) {
      if (cErr.message?.includes('already')) return json({ error: 'Cet email existe déjà.' }, 409)
      return json({ error: cErr.message }, 400)
    }

    const userId = created.user.id

    const { error: pErr } = await admin.from('profiles').upsert({
      id: userId, login, email, prenom, nom,
      telephone: telephone || null, adresse: adresse || null, ville: ville || null,
      role, roles_supplementaires, type_benevole, membre_ag,
      photo_url: photo_url || null,
      notes: notes || null, actif: true,
    })
    if (pErr) return json({ error: 'Profil : ' + pErr.message }, 400)

    for (const [type_qual, numero] of Object.entries(quals)) {
      if (!numero) continue
      await admin.from('qualifications').insert({ profile_id: userId, type_qual, numero: String(numero) })
    }

    return json({
      success: true, login, password, email,
      message: `Compte créé : login "${login}".`,
    }, 200)

  } catch (e) {
    return json({ error: (e instanceof Error ? e.message : 'Erreur serveur.') }, 500)
  }
})

function genPassword(): string {
  const cons = 'bcdfghjkmnpqrstvwxz'
  const vow = 'aeiou'
  let p = ''
  for (let i = 0; i < 2; i++) p += cons[Math.floor(Math.random()*cons.length)].toUpperCase() + vow[Math.floor(Math.random()*vow.length)]
  p += Math.floor(1000 + Math.random()*9000)
  p += '!'
  return p
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}