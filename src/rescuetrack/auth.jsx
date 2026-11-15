import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { COPYRIGHT } from '@/copyright'
import { Logo } from '@/components/ui'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [erreurProfil, setErreurProfil] = useState(null)

  useEffect(() => {
    let actif = true
    supabase.auth.getSession().then(({ data }) => {
      if (!actif) return
      setSession(data.session)
      if (data.session) loadProfile(data.session.user.id)
      else setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'TOKEN_REFRESHED') {
        if (s) setSession(s)
        return
      }
      if (event === 'SIGNED_OUT') {
        setSession(null)
        setProfile(null)
        setErreurProfil(null)
        setLoading(false)
        return
      }
      if (!s) return
      setSession(s)
      setTimeout(() => loadProfile(s.user.id), 0)
    })
    return () => {
      actif = false
      sub.subscription.unsubscribe()
    }
  }, [])

  async function loadProfile(userId) {
    setErreurProfil(null)
    const { data, error } = await supabase
      .from('profiles')
      .select('id, role, prenom, nom, doit_changer_mdp')
      .eq('id', userId)
      .maybeSingle()
    if (error) {
      setProfile(null)
      setErreurProfil("Le profil n'a pas pu être lu.")
    } else {
      setProfile(data || null)
    }
    setLoading(false)
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  const staff = Boolean(profile?.role && profile.role !== 'partenaire')
  const partenaire = profile?.role === 'partenaire'
  const value = useMemo(() => ({
    session, profile, loading, erreurProfil, staff, partenaire, signOut,
    recharger: () => session && loadProfile(session.user.id),
  }), [session, profile, loading, erreurProfil, staff, partenaire])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useRtAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useRtAuth doit être utilisé dans AuthProvider')
  return ctx
}

export function GardePersonnel({ children }) {
  const etat = useRtAuth()
  if (etat.loading) return <div className="rt-centre">Chargement…</div>
  if (!etat.session) return <Login />
  if (etat.erreurProfil) return <Refus titre="Profil indisponible" texte={etat.erreurProfil} />
  if (etat.partenaire) {
    return (
      <Refus
        titre="Accès réservé au personnel"
        texte="Ce compte partenaire n'a pas accès à RescueTrack. Les fiches patients sont réservées au personnel de Heart's Angels."
      />
    )
  }
  if (!etat.staff) {
    return (
      <Refus
        titre="Accès réservé au personnel"
        texte="Ce compte n'est pas reconnu comme un compte du personnel. RescueTrack n'enregistre pas de fiche."
      />
    )
  }
  if (etat.profile?.doit_changer_mdp) {
    return (
      <Refus
        titre="Mot de passe à renouveler"
        texte="Renouvelez d'abord votre mot de passe dans Heart's Angels. Ensuite vous pourrez enregistrer des fiches."
        lien={{ href: '/app', label: "Ouvrir Heart's Angels" }}
      />
    )
  }
  return children
}

function Refus({ titre, texte, lien }) {
  const { signOut } = useRtAuth()
  return (
    <div className="rt-centre">
      <div className="rt-login">
        <Logo size={72} style={{ margin: '0 auto 8px' }} />
        <h1 style={{ textAlign: 'center', color: 'var(--heading)', margin: '8px 0' }}>{titre}</h1>
        <p className="rt-lead" style={{ textAlign: 'center' }}>{texte}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {lien && <a className="rt-btn" href={lien.href}>{lien.label}</a>}
          <a className="rt-btn soft" href="/app">Retour à Heart's Angels</a>
          <button type="button" className="rt-textbtn" onClick={signOut}>Se déconnecter</button>
        </div>
        <p className="rt-foot">{COPYRIGHT}</p>
      </div>
    </div>
  )
}

function Login() {
  const [email, setEmail] = useState('')
  const [pwd, setPwd] = useState('')
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setErr(null)
    setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password: pwd })
    setBusy(false)
    if (error) setErr('Identifiants incorrects.')
  }

  return (
    <div className="rt-centre">
      <div className="rt-login">
        <Logo size={88} style={{ margin: '0 auto 4px' }} />
        <h1 style={{ textAlign: 'center', color: 'var(--heading)', margin: '4px 0 0', fontSize: '2rem' }}>RescueTrack</h1>
        <p className="rt-lead" style={{ textAlign: 'center' }}>
          Connexion avec le compte Heart's Angels. RescueTrack enregistre les patients sur les préventifs déjà ouverts. Il ne crée pas de dispositif.
        </p>
        <form onSubmit={submit}>
          <label className="rt-field">
            <span>Adresse e-mail</span>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" required />
          </label>
          <label className="rt-field">
            <span>Mot de passe</span>
            <input type="password" value={pwd} onChange={e => setPwd(e.target.value)} autoComplete="current-password" required />
          </label>
          {err && <div className="ha-flash ha-flash-err">{err}</div>}
          <button className="rt-btn" type="submit" disabled={busy}>{busy ? 'Connexion…' : 'Se connecter'}</button>
        </form>
        <p style={{ textAlign: 'center', marginTop: 14 }}>
          <a href="/login">Espace Heart's Angels</a>
        </p>
        <p className="rt-foot">{COPYRIGHT}</p>
      </div>
    </div>
  )
}
