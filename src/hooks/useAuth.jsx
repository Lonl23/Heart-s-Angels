import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { calculerDroits } from '@/droits'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [matrix, setMatrix] = useState({})
  const pret = useRef(false)
  const uid = useRef(null)
  const profileRef = useRef(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session) loadProfile(data.session.user.id)
      else { pret.current = true; setLoading(false) }
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      // Un rafraîchissement de jeton (onglet en arrière-plan) peut émettre
      // TOKEN_REFRESHED, SIGNED_IN, voire un SIGNED_OUT transitoire : ne jamais
      // démonter l'écran ni envoyer vers /login.
      if (event === 'TOKEN_REFRESHED') {
        if (s) setSession(s)
        return
      }
      if (event === 'SIGNED_OUT') {
        setSession(null)
        setProfile(null)
        profileRef.current = null
        uid.current = null
        pret.current = true
        setLoading(false)
        return
      }
      if (!s) return
      setSession(s)
      const meme = pret.current && uid.current === s.user.id
      if (meme && event !== 'USER_UPDATED') return
      setTimeout(() => loadProfile(s.user.id), 0)
    })
    loadMatrix()
    return () => sub.subscription.unsubscribe()
  }, [])

  async function loadMatrix() {
    const { data } = await supabase.from('acces_config').select('*')
    const map = {}; (data||[]).forEach(r => { map[`${r.dimension}:${r.sujet}:${r.acces}`] = r.autorise })
    setMatrix(map)
  }

  async function loadProfile(userId) {
    const silencieux = pret.current && uid.current === userId && !!profileRef.current
    if (!silencieux) setLoading(true)
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    setProfile(data || null)
    profileRef.current = data || null
    uid.current = userId
    pret.current = true
    setLoading(false)
  }

  const role = profile?.role || null
  const droits = useMemo(() => calculerDroits(profile, matrix), [profile, matrix])

  async function signOut() { await supabase.auth.signOut() }

  const value = useMemo(() => ({
    session, user: session?.user || null, profile, role, loading,
    ...droits,
    reloadMatrix: loadMatrix, signOut, reload: () => session && loadProfile(session.user.id),
  }), [session, profile, role, loading, droits])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>')
  return ctx
}
