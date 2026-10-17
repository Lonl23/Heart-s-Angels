import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Page, Card, Btn, F, TA, Loading, Empty, Flash } from '@/components/ui'

const STATUTS = {
  ouvert: { l: 'Ouvert', c: '#BA7517', bg: '#FAEEDA' },
  en_cours: { l: 'En cours', c: '#185FA5', bg: '#E6F1FB' },
  resolu: { l: 'Résolu', c: '#0F6E56', bg: '#E1F5EE' },
  ferme: { l: 'Fermé', c: '#7A7470', bg: '#F0EFED' },
}

function refTicket(t) {
  const prefix = t.type === 'suggestion' ? 'S' : 'B'
  return `${prefix}-${t.numero}`
}

function quand(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('fr-BE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function Pastille({ statut }) {
  const s = STATUTS[statut] || STATUTS.ouvert
  return <span style={{ fontSize: 12, fontWeight: 700, color: s.c, background: s.bg, borderRadius: 99, padding: '2px 8px' }}>{s.l}</span>
}

export default function Helpdesk() {
  const { peutGererHelpdesk } = useAuth()
  const info = peutGererHelpdesk()
  return (
    <Page title="Helpdesk" subtitle={info ? 'Bugs et suggestions. L’informatique suit les dossiers.' : 'Signalez un bug ou proposez une idée. Vous voyez l’avancée de votre demande.'}>
      {info ? <FileInformatique /> : <MesDemandes />}
    </Page>
  )
}

function MesDemandes() {
  const [type, setType] = useState('bug')
  const [titre, setTitre] = useState('')
  const [description, setDescription] = useState('')
  const [tickets, setTickets] = useState(null)
  const [ouvert, setOuvert] = useState(null)
  const [msg, setMsg] = useState('')
  const [reponse, setReponse] = useState('')
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)

  async function charger() {
    const { data, error } = await supabase.rpc('mes_tickets')
    if (error) setErr(error.message)
    else setTickets(Array.isArray(data) ? data : [])
  }
  useEffect(() => { charger() }, [])

  async function envoyer(e) {
    e.preventDefault()
    if (!titre.trim() || !description.trim()) { setErr('Indiquez un titre et une description.'); return }
    setBusy(true)
    setErr(null)
    const { data, error } = await supabase.rpc('deposer_ticket', { p_type: type, p_titre: titre, p_description: description })
    setBusy(false)
    if (error || data?.ok === false) { setErr(error?.message || data?.error || 'Envoi impossible.'); return }
    setTitre('')
    setDescription('')
    setMsg(type === 'suggestion' ? 'Suggestion envoyée.' : 'Bug signalé.')
    await charger()
  }

  async function repondre(e) {
    e.preventDefault()
    setBusy(true)
    const { data, error } = await supabase.rpc('commenter_mon_ticket', { p_id: ouvert.id, p_message: reponse })
    setBusy(false)
    if (error || data?.ok === false) { alert(error?.message || data?.error || 'Message impossible.'); return }
    setReponse('')
    await charger()
  }

  const courant = tickets?.find(t => t.id === ouvert?.id) || null
  const liste = (tickets || []).filter(t => t.type === type)

  return (
    <div>
      {err && <Flash kind="err">{err}</Flash>}
      {msg && <Flash>{msg}</Flash>}
      <div className="ha-tabs" style={{ marginBottom: 12 }}>
        <button type="button" className={'ha-tab' + (type === 'bug' ? ' is-on' : '')} onClick={() => { setType('bug'); setOuvert(null) }}>Signaler un bug</button>
        <button type="button" className={'ha-tab' + (type === 'suggestion' ? ' is-on' : '')} onClick={() => { setType('suggestion'); setOuvert(null) }}>Suggestion</button>
      </div>
      <Card style={{ marginBottom: 16 }}>
        <form onSubmit={envoyer}>
          <F label="Titre" value={titre} set={setTitre} required />
          <TA label="Description" value={description} set={setDescription} rows={5} required />
          <Btn type="submit" disabled={busy}>{busy ? '…' : 'Envoyer'}</Btn>
        </form>
      </Card>
      {tickets === null ? <Loading /> : liste.length === 0 ? (
        <Empty title="Aucune demande" hint="Vos envois apparaîtront ici, avec leur avancement." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {liste.map(t => (
            <button key={t.id} type="button" className="ha-actu-ligne" onClick={() => setOuvert(t)}>
              <strong>{refTicket(t)} · {t.titre}</strong>
              <Pastille statut={t.statut} />
            </button>
          ))}
        </div>
      )}
      {courant && (
        <Card style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{refTicket(courant)} · {courant.titre}</h2>
            <Pastille statut={courant.statut} />
          </div>
          <p style={{ whiteSpace: 'pre-wrap' }}>{courant.description}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            {(courant.messages || []).map((m, i) => (
              <div key={i} style={{ background: 'var(--bg-alt)', borderRadius: 8, padding: '8px 10px' }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{m.qui === 'moi' ? 'Vous' : 'Équipe informatique'} · {quand(m.created_at)}</div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{m.message}</div>
              </div>
            ))}
          </div>
          <form onSubmit={repondre}>
            <TA label="Ajouter un message" value={reponse} set={setReponse} rows={3} />
            <Btn type="submit" disabled={busy}>Envoyer</Btn>
          </form>
        </Card>
      )}
    </div>
  )
}

function FileInformatique() {
  const [file, setFile] = useState(null)
  const [type, setType] = useState('bug')
  const [ouvert, setOuvert] = useState(null)
  const [coches, setCoches] = useState([])
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const [notePublique, setNotePublique] = useState('')
  const [noteInterne, setNoteInterne] = useState('')

  async function charger() {
    const { data, error } = await supabase.rpc('helpdesk_file')
    if (error || data?.ok === false) setErr(error?.message || data?.error || 'File inaccessible.')
    else setFile(data)
  }
  useEffect(() => { charger() }, [])

  const tickets = (file?.tickets || []).filter(t => t.type === type)
  const courant = tickets.find(t => t.id === ouvert) || (file?.tickets || []).find(t => t.id === ouvert) || null

  function basculer(id) {
    setCoches(xs => xs.includes(id) ? xs.filter(x => x !== id) : [...xs, id])
  }

  async function fusionner() {
    if (!courant || coches.length === 0) { alert('Ouvrez le dossier principal, puis cochez ceux qui traitent le même sujet.'); return }
    if (!confirm('Fusionner ces dossiers dans celui qui est ouvert ?')) return
    setBusy(true)
    const { data, error } = await supabase.rpc('helpdesk_fusionner', { p_principal: courant.id, p_ids: coches })
    setBusy(false)
    if (error || data?.ok === false) { alert(error?.message || data?.error || 'Fusion impossible.'); return }
    setCoches([])
    await charger()
  }

  async function statut(v) {
    setBusy(true)
    const { data, error } = await supabase.rpc('helpdesk_statut', { p_id: courant.id, p_statut: v })
    setBusy(false)
    if (error || data?.ok === false) { alert(error?.message || data?.error || 'Statut impossible.'); return }
    await charger()
  }

  async function noter(e, interne) {
    e.preventDefault()
    const texte = interne ? noteInterne : notePublique
    setBusy(true)
    const { data, error } = await supabase.rpc('helpdesk_note', { p_id: courant.id, p_message: texte, p_interne: interne })
    setBusy(false)
    if (error || data?.ok === false) { alert(error?.message || data?.error || 'Note impossible.'); return }
    if (interne) setNoteInterne('')
    else setNotePublique('')
    await charger()
  }

  return (
    <div>
      {err && <Flash kind="err">{err}</Flash>}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <Card style={{ minWidth: 160 }}><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Bugs ouverts</div><div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{file?.bugs_ouverts ?? '…'}</div></Card>
        <Card style={{ minWidth: 160 }}><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Suggestions ouvertes</div><div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{file?.suggestions_ouvertes ?? '…'}</div></Card>
      </div>
      <div className="ha-tabs" style={{ marginBottom: 12 }}>
        <button type="button" className={'ha-tab' + (type === 'bug' ? ' is-on' : '')} onClick={() => { setType('bug'); setOuvert(null); setCoches([]) }}>Bugs</button>
        <button type="button" className={'ha-tab' + (type === 'suggestion' ? ' is-on' : '')} onClick={() => { setType('suggestion'); setOuvert(null); setCoches([]) }}>Suggestions</button>
      </div>
      {file === null ? <Loading /> : tickets.length === 0 ? <Empty title="Aucun dossier" /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tickets.map(t => (
            <div key={t.id} className="ha-actu-ligne" style={{ cursor: 'default' }}>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="checkbox" checked={coches.includes(t.id)} onChange={() => basculer(t.id)} />
                <button type="button" onClick={() => setOuvert(t.id)} style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', color: 'inherit' }}>
                  <strong>{refTicket(t)} · {t.titre}</strong>
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{t.auteur_nom || 'Volontaire'} · {quand(t.created_at)}{t.n_lies > 0 ? ` · ${t.n_lies} signalement${t.n_lies > 1 ? 's' : ''} lié${t.n_lies > 1 ? 's' : ''}` : ''}</div>
                </button>
              </label>
              <Pastille statut={t.statut} />
            </div>
          ))}
        </div>
      )}
      <div style={{ marginTop: 12 }}>
        <Btn kind="soft" onClick={fusionner} disabled={busy || !courant || coches.length === 0}>Fusionner dans le dossier ouvert</Btn>
      </div>
      {courant && (
        <Card style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{refTicket(courant)} · {courant.titre}</h2>
            <select value={courant.statut} onChange={e => statut(e.target.value)} disabled={busy}>
              {Object.entries(STATUTS).map(([v, s]) => <option key={v} value={v}>{s.l}</option>)}
            </select>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{courant.auteur_nom}</p>
          <p style={{ whiteSpace: 'pre-wrap' }}>{courant.description}</p>
          {(courant.lies || []).length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <strong>Signalements liés</strong>
              {courant.lies.map(l => (
                <div key={l.id} style={{ fontSize: 13.5, marginTop: 6 }}>
                  <div>{l.auteur_nom || 'Volontaire'} · {l.titre}</div>
                  <div style={{ color: 'var(--text-2)', whiteSpace: 'pre-wrap' }}>{l.description}</div>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            {(courant.messages || []).map((m, i) => (
              <div key={i} style={{ background: m.interne ? '#FAEEDA' : 'var(--bg-alt)', borderRadius: 8, padding: '8px 10px' }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{m.interne ? 'Note interne' : (m.origine === 'informatique' ? 'Réponse visible' : (m.auteur_nom || 'Auteur'))} · {quand(m.created_at)}</div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{m.message}</div>
              </div>
            ))}
          </div>
          <form onSubmit={e => noter(e, false)} style={{ marginBottom: 10 }}>
            <TA label="Réponse visible par l’auteur" value={notePublique} set={setNotePublique} rows={3} />
            <Btn type="submit" disabled={busy}>Publier la réponse</Btn>
          </form>
          <form onSubmit={e => noter(e, true)}>
            <TA label="Note interne, invisible pour les auteurs" value={noteInterne} set={setNoteInterne} rows={2} />
            <Btn kind="soft" type="submit" disabled={busy}>Enregistrer la note</Btn>
          </form>
        </Card>
      )}
    </div>
  )
}
