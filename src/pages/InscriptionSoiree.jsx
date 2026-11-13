import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Logo, PhoneF } from '@/components/ui'
import { FondEcran } from '@/hooks/useFondPage'
import { COPYRIGHT } from '@/copyright'

function fmtDate(d) {
  if (!d) return ''
  const x = new Date(String(d).slice(0, 10) + 'T12:00:00')
  if (Number.isNaN(x.getTime())) return String(d)
  return x.toLocaleDateString('fr-BE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

export default function InscriptionSoiree() {
  const { token } = useParams()
  const [meta, setMeta] = useState(null)
  const [errMeta, setErrMeta] = useState(null)
  const [loading, setLoading] = useState(true)
  const [f, setF] = useState({
    prenom: '', nom: '', date_naissance: '', email: '', telephone: '', notes: '',
  })
  const set = (k, v) => setF(s => ({ ...s, [k]: v }))
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState(null)

  useEffect(() => {
    let stop = false
    setLoading(true)
    supabase.rpc('evenement_ouvert_lire', { p_token: token }).then(({ data, error }) => {
      if (stop) return
      if (error || !data?.ok) {
        setErrMeta(data?.error || error?.message || 'Lien invalide.')
        setMeta(null)
      } else {
        setMeta(data.evenement)
        setErrMeta(null)
      }
      setLoading(false)
    })
    return () => { stop = true }
  }, [token])

  async function submit(e) {
    e.preventDefault()
    setErr(null)
    if (!f.prenom.trim() || !f.nom.trim()) {
      setErr('Indiquez votre prénom et votre nom.'); return
    }
    setBusy(true)
    const { data, error } = await supabase.rpc('evenement_ouvert_inscrire', {
      p_token: token,
      p_prenom: f.prenom.trim(),
      p_nom: f.nom.trim(),
      p_date_naissance: f.date_naissance || null,
      p_email: f.email.trim() || null,
      p_telephone: f.telephone.trim() || null,
      p_notes: f.notes.trim() || null,
    })
    setBusy(false)
    if (error || data?.ok === false) {
      setErr(data?.error || error?.message || 'Inscription impossible.')
      return
    }
    setDone(true)
  }

  if (loading) {
    return (
      <Wrap>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Chargement…</p>
      </Wrap>
    )
  }

  if (errMeta || !meta) {
    return (
      <Wrap>
        <Logo size={72} style={{ margin: '0 auto 12px' }} />
        <h1 style={{ fontSize: '1.4rem', color: 'var(--heading)', textAlign: 'center' }}>Inscription fermée</h1>
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: 8 }}>{errMeta || 'Lien invalide.'}</p>
        <p style={{ textAlign: 'center', marginTop: 16 }}>
          <Link to="/login" style={{ color: 'var(--accent)', fontWeight: 600 }}>Connexion volontaires</Link>
        </p>
      </Wrap>
    )
  }

  if (done) {
    return (
      <Wrap>
        <Logo size={72} style={{ margin: '0 auto 12px' }} />
        <h1 style={{ fontSize: '1.5rem', color: 'var(--heading)', textAlign: 'center' }}>Inscription enregistrée</h1>
        <p style={{ color: 'var(--text-2)', textAlign: 'center', marginTop: 8, lineHeight: 1.45 }}>
          Merci {f.prenom}. On vous attend pour « {meta.titre} ».
          {meta.date_debut ? ` (${fmtDate(meta.date_debut)}${meta.heure_debut ? ` · ${meta.heure_debut}` : ''})` : ''}
        </p>
      </Wrap>
    )
  }

  return (
    <Wrap>
      <Logo size={64} style={{ margin: '0 auto 10px' }} />
      <h1 style={{ fontSize: '1.55rem', color: 'var(--heading)', textAlign: 'center', marginBottom: 4 }}>{meta.titre}</h1>
      <p style={{ color: 'var(--text-muted)', fontSize: 13.5, textAlign: 'center', marginBottom: 6 }}>
        {[fmtDate(meta.date_debut), meta.heure_debut, meta.lieu].filter(Boolean).join(' · ')}
      </p>
      {meta.description && (
        <p style={{ color: 'var(--text-2)', fontSize: 13.5, textAlign: 'center', marginBottom: 16, lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>
          {meta.description}
        </p>
      )}
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Row>
          <Field label="Prénom *" value={f.prenom} set={v => set('prenom', v)} required />
          <Field label="Nom *" value={f.nom} set={v => set('nom', v)} required />
        </Row>
        <Field label="Date de naissance" type="date" value={f.date_naissance} set={v => set('date_naissance', v)} />
        <Field label="E-mail" type="email" value={f.email} set={v => set('email', v)} placeholder="utile pour vous recontacter" />
        <PhoneF label="Téléphone" value={f.telephone} set={v => set('telephone', v)} />
        <div>
          <label style={lbl}>Message (optionnel)</label>
          <textarea value={f.notes} onChange={e => set('notes', e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} />
        </div>
        {err && <div className="ha-flash ha-flash-err">{err}</div>}
        <button type="submit" disabled={busy} style={btn}>
          {busy ? '…' : 'Je m’inscris'}
        </button>
      </form>
      <p style={{ fontSize: 11.5, color: 'var(--text-muted)', textAlign: 'center', marginTop: 18 }}>{COPYRIGHT}</p>
    </Wrap>
  )
}

function Wrap({ children }) {
  return (
    <FondEcran page="login" style={{ minHeight: '100vh', padding: '24px 16px' }}>
      <div style={{
        maxWidth: 480, margin: '0 auto', background: 'var(--card)',
        border: '1px solid var(--border)', borderRadius: 18, padding: '26px 22px',
      }}>
        {children}
      </div>
    </FondEcran>
  )
}

function Row({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>{children}</div>
}

function Field({ label, value, set, type = 'text', required, placeholder }) {
  return (
    <div>
      <label style={lbl}>{label}</label>
      <input type={type} value={value} onChange={e => set(e.target.value)} required={required} placeholder={placeholder} style={inp} />
    </div>
  )
}

const lbl = { fontSize: 12.5, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }
const inp = {
  width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 9,
  fontSize: 13.5, background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box', fontFamily: 'inherit',
}
const btn = {
  width: '100%', minHeight: 48, border: 'none', borderRadius: 11, background: 'var(--accent)',
  color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit',
}
