import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { lbl, inp, Logo } from '@/components/ui'

export default function ChangePassword() {
  const { user, reload, signOut } = useAuth()
  const [p1, setP1] = useState('')
  const [p2, setP2] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  async function submit(e) {
    e.preventDefault(); setErr(null)
    if (p1.length < 6) return setErr('Mot de passe trop court (≥ 6 caractères).')
    if (p1 !== p2) return setErr('Les deux mots de passe ne correspondent pas.')
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password: p1 })
    if (error) { setBusy(false); return setErr(error.message) }
    await supabase.from('profiles').update({ doit_changer_mdp: false }).eq('id', user.id)
    await reload()
    setBusy(false)
  }

  return (
    <div style={{ display:'grid', placeItems:'center', minHeight:'100vh', padding:20, background:'var(--bg)' }}>
      <div style={{ width:'100%', maxWidth:400, background:'var(--card)', border:'1px solid var(--border)', borderRadius:18, padding:'28px 26px' }}>
        <Logo size={120} style={{ margin:'0 auto 12px' }} />
        <h1 style={{ fontSize:'1.4rem', color:'var(--heading)', marginTop:0 }}>Choisissez votre mot de passe</h1>
        <p style={{ color:'var(--text-muted)', fontSize:13.5 }}>Première connexion : définissez un mot de passe personnel, connu de vous seul.</p>
        <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:12, marginTop:10 }}>
          <div>
            <label style={lbl}>Nouveau mot de passe</label>
            <input type="password" value={p1} onChange={e=>setP1(e.target.value)} autoComplete="new-password" required style={inp} />
          </div>
          <div>
            <label style={lbl}>Confirmer</label>
            <input type="password" value={p2} onChange={e=>setP2(e.target.value)} autoComplete="new-password" required style={inp} />
          </div>
          {err && <div className="ha-flash ha-flash-err" style={{ marginBottom:0 }}>{err}</div>}
          <button type="submit" disabled={busy} style={{ padding:12, background:'var(--accent)', color:'#fff', border:'none', borderRadius:10, fontSize:14, fontWeight:600 }}>{busy?'Enregistrement…':'Valider'}</button>
          <button type="button" onClick={signOut} style={{ padding:8, background:'none', border:'none', color:'var(--text-muted)', fontSize:13 }}>Se déconnecter</button>
        </form>
      </div>
    </div>
  )
}
