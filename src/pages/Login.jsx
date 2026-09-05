import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { COPYRIGHT } from '@/copyright'
import { lbl, inp, Logo } from '@/components/ui'

export default function Login() {
  const { session, can, loading } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  const [email, setEmail] = useState('')
  const [pwd, setPwd] = useState('')
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (loading || !session) return
    if (can('partenaire')) { nav('/partenaire', { replace:true }); return }
    const from = loc.state?.from
    nav(typeof from === 'string' && from.startsWith('/app') ? from : '/app', { replace:true })
  }, [session, loading])

  async function submit(e) {
    e.preventDefault(); setErr(null); setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password: pwd })
    setBusy(false)
    if (error) setErr("Identifiants incorrects.")
  }

  return (
    <div style={{ display:'grid', placeItems:'center', minHeight:'100vh', padding:20, background:'var(--bg)' }}>
      <div style={{ width:'100%', maxWidth:380, background:'var(--card)', border:'1px solid var(--border)', borderRadius:18, padding:'30px 26px' }}>
        <Logo size={140} style={{ margin:'0 auto 8px' }} />
        <p style={{ textAlign:'center', color:'var(--text-muted)', fontSize:13.5, marginBottom:22 }}>Espace de gestion</p>
        <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div>
            <label style={lbl}>Adresse e-mail</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username" required style={inp} />
          </div>
          <div>
            <label style={lbl}>Mot de passe</label>
            <input type="password" value={pwd} onChange={e=>setPwd(e.target.value)} autoComplete="current-password" required style={inp} />
          </div>
          {err && <div className="ha-flash ha-flash-err" style={{ marginBottom:0 }}>{err}</div>}
          <button type="submit" disabled={busy} style={{ padding:12, background:'var(--accent)', color:'#fff', border:'none', borderRadius:10, fontSize:14, fontWeight:600 }}>{busy?'Connexion…':'Se connecter'}</button>
        </form>
        <div style={{ textAlign:'center', marginTop:16 }}><Link to="/inscription" style={{ fontSize:13, color:'var(--accent)', fontWeight:600 }}>J'ai un code d'invitation</Link></div>
        <p style={{ textAlign:'center', fontSize:12, color:'var(--text-muted)', margin:'8px 0 0' }}>Institutions : e-mail général + mot de passe, ou code généré dans l’annuaire.</p>
        <div style={{ textAlign:'center', fontSize:10.5, color:'var(--text-faint)', marginTop:18 }}>{COPYRIGHT}</div>
      </div>
    </div>
  )
}
