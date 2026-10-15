import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { estResponsableAsblDepuisFiche, peutEditerEvenementsInternesDepuisFiche, peutEncoderDisposPourAutruiDepuisFiche } from '@/modules/fiche/ficheSchema'
import { estIdentiteGoogle, validerSessionGoogle } from '@/lib/authConnexion'

const AuthContext = createContext(null)

// Identités de compte (énuméré role_utilisateur). Qualifications ≠ rôle.
const STAFF = ['admin','president','coordinateur','tresorier','secretaire',
               'volontaire_medical','volontaire_non_medical']
const ADMINS  = ['admin','president']

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
  const [authErreur, setAuthErreur] = useState(null)
  const [besoinMfa, setBesoinMfa] = useState(false)
  const [mfaAEnroller, setMfaAEnroller] = useState(false)
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
        if (s) {
          setSession(s)
          evaluerMfa(s)
        }
        return
      }
      if (event === 'SIGNED_OUT') {
        setSession(null)
        setProfile(null)
        profileRef.current = null
        uid.current = null
        pret.current = true
        setMatrix({})
        setMatrixCount(0)
        setBesoinMfa(false)
        setMfaAEnroller(false)
        setLoading(false)
        return
      }
      if (!s) return
      setSession(s)
      const meme = pret.current && uid.current === s.user.id
      if (meme && event !== 'USER_UPDATED') return
      setTimeout(() => loadProfile(s.user.id), 0)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  async function loadMatrix() {
    const { data } = await supabase.from('acces_config').select('*')
    const map = {}; (data||[]).forEach(r => { map[`${r.dimension}:${r.sujet}:${r.acces}`] = r.autorise })
    setMatrix(map); setMatrixCount((data||[]).length)
  }

  async function evaluerMfa(sess) {
    if (!sess) {
      setBesoinMfa(false)
      setMfaAEnroller(false)
      return
    }
    try {
      const [{ data: aal }, { data: factors }, { data: regl }] = await Promise.all([
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        supabase.auth.mfa.listFactors(),
        supabase.from('app_reglages').select('valeur').eq('cle', 'mfa').maybeSingle(),
      ])
      const totp = (factors?.totp || []).filter(f => f.status === 'verified')
      const obligatoire = !!regl?.valeur?.obligatoire
      const role = profileRef.current?.role
      if (role === 'partenaire') {
        setBesoinMfa(false)
        setMfaAEnroller(false)
        return
      }
      const manqueCode = aal?.nextLevel === 'aal2' && aal?.currentLevel !== 'aal2'
      const forceEnrol = obligatoire && totp.length === 0
      setBesoinMfa(!!(manqueCode || forceEnrol))
      setMfaAEnroller(!!forceEnrol)
    } catch {
      setBesoinMfa(false)
      setMfaAEnroller(false)
    }
  }

  async function loadProfile(userId) {
    const silencieux = pret.current && uid.current === userId && !!profileRef.current
    if (!silencieux) setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    let { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()

    if (estIdentiteGoogle(user) && !silencieux) {
      const v = await validerSessionGoogle()
      if (!v.ok) {
        setAuthErreur(v.error)
        setLoading(false)
        await supabase.auth.signOut()
        return
      }
      setAuthErreur(null)
      if (!data) {
        const again = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
        data = again.data
      }
      if (!data) {
        setAuthErreur('Aucun compte Heart’s Angels pour cette adresse')
        setLoading(false)
        await supabase.auth.signOut()
        return
      }
    }

    setProfile(data || null)
    profileRef.current = data || null
    uid.current = userId
    pret.current = true
    await evaluerMfa((await supabase.auth.getSession()).data.session)
    setLoading(false)
    loadMatrix()
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
    if (perm === 'medical')     return ADMINS.includes(role) || estMedical()
    if (perm === 'staff')       return STAFF.includes(role)
    if (perm === 'partenaire')  return role === 'partenaire' && profile?.actif !== false
    return STAFF.includes(role)
  }

  function canAccess(feature) {
    if (!role || role === 'partenaire') return false
    if (ADMINS.includes(role) || accesTotal()) return true
    const BASE = ['dashboard','missions','defraiements','disponibilites','evenements']
    if (BASE.includes(feature)) return true
    if (feature === 'souhaits') return peutGererSouhaits() || matriceAutorise(feature)
    if (feature === 'stock' && peutGererStock()) return true
    return matriceAutorise(feature)
  }

  function estMedical() {
    const t = profile?.fiche?.type_benevole
    if (t === 'non_medical') return false
    if (t === 'medical') return true
    return role === 'volontaire_medical'
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
  function peutEncoderDisposPourAutrui() {
    return peutEncoderDisposPourAutruiDepuisFiche(role, rolesAsbl())
  }
  function peutVoirToutesDispos() {
    if (!role || role === 'partenaire') return false
    if (peutEncoderDisposPourAutrui()) return true
    if (accesTotal() || role === 'coordinateur') return true
    const roles = profile?.fiche?.roles_asbl || []
    return roles.some(r => [
      'president','vice_president',
      'coord_transport','coord_transport_adjoint',
      'recolteur_souhait',
      'coord_benevoles','coord_benevoles_adjoint',
    ].includes(r))
  }
  /** Alias : encoder le calendrier de quelqu’un d’autre (pas les équipes « soi »). */
  function peutGererDispos() {
    return peutEncoderDisposPourAutrui()
  }
  /** HTML + vignette : informatique (et admin / président). */
  function peutGererEvenementsInternes() {
    return peutEditerEvenementsInternesDepuisFiche(role, rolesAsbl())
  }
  /** Nombre (et noms) d’inscrits : responsables d’équipe ASBL, plus l’informatique. */
  function peutVoirInscritsEvenements() {
    if (peutGererEvenementsInternes()) return true
    return estResponsableAsblDepuisFiche(role, rolesAsbl())
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
  /** Suppression définitive d’une note : équipe informatique (et accès total). */
  function peutSupprimerNoteFrais() {
    if (!role || role === 'partenaire') return false
    if (accesTotal()) return true
    const roles = profile?.fiche?.roles_asbl || []
    return roles.some(r => ['resp_informatique', 'resp_informatique_adjoint'].includes(r))
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
  /** Président et responsable informatique : toutes les alertes, avec cases à cocher. */
  function peutReglerNotifications() {
    if (!role || role === 'partenaire') return false
    if (role === 'admin' || role === 'president') return true
    const roles = profile?.fiche?.roles_asbl || []
    return roles.some(r => r === 'president' || r === 'resp_informatique')
  }
  /** Président, vice-président, responsable informatique (pas l’adjoint) et récolteurs : archives PIN. */
  function peutOuvrirArchives() {
    if (!role || role === 'partenaire') return false
    if (!profile || profile.actif === false) return false
    const roles = profile?.fiche?.roles_asbl || []
    return roles.some(r => ['president', 'vice_president', 'resp_informatique', 'recolteur_souhait'].includes(r))
  }

  async function signOut() { await supabase.auth.signOut() }

  const value = useMemo(() => ({
    session, user: session?.user || null, profile, role, loading,
    authErreur, besoinMfa, mfaAEnroller, rafraichirMfa: () => evaluerMfa(session),
    can, canAccess, accesTotal, peutGererApp, estMedical, peutGererSouhaits,
    peutProgrammerSouhait, peutEncoderPatientSouhait,
    peutGererFiches, peutVoirToutesDispos, peutGererDispos, peutEncoderDisposPourAutrui, peutGererEvenementsInternes, peutVoirInscritsEvenements, peutGererStock, peutGererDefraiements, peutSupprimerNoteFrais, peutOuvrirArchives, peutReglerNotifications, estVolontaireNonMedical, estRecolteurSouhait,
    reloadMatrix: loadMatrix, signOut, reload: () => session && loadProfile(session.user.id),
  }), [session, profile, role, loading, matrix, matrixCount, authErreur, besoinMfa, mfaAEnroller])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>')
  return ctx
}
