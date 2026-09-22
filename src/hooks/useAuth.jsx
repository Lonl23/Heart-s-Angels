import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

const AuthContext = createContext(null)

// Groupes de rôles (alignés sur l'énuméré role_utilisateur en base)
const STAFF = ['admin','president','coordinateur','ambulancier_bleu','ambulancier_gris',
               'infirmier','medecin','volontaire_medical','volontaire_non_medical','tresorier','secretaire']
const ADMINS  = ['admin','president']
const MEDICAL = ['admin','president','medecin','infirmier']

/** Coordination transport, présidence, informatique : équipages, horaires, ambulances. */
const ROLES_PROGRAMME_SOUHAIT = [
  'president', 'vice_president',
  'resp_informatique', 'resp_informatique_adjoint',
  'coord_transport', 'coord_transport_adjoint',
]
/** Partie patient (récolte) : récolteur et coordination médicale. */
const ROLES_PATIENT_SOUHAIT = [
  'recolteur_souhait',
  'coord_medical', 'coord_medical_adjoint', 'coordinateur_medical',
]

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [matrix, setMatrix] = useState({})
  const [matrixCount, setMatrixCount] = useState(0)
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
    setMatrix(map); setMatrixCount((data||[]).length)
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
  function accesTotal() {
    if (ADMINS.includes(role)) return true
    const roles = profile?.fiche?.roles_asbl || []
    return roles.some(r => ['president','vice_president','resp_informatique','resp_informatique_adjoint','administrateur_asbl'].includes(r))
  }
  function peutGererApp() {
    if (!role || role === 'partenaire') return false
    if (ADMINS.includes(role)) return true
    const roles = profile?.fiche?.roles_asbl || []
    return roles.some(r => ['president','vice_president','resp_informatique','resp_informatique_adjoint'].includes(r))
  }
  function can(perm) {
    if (!role) return false
    if (perm === 'admin')       return peutGererApp()
    if (perm === 'medical')     return MEDICAL.includes(role)
    if (perm === 'staff')       return STAFF.includes(role)
    if (perm === 'partenaire')  return role === 'partenaire'
    return STAFF.includes(role)
  }

  function canAccess(feature) {
    if (!role || role === 'partenaire') return false
    if (ADMINS.includes(role) || accesTotal()) return true
    const BASE = ['dashboard','missions','defraiements','disponibilites']
    if (BASE.includes(feature)) return true
    if (feature === 'souhaits') return peutGererSouhaits() || matriceAutorise(feature)
    if (feature === 'stock' && peutGererStock()) return true
    return matriceAutorise(feature)
  }

  function estMedical() {
    if (['medecin','infirmier','ambulancier_bleu','ambulancier_gris','volontaire_medical'].includes(role)) return true
    return (profile?.fiche?.type_benevole) === 'medical'
  }
  function rolesAsbl() { return profile?.fiche?.roles_asbl || [] }
  function matriceAutorise(feature) {
    return rolesAsbl().some(r => matrix[`role:${r}:${feature}`] === true)
  }
  function peutProgrammerSouhait() {
    if (!role || role === 'partenaire') return false
    if (accesTotal() || role === 'coordinateur') return true
    return rolesAsbl().some(r => ROLES_PROGRAMME_SOUHAIT.includes(r))
  }
  function peutEncoderPatientSouhait() {
    if (!role || role === 'partenaire') return false
    if (peutProgrammerSouhait()) return true
    return rolesAsbl().some(r => ROLES_PATIENT_SOUHAIT.includes(r))
  }
  function peutGererSouhaits() {
    return peutProgrammerSouhait() || peutEncoderPatientSouhait()
  }
  function peutGererFiches() {
    if (accesTotal()) return true
    const roles = profile?.fiche?.roles_asbl || []
    return roles.some(r => ['coord_benevoles','coord_benevoles_adjoint'].includes(r))
  }
  function peutVoirToutesDispos() {
    if (!role || role === 'partenaire') return false
    if (accesTotal() || role === 'coordinateur') return true
    const roles = profile?.fiche?.roles_asbl || []
    return roles.some(r => [
      'president','vice_president',
      'coord_transport','coord_transport_adjoint',
      'recolteur_souhait',
      'coord_benevoles','coord_benevoles_adjoint',
    ].includes(r))
  }
  function peutGererDispos() {
    if (!role || role === 'partenaire') return false
    if (accesTotal() || role === 'coordinateur') return true
    const roles = profile?.fiche?.roles_asbl || []
    return roles.some(r => [
      'president','vice_president',
      'coord_transport','coord_transport_adjoint',
      'coord_benevoles','coord_benevoles_adjoint',
    ].includes(r))
  }
  function peutGererStock() {
    if (!role || role === 'partenaire') return false
    if (accesTotal() || role === 'coordinateur') return true
    const roles = profile?.fiche?.roles_asbl || []
    return roles.some(r => [
      'president','vice_president',
      'resp_logistique','resp_logistique_adjoint',
    ].includes(r))
  }
  function peutGererDefraiements() {
    if (!role || role === 'partenaire') return false
    if (accesTotal() || role === 'tresorier' || role === 'president') return true
    const roles = profile?.fiche?.roles_asbl || []
    return roles.some(r => ['president', 'vice_president', 'tresorier', 'tresorier_adjoint'].includes(r))
  }
  function estVolontaireNonMedical() {
    if (peutVoirToutesDispos()) return false
    const t = profile?.fiche?.type_benevole
    if (t === 'medical') return false
    return t === 'non_medical' || role === 'volontaire_non_medical'
  }
  function estRecolteurSouhait() {
    const roles = profile?.fiche?.roles_asbl || []
    return roles.includes('recolteur_souhait')
  }

  async function signOut() { await supabase.auth.signOut() }

  const value = useMemo(() => ({
    session, user: session?.user || null, profile, role, loading,
    can, canAccess, accesTotal, peutGererApp, estMedical, peutGererSouhaits,
    peutProgrammerSouhait, peutEncoderPatientSouhait,
    peutGererFiches, peutVoirToutesDispos, peutGererDispos, peutGererStock, peutGererDefraiements, estVolontaireNonMedical, estRecolteurSouhait,
    reloadMatrix: loadMatrix, signOut, reload: () => session && loadProfile(session.user.id),
  }), [session, profile, role, loading, matrix, matrixCount])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>')
  return ctx
}
