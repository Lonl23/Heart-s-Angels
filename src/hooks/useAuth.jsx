import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Récupérer la session initiale
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    })

    // Écouter les changements d'auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null)
        if (session?.user) {
          await fetchProfile(session.user.id)
          // Log de connexion
          if (event === 'SIGNED_IN') {
            await supabase.from('audit_logs').insert({
              user_id: session.user.id,
              action: 'LOGIN',
              table_name: 'auth',
            })
            // Mettre à jour dernière connexion
            await supabase.from('profiles')
              .update({ derniere_connexion: new Date().toISOString() })
              .eq('id', session.user.id)
          }
          if (event === 'SIGNED_OUT') {
            await supabase.from('audit_logs').insert({
              user_id: session.user.id,
              action: 'LOGOUT',
              table_name: 'auth',
            })
          }
        } else {
          setProfile(null)
          setLoading(false)
        }
      }
    )
    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data)
    setLoading(false)
  }

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function signOut() {
    await supabase.auth.signOut()
    setProfile(null)
  }

  async function resetPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    })
    if (error) throw error
  }

  // Vérification des permissions
  const can = {
    admin:        profile?.role === 'admin',
    president:    ['admin','president'].includes(profile?.role),
    coordinateur: ['admin','president','coordinateur'].includes(profile?.role),
    medical:      ['admin','president','coordinateur','ambulancier_bleu','ambulancier_gris','infirmier','medecin'].includes(profile?.role),
    tresorier:    ['admin','president','tresorier'].includes(profile?.role),
    seeFinances:  ['admin','president','tresorier','coordinateur'].includes(profile?.role),
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, can, signIn, signOut, resetPassword }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé dans AuthProvider')
  return ctx
}
