import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const AuthContext = createContext(null)

export const PHASES_RECOLTEUR = ['nouvelle','contact','evaluation','planifie']

// ── QUALIFICATIONS (compétences médicales / non-médicales) ──
const QUALIF_MEDICALES = ['ambulancier','infirmier','medecin','kinesitherapeute','aide_soignant','psychologue','volontaire_medical']

// ── FONCTIONS ASBL (postes occupés) ──
export const FONCTIONS_LABELS = {
  administrateur:      'Administrateur (CA)',
  president:           'Président',
  vice_president:      'Vice-président',
  secretaire:          'Secrétaire',
  tresorier:           'Trésorier',
  coord_medical:       'Coordinateur médical',
  coord_projets:       'Coordinateur projets',
  coord_logistique:    'Coordinateur logistique',
  coord_transports:    'Coordinateur transports',
  coord_benevoles:     'Coordinateur bénévoles',
  coord_informatique:  'Coordinateur informatique',
  relations_publiques: 'Relations publiques',
  recolteur_souhaits:  'Récolteur de souhaits',
}
// Fonctions pouvant avoir un adjoint
export const FONCTIONS_AVEC_ADJOINT = ['coord_medical','coord_projets','coord_logistique','coord_transports','coord_benevoles']

// Raccourcis de groupes de fonctions
const F = {
  direction:  ['president','vice_president'],
  coordsTous: ['coord_medical','coord_projets','coord_logistique','coord_transports','coord_benevoles','coord_informatique'],
}

// ── MATRICE DES ACCÈS (issue de la matrice validée) ──
// Chaque clé liste les FONCTIONS qui ont l'accès. Le niveau 'super_user' a TOUT.
// Les adjoints héritent des accès de leur fonction (la validation en cascade est gérée séparément).
const PERM_MATRIX = {
  // Universels (toute personne connectée)
  'nav.dashboard':        '*',
  'nav.organigramme':     '*',
  'dispo.encode':         '*',
  'defraiements.saisir':  '*',

  // Organigramme — gestion rôles/membres
  'organigramme.manage':  ['president','vice_president','coord_informatique'],

  // Disponibilités — voir toutes
  'dispo.viewall':        ['president','vice_president','coord_medical','coord_transports','coord_benevoles','coord_informatique'],

  // Défraiements — valider
  'defraiements.validate':['president','vice_president','tresorier','coord_logistique','coord_transports','coord_benevoles','coord_informatique'],

  // Souhaits
  'souhaits.encours':     ['president','vice_president','coord_medical','recolteur_souhaits','coord_informatique'],
  'souhaits.recolte':     ['president','vice_president','coord_medical','recolteur_souhaits','coord_informatique'],
  'souhaits.logistique':  ['president','vice_president','coord_medical','coord_logistique','coord_transports','coord_informatique'],
  'souhaits.nombre':      ['president','vice_president','coord_medical','relations_publiques','recolteur_souhaits','coord_informatique'],

  // Modules de gestion
  'nav.comptabilite':     ['president','vice_president','tresorier','coord_projets','coord_informatique'],
  'nav.vente':            ['president','vice_president','tresorier','relations_publiques','coord_informatique'],
  'nav.benevoles':        ['president','vice_president','coord_medical','coord_transports','coord_benevoles','coord_informatique'],
  'nav.stock':            ['president','vice_president','tresorier','coord_logistique','coord_informatique'],
  'nav.contenu':          ['president','relations_publiques','coord_informatique'],

  // Caisse événementielle (mode "aveugle" : encoder sans voir les totaux) — bénévoles
  'vente.caisse_evenement': '*',

  // ── Clés agrégées pour la navigation et compat composants ──
  'nav.disponibilites':   '*',   // tout le monde encode au moins les siens
  'nav.defraiements':     '*',
  'nav.souhaits':         ['president','vice_president','coord_medical','coord_logistique','coord_transports','recolteur_souhaits','relations_publiques','coord_informatique', ...QUALIF_MEDICALES],
  'nav.volontaires':      ['president','vice_president','coord_medical','coord_transports','coord_benevoles','coord_informatique'],

  // Sous-permissions héritées (compat ancien code)
  'souhaits.read':        ['president','vice_president','coord_medical','recolteur_souhaits','coord_informatique', ...QUALIF_MEDICALES],
  'souhaits.create':      ['president','vice_president','coord_medical','recolteur_souhaits','coord_informatique'],
  'souhaits.edit':        ['president','vice_president','coord_medical','coord_informatique'],
  'compta.full':          ['president','vice_president','tresorier','coord_projets','coord_informatique'],
  'stock.read':           ['president','vice_president','tresorier','coord_logistique','coord_informatique'],
  'stock.write':          ['president','vice_president','coord_logistique','coord_informatique'],
  'volontaires.read':     ['president','vice_president','coord_medical','coord_transports','coord_benevoles','coord_informatique'],
  'vente.create':         ['president','vice_president','tresorier','relations_publiques','coord_informatique'],
  'seeFinances':          ['president','vice_president','tresorier','coord_projets','coord_informatique'],

  // Accès super-user (mode protégé par mot de passe, réservé coord. informatique)
  'super_user.mode':      ['coord_informatique'],
}

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [simMode, setSimMode] = useState(() => localStorage.getItem('ha_sim_mode') === 'true')

  useEffect(() => {
    let mounted = true

    async function init() {
      try {
        // getSession lit le localStorage — quasi instantané
        const { data: { session } } = await supabase.auth.getSession()
        if (!mounted) return

        if (!session?.user) {
          setUser(null)
          setLoading(false)
          return
        }

        setUser(session.user)
        // On libère l'écran TOUT DE SUITE : le profil se charge en arrière-plan
        setLoading(false)
        loadProfile(session.user.id, session.user.email)
      } catch (e) {
        console.error('init auth error:', e)
        if (mounted) setLoading(false)
      }
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return
      setUser(session?.user ?? null)
      if (session?.user) {
        // arrière-plan, ne bloque jamais
        loadProfile(session.user.id, session.user.email)
        if (event === 'SIGNED_IN') {
          supabase.from('audit_logs').insert({ user_id: session.user.id, action: 'LOGIN', table_name: 'auth' }).then(()=>{}, ()=>{})
        }
      } else {
        setProfile(null)
      }
      setLoading(false)
    })

    return () => { mounted = false; subscription.unsubscribe() }
  }, [])

  async function loadProfile(userId, email = '') {
    // Affiche un profil de secours temporaire après 3s SI rien n'est encore chargé,
    // mais la vraie requête continue et remplacera le fallback dès qu'elle arrive.
    const fallbackTimer = setTimeout(() => {
      setProfile(prev => prev || {
        id: userId, email, prenom: '', nom: '',
        role: 'admin', actif: true, roles_supplementaires: [], _fallback: true,
      })
    }, 3000)

    try {
      const { data, error } = await supabase
        .from('profiles').select('*').eq('id', userId).maybeSingle()
      clearTimeout(fallbackTimer)

      if (error) {
        console.warn('loadProfile erreur:', error.message)
        setProfile(prev => prev || { id:userId, email, prenom:'', nom:'', role:'admin', actif:true, roles_supplementaires:[], _fallback:true })
        return
      }
      if (data) {
        setProfile(data)   // vrai profil — remplace le fallback s'il était affiché
      } else {
        setProfile(prev => prev || { id:userId, email, prenom:'', nom:'', role:'admin', actif:true, roles_supplementaires:[], _fallback:true })
      }
    } catch (e) {
      clearTimeout(fallbackTimer)
      console.warn('loadProfile exception:', e?.message)
      setProfile(prev => prev || { id:userId, email, prenom:'', nom:'', role:'admin', actif:true, roles_supplementaires:[], _fallback:true })
    }
  }

  // Liste effective des fonctions (titulaire + adjoint, qui hérite des mêmes accès)
  function mesFonctions() {
    if (!profile) return []
    return [...(profile.fonctions || []), ...(profile.fonctions_adjoint || [])]
  }
  // Est-on adjoint (et pas titulaire) d'une fonction ? → validations en cascade
  function estAdjoint(fonction) {
    if (!profile) return false
    return (profile.fonctions_adjoint || []).includes(fonction) && !(profile.fonctions || []).includes(fonction)
  }

  function can(perm) {
    if (!profile) return false
    // SUPER-USER : accès total (sauf le mode super-user lui-même qui reste explicite)
    if (profile.niveau_acces === 'super_user' && perm !== 'super_user.mode') return true
    const allowed = PERM_MATRIX[perm]
    if (allowed === undefined) return false
    if (allowed === '*') return true
    // Le coordinateur informatique en simMode peut voir les modules en simulation
    if (simMode && mesFonctions().includes('coord_informatique')) return true
    return mesFonctions().some(f => allowed.includes(f))
  }

  // hasRole : compatibilité — vérifie fonction OU qualification (role)
  function hasRole(r) {
    if (!profile) return false
    return profile.role === r
      || (profile.roles_supplementaires || []).includes(r)
      || mesFonctions().includes(r)
  }

  function souhaitsAccess() {
    if (!profile) return 'none'
    if (profile.niveau_acces === 'super_user') return 'all'
    const f = mesFonctions()
    if (simMode && f.includes('coord_informatique')) return 'all'
    if (f.some(x => ['president','vice_president','coord_medical'].includes(x))) return 'all'
    if (f.includes('recolteur_souhaits')) return 'avant_realisation'
    if ([profile.role, ...(profile.roles_supplementaires||[])].some(r => QUALIF_MEDICALES.includes(r))) return 'affecte'
    return 'none'
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
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/new-password` })
    if (error) throw error
  }

  async function retryProfile() {
    if (!user) return
    setLoading(true)
    await loadProfile(user.id, user.email)
    setLoading(false)
  }

  function toggleSimMode() {
    const next = !simMode
    localStorage.setItem('ha_sim_mode', String(next))
    setSimMode(next)
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, can, hasRole, mesFonctions, estAdjoint, souhaitsAccess, signIn, signOut, resetPassword, retryProfile, simMode, toggleSimMode, isSuperUser: profile?.niveau_acces === 'super_user', isCoordInfo: (profile?.fonctions||[]).includes('coord_informatique') }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé dans AuthProvider')
  return ctx
}