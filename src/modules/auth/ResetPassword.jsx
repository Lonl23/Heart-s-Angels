import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import styles from './auth.module.css'

export default function ResetPassword() {
  const { resetPassword } = useAuth()

  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent]       = useState(false)
  const [error, setError]     = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!email.trim()) {
      setError('Veuillez saisir votre adresse email.')
      return
    }
    setLoading(true)
    try {
      await resetPassword(email.trim().toLowerCase())
      setSent(true)
    } catch {
      // Message générique pour ne pas confirmer si l'email existe (sécurité)
      setSent(true)
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
        {/* Logo */}
        <div className={styles.logoWrap}>
          <div className={styles.logoHeart}>
            <HeartIcon />
          </div>
          <div className={styles.logoText}>
            <span className={styles.logoName}>Heart's Angels</span>
            <span className={styles.logoTagline}>Réinitialisation du mot de passe</span>
          </div>
        </div>

        <div className={styles.divider} />

        {sent ? (
          /* ── État envoyé ── */
          <>
            <div className={styles.successBox}>
              <CheckCircleIcon />
              <div>
                <strong>Email envoyé !</strong>
                <p style={{ marginTop: 4, color: '#2E7D32', fontSize: 12 }}>
                  Si un compte existe pour <strong>{email}</strong>, vous recevrez
                  un lien de réinitialisation dans quelques minutes.
                  Vérifiez également vos spams.
                </p>
              </div>
            </div>
            <p style={{ fontSize: 12.5, color: '#8A8681', textAlign: 'center', lineHeight: 1.6 }}>
              Le lien est valable <strong>1 heure</strong>.<br />
              Contactez un administrateur si le problème persiste.
            </p>
            <Link to="/login" className={styles.backLink}>
              <ArrowLeftIcon /> Retour à la connexion
            </Link>
          </>
        ) : (
          /* ── Formulaire ── */
          <>
            <h1 className={styles.title}>Mot de passe oublié</h1>
            <p className={styles.subtitle}>
              Saisissez votre email pour recevoir un lien de réinitialisation
            </p>

            <form onSubmit={handleSubmit} className={styles.form} noValidate>
              <div className={styles.field}>
                <label htmlFor="reset-email" className={styles.label}>
                  Adresse email
                </label>
                <div className={styles.inputWrap}>
                  <span className={styles.inputIcon}><MailIcon /></span>
                  <input
                    id="reset-email"
                    type="email"
                    autoComplete="email"
                    autoFocus
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className={styles.input}
                    placeholder="prenom.nom@heartsangels.be"
                    disabled={loading}
                  />
                </div>
              </div>

              {error && (
                <div className={styles.errorBox} role="alert">
                  <AlertIcon />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                className={styles.submitBtn}
                disabled={loading}
              >
                {loading
                  ? <><span className={styles.spinner} /> Envoi en cours…</>
                  : <><MailSendIcon /> Envoyer le lien</>
                }
              </button>
            </form>

            <Link to="/login" className={styles.backLink}>
              <ArrowLeftIcon /> Retour à la connexion
            </Link>
          </>
        )}
      </div>

      <span className={styles.version}>v1.0.0</span>
    </div>
  )
}

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
    </svg>
  )
}
function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
      <rect x="2" y="4" width="20" height="16" rx="2"/>
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
    </svg>
  )
}
function MailSendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
      <path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>
    </svg>
  )
}
function AlertIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  )
}
function CheckCircleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20" style={{ flexShrink: 0 }}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
      <polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  )
}
function ArrowLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
      <path d="M19 12H5M12 5l-7 7 7 7"/>
    </svg>
  )
}
