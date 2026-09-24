import { useEffect, useState } from 'react'
import { Link, useSearchParams, useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { COPYRIGHT } from '@/copyright'
import { lbl, inp, Logo } from '@/components/ui'
import { motDePasseErreur, MDP_AIDE } from '@/lib/motDePasse'

export default function Inscription() {
  const loc = useLocation()
  const inscritPartenaire = loc.pathname.startsWith('/inscription/partenaire')
  const [params] = useSearchParams()
  const codeLien = (params.get('code') || '').trim().toUpperCase()
  const emailLien = (params.get('email') || '').trim()
  const viaLien = !!codeLien
  const [email, setEmail] = useState(emailLien)
  const [code, setCode] = useState(codeLien)
  const [invite, setInvite] = useState(null)
  const [inviteInvalide, setInviteInvalide] = useState(false)
  const [p1, setP1] = useState('')
  const [p2, setP2] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  useEffect(() => {
    if (!codeLien || !emailLien) return
    let stop = false
    supabase.rpc('verifier_invitation', { p_code: codeLien, p_email: emailLien }).then(({ data }) => {
      if (stop) return
      if (!data?.ok) { setErr('Cette invitation est invalide, déjà utilisée ou expirée.'); setInviteInvalide(true); return }
      const estPartenaire = !!data.partenaire || data.role === 'partenaire'
      if (inscritPartenaire !== estPartenaire) {
        setErr(inscritPartenaire
          ? 'Ce lien est une invitation volontaire, pas un accès institution.'
          : 'Ce lien est un accès institution. Utilisez l’espace partenaires.')
        setInviteInvalide(true)
        return
      }
      setInvite(data); setInviteInvalide(false)
    })
    return () => { stop = true }
  }, [codeLien, emailLien, inscritPartenaire])

  async function submit(e) {
    e.preventDefault(); setErr(null)
    if (p1 !== p2) return setErr('Les deux mots de passe ne correspondent pas.')
    const faible = motDePasseErreur(p1)
    if (faible) return setErr(faible)
    setBusy(true)
    try {
      const { data: v } = await supabase.rpc('verifier_invitation', { p_code: code.trim(), p_email: email.trim() })
      if (!v?.ok) { setErr('Code ou e-mail invalide, ou invitation expirée.'); setBusy(false); return }
      const estPartenaire = !!v.partenaire || v.role === 'partenaire'
      if (inscritPartenaire !== estPartenaire) {
        setErr(inscritPartenaire
          ? 'Ce lien n’est pas un accès institution.'
          : 'Ce lien est un accès institution. Passez par l’espace partenaires.')
        setBusy(false); return
      }
      const { data: su, error: e1 } = await supabase.auth.signUp({ email: email.trim(), password: p1, options: { data: { prenom: v.prenom, nom: v.nom } } })
      if (e1) { setErr(e1.message); setBusy(false); return }
      if (!su.session) { setErr("La confirmation par e-mail est activée sur ce serveur : elle doit être désactivée pour l'inscription par invitation. Contactez l'administrateur."); setBusy(false); return }
      const { data: c } = await supabase.rpc('consommer_invitation', { p_code: code.trim() })
      if (!c?.ok) { setErr(c?.error || 'Impossible de finaliser l\'inscription.'); setBusy(false); return }
      window.location.href = estPartenaire ? '/partenaire' : '/app'
    } catch (ex) {
      setErr(ex.message || 'Erreur.'); setBusy(false)
    }
  }

  const lectureEmail = viaLien && !!emailLien
  const nomInst = invite?.partenaire_nom
  const sousTitre = inscritPartenaire
    ? (nomInst
      ? `Activez l’accès de ${nomInst} en choisissant un mot de passe.`
      : 'Choisissez un mot de passe pour activer l’accès institution.')
    : (invite?.prenom
      ? `${invite.prenom}, choisissez votre mot de passe pour activer le compte.`
      : viaLien
        ? 'Choisissez votre mot de passe pour créer le compte.'
        : 'Créer mon compte avec une invitation')

  return (
    <div style={{ display:'grid', placeItems:'center', minHeight:'100vh', padding:20, background:'var(--bg)' }}>
      <div style={{ width:'100%', maxWidth:400, background:'var(--card)', border:'1px solid var(--border)', borderRadius:18, padding:'28px 26px' }}>
        <Logo size={140} style={{ margin:'0 auto 8px' }} />
        <p style={{ textAlign:'center', color:'var(--text-muted)', fontSize:13.5, margin:'4px 0 18px' }}>{sousTitre}</p>
        {inscritPartenaire && nomInst && (
          <p style={{ textAlign:'center', color:'var(--text-2)', fontSize:12.5, margin:'-10px 0 16px', lineHeight:1.45 }}>
            À la connexion, saisissez le nom <strong>{nomInst}</strong>, cet e-mail et le mot de passe choisi ici.
          </p>
        )}
        <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div>
            <label style={lbl}>E-mail professionnel</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" required readOnly={lectureEmail} style={{ ...inp, ...(lectureEmail ? { background:'var(--bg-alt)' } : {}) }} />
          </div>
          {!viaLien && (
            <div>
              <label style={lbl}>{inscritPartenaire ? 'Code d’activation' : 'Code d\'invitation'}</label>
              <input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="HA-XXXX-XXXX" required style={{ ...inp, fontFamily:'monospace', letterSpacing:1 }} />
            </div>
          )}
          <div>
            <label style={lbl}>Mot de passe ({MDP_AIDE})</label>
            <input type="password" value={p1} onChange={e=>setP1(e.target.value)} autoComplete="new-password" required style={inp} />
          </div>
          <div>
            <label style={lbl}>Confirmer le mot de passe</label>
            <input type="password" value={p2} onChange={e=>setP2(e.target.value)} autoComplete="new-password" required style={inp} />
          </div>
          {err && <div className="ha-flash ha-flash-err" style={{ marginBottom:0 }}>{err}</div>}
          <button type="submit" disabled={busy || inviteInvalide} style={{ padding:12, background:'var(--accent)', color:'#fff', border:'none', borderRadius:10, fontSize:14, fontWeight:600 }}>{busy?'Création…':'Créer mon compte'}</button>
          <Link to={inscritPartenaire ? '/login/partenaire' : '/login'} style={{ textAlign:'center', fontSize:13, color:'var(--text-muted)' }}>← Retour à la connexion</Link>
        </form>
        <div style={{ textAlign:'center', fontSize:10.5, color:'var(--text-faint)', marginTop:16 }}>{COPYRIGHT}</div>
      </div>
    </div>
  )
}
