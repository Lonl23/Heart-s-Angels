import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'

const LOGO = 'https://www.heartsangels.be/wp-content/uploads/2026/03/cropped-logo-hearts-angels-vectorise-scaled-1.png'

export default function Login() {
  const { signIn } = useAuth()
  const navigate   = useNavigate()
  const location   = useLocation()
  const from       = location.state?.from?.pathname || '/app/dashboard'

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [showPwd, setShowPwd] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!identifier || !password) { setError('Veuillez remplir tous les champs.'); return }
    setLoading(true); setError('')
    try {
      const isEmail = identifier.includes('@')
      if (isEmail) {
        // Connexion directe par email
        await signIn(identifier, password)
      } else {
        // Connexion par login → Edge Function qui retrouve l'email
        const { data, error } = await supabase.functions.invoke('login-user', {
          body: { login: identifier, password },
        })
        if (error || data?.error) throw new Error(data?.error || 'Identifiant ou mot de passe incorrect.')
        // Définir la session retournée
        if (data?.session) {
          await supabase.auth.setSession({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
          })
        }
      }
      navigate('/app/dashboard', { replace: true })
    } catch (err) {
      setError(err.message?.includes('Invalid') || err.message?.includes('incorrect')
        ? 'Identifiant ou mot de passe incorrect.'
        : (err.message || 'Erreur de connexion. Veuillez réessayer.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#0A1E2D 0%,#0E4A5A 50%,#0A1E2D 100%)', display:'flex', alignItems:'center', justifyContent:'center', padding:20, fontFamily:"'DM Sans',sans-serif" }}>
      <div style={{ width:'100%', maxWidth:420 }}>
        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <img src={LOGO} alt="Heart's Angels" style={{ height:64, width:'auto', objectFit:'contain', marginBottom:16 }} />
          <div style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:'1.4rem', fontWeight:500, color:'white', marginBottom:4 }}>
            Espace personnel
          </div>
          <div style={{ fontSize:13, color:'rgba(255,255,255,.5)' }}>
            Réservé au personnel et bénévoles de Heart's Angels
          </div>
        </div>

        {/* Carte */}
        <div style={{ background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.12)', borderRadius:18, padding:'2rem', backdropFilter:'blur(12px)' }}>
          <form onSubmit={handleSubmit} noValidate autoComplete="off" style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div>
              <label style={{ fontSize:12.5, fontWeight:500, color:'rgba(255,255,255,.65)', display:'block', marginBottom:6 }}>
                Identifiant
              </label>
              <input
                type="text" name="ha_login" value={identifier} onChange={e => setIdentifier(e.target.value)}
                placeholder="votre login (ex: lnoulin)" autoComplete="off" inputMode="text"
                style={{ width:'100%', padding:'11px 14px', background:'rgba(255,255,255,.08)', border:'1px solid rgba(255,255,255,.15)', borderRadius:9, fontSize:14, color:'white', fontFamily:"'DM Sans',sans-serif" }}
                onFocus={e => e.target.style.borderColor='#1BB0CE'}
                onBlur={e => e.target.style.borderColor='rgba(255,255,255,.15)'}
              />
            </div>
            <div>
              <label style={{ fontSize:12.5, fontWeight:500, color:'rgba(255,255,255,.65)', display:'block', marginBottom:6 }}>
                Mot de passe
              </label>
              <div style={{ position:'relative' }}>
                <input
                  type={showPwd ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" autoComplete="current-password"
                  style={{ width:'100%', padding:'11px 44px 11px 14px', background:'rgba(255,255,255,.08)', border:'1px solid rgba(255,255,255,.15)', borderRadius:9, fontSize:14, color:'white', fontFamily:"'DM Sans',sans-serif" }}
                  onFocus={e => e.target.style.borderColor='#1BB0CE'}
                  onBlur={e => e.target.style.borderColor='rgba(255,255,255,.15)'}
                />
                <button type="button" onClick={() => setShowPwd(!showPwd)}
                  style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,.4)', fontSize:16 }}>
                  {showPwd ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {error && (
              <div style={{ background:'rgba(239,68,68,.15)', border:'1px solid rgba(239,68,68,.3)', borderRadius:8, padding:'10px 14px', fontSize:13, color:'#FCA5A5' }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              style={{ padding:13, background: loading ? 'rgba(27,176,206,.5)' : '#1BB0CE', color:'white', border:'none', borderRadius:10, fontSize:14.5, fontWeight:700, cursor: loading ? 'wait' : 'pointer', fontFamily:"'DM Sans',sans-serif", transition:'all .15s', marginTop:4 }}>
              {loading ? 'Connexion…' : 'Se connecter →'}
            </button>
          </form>

          <div style={{ textAlign:'center', marginTop:18 }}>
            <a href="/reset-password" style={{ fontSize:13, color:'rgba(255,255,255,.45)', textDecoration:'none' }}>
              Mot de passe oublié ?
            </a>
          </div>
        </div>

        {/* Retour site */}
        <div style={{ textAlign:'center', marginTop:20 }}>
          <a href="/" style={{ fontSize:13, color:'rgba(255,255,255,.35)', textDecoration:'none' }}>
            ← Retour au site
          </a>
        </div>
      </div>
      <style>{`input::placeholder{color:rgba(255,255,255,.25);} input{outline:none;}`}</style>
    </div>
  )
}