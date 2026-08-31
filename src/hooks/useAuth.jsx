import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const AuthContext = createContext(null)

// Groupes de rôles (alignés sur l'énuméré role_utilisateur en base)
const STAFF = ['admin','president','coordinateur','ambulancier_bleu','ambulancier_gris',
               'infirmier','medecin','volontaire_non_medical','tresorier','secretaire']
const ADMINS  = ['admin','president']
const MEDICAL = ['admin','president','medecin','infirmier']

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [matrix, setMatrix] = useState({})
  const [matrixCount, setMatrixCount] = useState(0)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session) loadProfile(data.session.user.id)
      else setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      if (s) loadProfile(s.user.id)
      else { setProfile(null); setLoading(false) }
    })
    loadMatrix()
    return () => sub.subscription.unsubscribe()
  }, [])

  async function loadMatrix() {
    const { data } = await supabase.from('acces_config').select('*')
    const map = {}; (data||[]).forEach(r => { map[`${r.dimension}:${r.sujet}:${r.acces}`] = r.autorise })
    setMatrix(map); setMatrixCount((data||[]).length)
  }

  async function loadProfile(userId) {
    setLoading(true)
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    setProfile(data || null)
    setLoading(false)
  }

  const role = profile?.role || null
  function can(perm) {
    if (!role) return false
    if (perm === 'admin')       return ADMINS.includes(role) || accesTotal()
    if (perm === 'medical')     return MEDICAL.includes(role)
    if (perm === 'staff')       return STAFF.includes(role)
    if (perm === 'partenaire')  return role === 'partenaire'
    // nav.* et autres → réservé au personnel interne
    return STAFF.includes(role)
  }

  function canAccess(feature) {
    if (!role || role === 'partenaire') return false
    if (ADMINS.includes(role) || accesTotal()) return true          // accès total
    const BASE = ['dashboard','missions','defraiements','disponibilites']
    if (BASE.includes(feature)) return true                          // socle : tout volontaire
    if (feature === 'souhaits') return peutGererSouhaits()
    // modules restreints (stock, annuaire, …) : via la matrice uniquement
    const fi = profile?.fiche || {}
    const sujets = [
      fi.type_benevole && ['type', fi.type_benevole],
      ...(Array.isArray(fi.qualifications) ? fi.qualifications.map(q => ['qualif', q]) : []),
      ...(Array.isArray(fi.roles_asbl) ? fi.roles_asbl.map(r => ['role', r]) : []),
    ].filter(Boolean)
    return sujets.some(([d, sj]) => matrix[`${d}:${sj}:${feature}`] === true)
  }

  function accesTotal() {
    if (ADMINS.includes(role)) return true
    const roles = profile?.fiche?.roles_asbl || []
    return roles.some(r => ['president','vice_president','resp_informatique','resp_informatique_adjoint','administrateur_asbl'].includes(r))
  }
  function estMedical() {
    if (['medecin','infirmier','ambulancier_bleu','ambulancier_gris'].includes(role)) return true
    return (profile?.fiche?.type_benevole) === 'medical'
  }
  function peutGererSouhaits() {
    if (!role || role === 'partenaire') return false
    if (accesTotal() || role === 'coordinateur') return true
    const roles = profile?.fiche?.roles_asbl || []
    return roles.some(r => ['coord_transport','coord_transport_adjoint','coord_medical','coord_medical_adjoint','recolteur_souhait'].includes(r))
  }
  function peutVoirSouhaitComplet() { return peutGererSouhaits() || estMedical() }
  // Peut attribuer type / qualifications aux bénévoles (coordinateur bénévoles + accès total)
  function peutGererFiches() {
    if (accesTotal()) return true
    const roles = profile?.fiche?.roles_asbl || []
    return roles.some(r => ['coord_benevoles','coord_benevoles_adjoint'].includes(r))
  }

  async function signOut() { await supabase.auth.signOut() }

  const value = { session, user: session?.user || null, profile, role, loading, can, canAccess, accesTotal, estMedical, peutGererSouhaits, peutVoirSouhaitComplet, peutGererFiches, reloadMatrix: loadMatrix, signOut, reload: () => session && loadProfile(session.user.id) }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>')
  return ctx
}
