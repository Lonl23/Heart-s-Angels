import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { COPYRIGHT } from '@/copyright'
import { lbl, inp, Logo } from '@/components/ui'
import { motDePasseErreur, MDP_AIDE } from '@/lib/motDePasse'

export default function ReinitialiserMotDePasse() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const token = (params.get('token') || '').trim()
  const [pret, setPret] = useState(false)
  const [lienErr, setLienErr] = useState(null)
  const [p1, setP1] = useState('')
  const [p2, setP2] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  useEffect(() => {
    let stop = false
    async function ouvrir() {
      if (!token) {
        setLienErr('Ce lien est incomplet. Demande un nouveau lien depuis la page « Mot de passe oublié ».')
        return
      }
      const { error } = await supabase.auth.verifyOtp({ type: 'recovery', token_hash: token })
      if (stop) return
      if (error) {
        setLienErr('Ce lien est invalide ou a expiré. Demande un nouveau lien depuis la page de connexion.')
        return
      }
      setPret(true)
    }
    ouvrir()
    return () => { stop = true }
  }, [token])

  async function submit(e) {
    e.preventDefault(); setErr(null)
    if (p1 !== p2) return setErr('Les deux mots de passe ne correspondent pas.')
    const faible = motDePasseErreur(p1)
    if (faible) return setErr(faible)
    setBusy(true)
    const { data: u } = await supabase.auth.getUser()
    const { error } = await supabase.auth.updateUser({ password: p1 })
    if (error) { setBusy(false); return setErr(error.message) }
    if (u?.user?.id) {
      await supabase.from('profiles').update({ doit_changer_mdp: false }).eq('id', u.user.id)
    }
    await supabase.auth.signOut()
    nav('/login', { replace: true, state: { info: 'Ton mot de passe est enregistré. Connecte-toi avec le nouveau.' } })
  }

  return (
    <div style={{ display:'grid', placeItems:'center', minHeight:'100vh', padding:20, background:'var(--bg)' }}>
      <div style={{ width:'100%', maxWidth:400, background:'var(--card)', border:'1px solid var(--border)', borderRadius:18, padding:'28px 26px' }}>
        <Logo size={140} style={{ margin:'0 auto 8px' }} />
        <p style={{ textAlign:'center', color:'var(--text-muted)', fontSize:13.5, margin:'4px 0 18px' }}>
          Nouveau mot de passe
        </p>
        {lienErr ? (
          <>
            <div className="ha-flash ha-flash-err">{lienErr}</div>
            <div style={{ textAlign:'center', marginTop:16 }}>
              <Link to="/mot-de-passe-oublie" style={{ fontSize:13, color:'var(--accent)', fontWeight:600 }}>Demander un nouveau lien</Link>
            </div>
          </>
        ) : !pret ? (
          <p style={{ textAlign:'center', color:'var(--text-muted)', fontSize:13.5 }}>Vérification du lien…</p>
        ) : (
          <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <p style={{ margin:0, fontSize:13.5, color:'var(--text-2)', lineHeight:1.45 }}>
              Choisis un nouveau mot de passe, puis confirme-le.
            </p>
            <div>
              <label style={lbl}>Nouveau mot de passe ({MDP_AIDE})</label>
              <input type="password" value={p1} onChange={e=>setP1(e.target.value)} autoComplete="new-password" required style={inp} />
            </div>
            <div>
              <label style={lbl}>Confirmer le mot de passe</label>
              <input type="password" value={p2} onChange={e=>setP2(e.target.value)} autoComplete="new-password" required style={inp} />
            </div>
            {err && <div className="ha-flash ha-flash-err" style={{ marginBottom:0 }}>{err}</div>}
            <button type="submit" disabled={busy} style={{ padding:12, background:'var(--accent)', color:'#fff', border:'none', borderRadius:10, fontSize:14, fontWeight:600 }}>
              {busy ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </form>
        )}
        <div style={{ textAlign:'center', marginTop:16 }}>
          <Link to="/login" onClick={() => { supabase.auth.signOut() }} style={{ fontSize:13, color:'var(--text-muted)' }}>← Retour à la connexion</Link>
        </div>
        <div style={{ textAlign:'center', fontSize:10.5, color:'var(--text-faint)', marginTop:16 }}>{COPYRIGHT}</div>
      </div>
    </div>
  )
}
