// © 2026 Heart's Angels ASBL & Laurent Noulin — Tous droits réservés.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { estPageConnexion, rt } from './paths.js'

const cfg = window.__APP_CONFIG__?.supabase || {}
export const supabase = createClient(cfg.url || '', cfg.anonKey || '', {
  auth: { storage: localStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
})

export async function requireAuth() {
  const { data } = await supabase.auth.getSession()
  if (!data.session) {
    const ici = location.pathname + location.search
    if (!estPageConnexion(location.pathname)) {
      location.href = rt('index.html') + '?next=' + encodeURIComponent(ici)
    }
    return null
  }
  const { data: profile } = await supabase.from('profiles')
    .select('id,prenom,nom,email,role,fiche,actif')
    .eq('id', data.session.user.id)
    .maybeSingle()
  if (!profile || profile.actif === false || profile.role === 'partenaire') {
    location.href = rt('index.html') + '?refus=1'
    return null
  }
  return { authUser: data.session.user, profile }
}

export async function logout() {
  await supabase.auth.signOut()
}
