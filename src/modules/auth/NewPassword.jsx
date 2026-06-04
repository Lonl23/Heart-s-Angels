import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import styles from './auth.module.css'

// Règles de sécurité du mot de passe
const RULES = [
  { id: 'length',    label: 'Au moins 10 caractères',         test: p => p.length >= 10 },
  { id: 'upper',     label: 'Une lettre majuscule',            test: p => /[A-Z]/.test(p) },
  { id: 'lower',     label: 'Une lettre minuscule',            test: p => /[a-z]/.test(p) },
  { id: 'number',    label: 'Un chiffre',                      test: p => /\d/.test(p) },
  { id: 'special',   label: 'Un caractère spécial (!@#$…)',    test: p => /[^A-Za-z0-9]/.test(p) },
]

export default function NewPassword() {
  const navigate = useNavigate()

  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [showPwd, setShowPwd]     = useState(false)
  const [showConf, setShowConf]   = useState(false)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [success, setSuccess]     = useState(false)
  const [sessionOk, setSessionOk] = useState(false)

  // Supabase envoie le token dans l'URL hash — écouter onAuthStateChange
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionOk(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setSessionOk(!!session)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  const rules  = RULES.map(r => ({ ...r, ok: r.test(password) }))
  const allOk  = rules.every(r => r.ok)
  const match  = password === confirm && confirm.length > 0

  // Force du mot de passe (0–4)
  const strength = rules.filter(r => r.ok).length
  const strengthLabel = ['', 'Faible', 'Moyen', 'Bon', 'Fort', 'Excellent'][strength]
  const strengthColor = ['', '#E24B4A', '#EF9F27', '#BA7517', '#3B6D11', '#0F6E56'][strength]

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!allOk) { setError('Le mot de passe ne respecte pas les règles de sécurité.'); return }
    if (!match)  { setError('Les mots de passe ne correspondent pas.'); return }

    setLoading(true)
    try {
      const { error: err } = await supabase.auth.updateUser({ password })
      if (err) throw err
      setSuccess(true)
      // Rediriger après 3 secondes
      setTimeout(() => navigate('/login', { replace: true }), 3000)
    } catch (err) {
      setError(err.message || 'Une erreur est survenue. Veuillez réessayer.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.root}>
      <div className={styles.bg}>
        <div className={styles.bgBlob1} />
        <div className={styles.bgBlob2} />
        <div className={styles.bgGrid} />
      </div>

      <div className={styles.card}>
        <div className={styles.logoWrap}>
          <div className={styles.logoHeart}><HeartIcon /></div>
          <div className={styles.logoText}>
            <span className={styles.logoName}>Heart's Angels</span>
            <span className={styles.logoTagline}>Nouveau mot de passe</span>
          </div>
        </div>
        <div className={styles.divider} />

        {!sessionOk ? (
          /* Lien expiré ou invalide */
          <>
            <div className={styles.errorBox} role="alert" style={{ marginBottom: 16 }}>
              <AlertIcon />
              <span>Ce lien est invalide ou a expiré. Veuillez faire une nouvelle demande.</span>
            </div>
            <Link to="/reset-password" className={styles.submitBtn} style={{ textDecoration: 'none', justifyContent: 'center', display: 'flex' }}>
              Nouvelle demande
            </Link>
            <Link to="/login" className={styles.backLink}><ArrowLeftIcon /> Retour à la connexion</Link>
          </>
        ) : success ? (
          /* Succès */
          <>
            <div className={styles.successBox}>
              <CheckCircleIcon />
              <div>
                <strong>Mot de passe modifié !</strong>
                <p style={{ marginTop: 4, color: '#2E7D32', fontSize: 12 }}>
                  Vous allez être redirigé vers la page de connexion dans quelques secondes…
                </p>
              </div>
            </div>
            <Link to="/login" className={styles.backLink}><ArrowLeftIcon /> Connexion</Link>
          </>
        ) : (
          /* Formulaire */
          <>
            <h1 className={styles.title}>Nouveau mot de passe</h1>
            <p className={styles.subtitle}>Choisissez un mot de passe sécurisé</p>

            <form onSubmit={handleSubmit} className={styles.form} noValidate>
              {/* Nouveau mot de passe */}
              <div className={styles.field}>
                <label htmlFor="new-pwd" className={styles.label}>Nouveau mot de passe</label>
                <div className={styles.inputWrap}>
                  <span className={styles.inputIcon}><LockIcon /></span>
                  <input
                    id="new-pwd"
                    type={showPwd ? 'text' : 'password'}
                    autoComplete="new-password"
                    autoFocus
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className={`${styles.input} ${styles.inputPwd}`}
                    placeholder="••••••••••"
                    disabled={loading}
                  />
                  <button type="button" className={styles.pwdToggle}
                    onClick={() => setShowPwd(v => !v)}
                    aria-label={showPwd ? 'Masquer' : 'Afficher'} tabIndex={-1}>
                    {showPwd ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>

                {/* Jauge de force */}
                {password.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                      {[1,2,3,4,5].map(i => (
                        <div key={i} style={{
                          flex: 1, height: 3, borderRadius: 2,
                          background: i <= strength ? strengthColor : '#E5E0DA',
                          transition: 'background 0.2s'
                        }} />
                      ))}
                    </div>
                    <span style={{ fontSize: 11, color: strengthColor, fontWeight: 500 }}>
                      {strengthLabel}
                    </span>
                  </div>
                )}

                {/* Règles */}
                <ul className={styles.pwdRules}>
                  {rules.map(r => (
                    <li key={r.id} className={`${styles.pwdRule} ${r.ok ? styles.ok : ''}`}>
                      <span className={styles.dot} />
                      {r.label}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Confirmation */}
              <div className={styles.field}>
                <label htmlFor="conf-pwd" className={styles.label}>Confirmer le mot de passe</label>
                <div className={styles.inputWrap}>
                  <span className={styles.inputIcon}><LockIcon /></span>
                  <input
                    id="conf-pwd"
                    type={showConf ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    className={`${styles.input} ${styles.inputPwd}`}
                    style={confirm.length > 0 ? { borderColor: match ? '#3B6D11' : '#E24B4A' } : {}}
                    placeholder="••••••••••"
                    disabled={loading}
                  />
                  <button type="button" className={styles.pwdToggle}
                    onClick={() => setShowConf(v => !v)} tabIndex={-1}>
                    {showConf ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
                {confirm.length > 0 && !match && (
                  <span className={styles.err} style={{ marginTop: 4, display: 'block' }}>
                    Les mots de passe ne correspondent pas
                  </span>
                )}
              </div>

              {error && (
                <div className={styles.errorBox} role="alert">
                  <AlertIcon /><span>{error}</span>
                </div>
              )}

              <button type="submit" className={styles.submitBtn}
                disabled={loading || !allOk || !match}>
                {loading
                  ? <><span className={styles.spinner} /> Modification…</>
                  : <><CheckIcon /> Enregistrer le mot de passe</>
                }
              </button>
            </form>
          </>
        )}
      </div>
      <span className={styles.version}>v1.0.0</span>
    </div>
  )
}

function HeartIcon() {
  return <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
}
function LockIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
}
function EyeIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
}
function EyeOffIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></svg>
}
function AlertIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
}
function CheckCircleIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20" style={{ flexShrink: 0 }}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
}
function CheckIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="16" height="16"><polyline points="20 6 9 17 4 12"/></svg>
}
function ArrowLeftIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
}