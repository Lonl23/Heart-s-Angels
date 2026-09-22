import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { COPYRIGHT } from '@/copyright'
import { lbl, inp, Logo } from '@/components/ui'
import { urlAccesPartenaire, copierTexte } from '@/lib/urls'

export default function Login() {
  const { session, can, loading } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  const partenaire = loc.pathname.startsWith('/login/partenaire')
  const [email, setEmail] = useState('')
  const [pwd, setPwd] = useState('')
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const [copie, setCopie] = useState(false)
  const urlPartenaire = urlAccesPartenaire()

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

  async function copierAdresse() {
    const ok = await copierTexte(urlPartenaire)
    if (!ok) { setErr("Impossible de copier automatiquement : sélectionnez l’adresse et copiez-la."); return }
    setCopie(true)
    setTimeout(() => setCopie(false), 1800)
  }

  return (
    <div style={{ display:'grid', placeItems:'center', minHeight:'100vh', padding:20, background:'var(--bg)' }}>
      <div style={{ width:'100%', maxWidth:380, background:'var(--card)', border:'1px solid var(--border)', borderRadius:18, padding:'30px 26px' }}>
        <Logo size={140} style={{ margin:'0 auto 8px' }} />
        <p style={{ textAlign:'center', color:'var(--text-muted)', fontSize:13.5, marginBottom:6 }}>
          {partenaire ? 'Espace partenaires' : 'Espace de gestion'}
        </p>
        {partenaire && (
          <p style={{ textAlign:'center', color:'var(--text-2)', fontSize:12.5, margin:'0 0 18px', lineHeight:1.45 }}>
            Encodez une demande de souhait et suivez son avancement.
          </p>
        )}
        {!partenaire && <div style={{ height:16 }} />}
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

        {!partenaire && (
          <Link to="/login/partenaire" style={{
            display:'block', textAlign:'center', marginTop:12, padding:'11px 12px',
            border:'1.5px solid var(--accent)', borderRadius:10, color:'var(--accent)',
            fontSize:14, fontWeight:600, textDecoration:'none',
          }}>Accès partenaire</Link>
        )}

        <div style={{ marginTop:16, padding:'12px 12px 10px', background:'var(--bg-alt)', border:'1px solid var(--border)', borderRadius:12 }}>
          <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:6 }}>Adresse HTML de l’accès partenaire (à coller sur le site ou à envoyer)</div>
          <input
            readOnly
            value={urlPartenaire}
            onFocus={e => e.target.select()}
            aria-label="Adresse HTML de l’accès partenaire"
            style={{ ...inp, fontSize:12, fontFamily:'ui-monospace, SFMono-Regular, Menlo, monospace', marginBottom:8 }}
          />
          <button type="button" onClick={copierAdresse} style={{
            width:'100%', padding:'9px 12px', borderRadius:9, border:'1px solid var(--border)',
            background:'var(--card)', color:'var(--text)', fontSize:13.5, fontWeight:600, cursor:'pointer',
          }}>{copie ? '✓ Adresse copiée' : 'Copier l’adresse'}</button>
        </div>

        <div style={{ textAlign:'center', marginTop:16 }}>
          <Link to="/inscription" style={{ fontSize:13, color:'var(--accent)', fontWeight:600 }}>J'ai un code d'invitation</Link>
        </div>
        {partenaire
          ? <div style={{ textAlign:'center', marginTop:10 }}><Link to="/login" style={{ fontSize:13, color:'var(--text-muted)' }}>← Accès personnel ASBL</Link></div>
          : <p style={{ textAlign:'center', fontSize:12, color:'var(--text-muted)', margin:'8px 0 0' }}>Institutions : e-mail général + mot de passe, ou code généré dans l’annuaire.</p>
        }
        <div style={{ textAlign:'center', fontSize:10.5, color:'var(--text-faint)', marginTop:18 }}>{COPYRIGHT}</div>
      </div>
    </div>
  )
}
