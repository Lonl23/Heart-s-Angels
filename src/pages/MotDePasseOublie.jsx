import { useState } from 'react'
import { Link } from 'react-router-dom'
import { COPYRIGHT } from '@/copyright'
import { lbl, inp, Logo } from '@/components/ui'
import { demanderResetMotDePasse } from '@/lib/envoyerInvitation'

export default function MotDePasseOublie() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [ok, setOk] = useState(false)

  async function submit(e) {
    e.preventDefault(); setErr(null)
    setBusy(true)
    const { ok: sent, error } = await demanderResetMotDePasse(email)
    setBusy(false)
    if (!sent) { setErr(error || 'Envoi impossible.'); return }
    setOk(true)
  }

  return (
    <div style={{ display:'grid', placeItems:'center', minHeight:'100vh', padding:20, background:'var(--bg)' }}>
      <div style={{ width:'100%', maxWidth:380, background:'var(--card)', border:'1px solid var(--border)', borderRadius:18, padding:'30px 26px' }}>
        <Logo size={140} style={{ margin:'0 auto 8px' }} />
        <p style={{ textAlign:'center', color:'var(--text-muted)', fontSize:13.5, margin:'4px 0 18px' }}>
          Mot de passe oublié
        </p>
        {ok ? (
          <div className="ha-flash ha-flash-ok">
            Si cette adresse est liée à un compte volontaire, tu recevras un e-mail avec un lien pour choisir un nouveau mot de passe.
          </div>
        ) : (
          <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <p style={{ margin:0, fontSize:13.5, color:'var(--text-2)', lineHeight:1.45 }}>
              Indique l’e-mail de ton compte. S’il est bien enregistré, tu recevras un lien de réinitialisation.
            </p>
            <div>
              <label style={lbl}>Adresse e-mail</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username" required style={inp} />
            </div>
            {err && <div className="ha-flash ha-flash-err" style={{ marginBottom:0 }}>{err}</div>}
            <button type="submit" disabled={busy} style={{ padding:12, background:'var(--accent)', color:'#fff', border:'none', borderRadius:10, fontSize:14, fontWeight:600 }}>
              {busy ? 'Envoi…' : 'Envoyer le lien'}
            </button>
          </form>
        )}
        <div style={{ textAlign:'center', marginTop:16 }}>
          <Link to="/login" style={{ fontSize:13, color:'var(--text-muted)' }}>← Retour à la connexion</Link>
        </div>
        <div style={{ textAlign:'center', fontSize:10.5, color:'var(--text-faint)', marginTop:18 }}>{COPYRIGHT}</div>
      </div>
    </div>
  )
}
