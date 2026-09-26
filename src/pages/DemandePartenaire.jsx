import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { COPYRIGHT } from '@/copyright'
import { lbl, inp, Logo } from '@/components/ui'
import { emailEstProfessionnel, EMAIL_PRO_AIDE } from '@/lib/emailPro'

const TYPES = [
  { v: 'hopital', l: 'Hôpital' },
  { v: 'maison_repos', l: 'Maison de repos' },
  { v: 'soins_palliatifs', l: 'Soins palliatifs' },
  { v: 'domicile', l: 'Domicile' },
  { v: 'institution', l: 'Institution' },
  { v: 'autre', l: 'Autre' },
]

export default function DemandePartenaire() {
  const [nom, setNom] = useState('')
  const [type, setType] = useState('hopital')
  const [ville, setVille] = useState('')
  const [email, setEmail] = useState('')
  const [tel, setTel] = useState('')
  const [contact, setContact] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [ok, setOk] = useState(false)

  async function submit(e) {
    e.preventDefault(); setErr(null)
    if (!emailEstProfessionnel(email)) return setErr(EMAIL_PRO_AIDE)
    setBusy(true)
    const { data, error } = await supabase.rpc('demander_acces_partenaire', {
      p_nom: nom.trim(),
      p_type: type || null,
      p_ville: ville.trim() || null,
      p_email: email.trim(),
      p_tel: tel.trim() || null,
      p_contact_nom: contact.trim(),
    })
    setBusy(false)
    if (error) { setErr(error.message); return }
    if (!data?.ok) { setErr(data?.error || 'Impossible d’envoyer la demande.'); return }
    setOk(true)
  }

  return (
    <div style={{ display:'grid', placeItems:'center', minHeight:'100vh', padding:20, background:'var(--bg)' }}>
      <div style={{ width:'100%', maxWidth:420, background:'var(--card)', border:'1px solid var(--border)', borderRadius:18, padding:'28px 26px' }}>
        <Logo size={140} style={{ margin:'0 auto 8px' }} />
        <p style={{ textAlign:'center', color:'var(--text-muted)', fontSize:13.5, margin:'4px 0 6px' }}>Demande d’accès partenaire</p>
        <p style={{ textAlign:'center', color:'var(--text-2)', fontSize:12.5, margin:'0 0 18px', lineHeight:1.45 }}>
          Heart’s Angels vérifie l’institution. Vous choisirez votre mot de passe seulement après acceptation.
        </p>
        {ok ? (
          <div>
            <div className="ha-flash ha-flash-ok" style={{ marginBottom:14 }}>
              Demande envoyée. Vous serez contacté à l’e-mail professionnel indiqué lorsqu’elle sera acceptée.
            </div>
            <Link to="/login/partenaire" style={{ display:'block', textAlign:'center', fontSize:13, color:'var(--accent)', fontWeight:600 }}>← Retour à la connexion</Link>
          </div>
        ) : (
          <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div>
              <label style={lbl}>Nom de l’institution</label>
              <input value={nom} onChange={e=>setNom(e.target.value)} required minLength={3} style={inp} />
            </div>
            <div>
              <label style={lbl}>Type</label>
              <select value={type} onChange={e=>setType(e.target.value)} style={inp}>
                {TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Ville</label>
              <input value={ville} onChange={e=>setVille(e.target.value)} style={inp} />
            </div>
            <div>
              <label style={lbl}>Personne de contact</label>
              <input value={contact} onChange={e=>setContact(e.target.value)} required minLength={2} style={inp} />
            </div>
            <div>
              <label style={lbl}>E-mail professionnel</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email" style={inp} />
              <div style={{ fontSize:11.5, color:'var(--text-muted)', marginTop:4 }}>{EMAIL_PRO_AIDE}</div>
            </div>
            <div>
              <label style={lbl}>Téléphone général</label>
              <input value={tel} onChange={e=>setTel(e.target.value)} style={inp} />
            </div>
            {err && <div className="ha-flash ha-flash-err" style={{ marginBottom:0 }}>{err}</div>}
            <button type="submit" disabled={busy} style={{ padding:12, background:'var(--accent)', color:'#fff', border:'none', borderRadius:10, fontSize:14, fontWeight:600 }}>{busy?'Envoi…':'Envoyer la demande'}</button>
            <Link to="/login/partenaire" style={{ textAlign:'center', fontSize:13, color:'var(--text-muted)' }}>← Déjà partenaire ? Se connecter</Link>
          </form>
        )}
        <div style={{ textAlign:'center', fontSize:10.5, color:'var(--text-faint)', marginTop:16 }}>{COPYRIGHT}</div>
      </div>
    </div>
  )
}
