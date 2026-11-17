import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Page, Card, Btn, F, TA, Loading, Empty, Flash } from '@/components/ui'
import { compressImage } from '@/modules/souhaits/TerrainPhotos'
import { envoyerMailBugHelpdesk } from '@/lib/envoyerInvitation'

const BUCKET = 'helpdesk-captures'
const MAX_CAPTURES = 5

const STATUTS = {
  ouvert: { l: 'Ouvert', c: '#BA7517', bg: '#FAEEDA' },
  en_cours: { l: 'En cours', c: '#185FA5', bg: '#E6F1FB' },
  resolu: { l: 'Résolu', c: '#0F6E56', bg: '#E1F5EE' },
  ferme: { l: 'Fermé', c: '#7A7470', bg: '#F0EFED' },
}
/** Statuts que l’IT peut choisir (fermé = auto après 48 h en résolu). */
const STATUTS_IT = ['ouvert', 'en_cours', 'resolu']

function dossierFerme(t) {
  return t?.statut === 'ferme'
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

function CapturesListe({ pieces }) {
  const [urls, setUrls] = useState({})
  useEffect(() => {
    let alive = true
    async function charger() {
      const next = {}
      for (const p of pieces || []) {
        if (!p?.path) continue
        const { data } = await supabase.storage.from(BUCKET).createSignedUrl(p.path, 3600)
        if (data?.signedUrl) next[p.path] = data.signedUrl
      }
      if (alive) setUrls(next)
    }
    if ((pieces || []).length) charger()
    else setUrls({})
    return () => { alive = false }
  }, [pieces])
  if (!pieces?.length) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '10px 0 14px' }}>
      {pieces.map(p => (
        <a key={p.id || p.path} href={urls[p.path] || '#'} target="_blank" rel="noreferrer" style={{ display: 'block', width: 96, height: 72, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--bg-alt)' }}>
          {urls[p.path]
            ? <img src={urls[p.path]} alt={p.nom || 'Capture'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'grid', placeItems: 'center', height: '100%' }}>…</span>}
        </a>
      ))}
    </div>
  )
}

function ChampCaptures({ fichiers, setFichiers, disabled }) {
  async function onPick(e) {
    const chosen = Array.from(e.target.files || [])
    e.target.value = ''
    if (!chosen.length) return
    const reste = MAX_CAPTURES - fichiers.length
    if (reste <= 0) return
    const ajouts = []
    for (const file of chosen.slice(0, reste)) {
      if (!file.type?.startsWith('image/')) continue
      try {
        const blob = await compressImage(file)
        const preview = URL.createObjectURL(blob)
        ajouts.push({
          id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
          blob,
          nom: file.name || 'capture.jpg',
          preview,
        })
      } catch { /* image illisible */ }
    }
    if (ajouts.length) setFichiers(xs => [...xs, ...ajouts].slice(0, MAX_CAPTURES))
  }

  function retirer(id) {
    setFichiers(xs => {
      const gone = xs.find(f => f.id === id)
      if (gone?.preview) URL.revokeObjectURL(gone.preview)
      return xs.filter(f => f.id !== id)
    })
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>
        Captures d’écran <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optionnel, {MAX_CAPTURES} max)</span>
      </div>
      {fichiers.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
          {fichiers.map(f => (
            <div key={f.id} style={{ position: 'relative', width: 88, height: 66, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
              <img src={f.preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button type="button" onClick={() => retirer(f.id)} disabled={disabled}
                style={{ position: 'absolute', top: 2, right: 2, width: 22, height: 22, border: 'none', borderRadius: 99, background: 'rgba(0,0,0,.55)', color: '#fff', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      {fichiers.length < MAX_CAPTURES && (
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 9, border: '1px dashed var(--border)', background: 'var(--bg-alt)', cursor: disabled ? 'default' : 'pointer', fontSize: 13, color: 'var(--text-2)' }}>
          Ajouter une capture
          <input type="file" accept="image/*" multiple capture="environment" onChange={onPick} disabled={disabled} style={{ display: 'none' }} />
        </label>
      )}
    </div>
  )
}

async function uploaderCaptures(ticketId, fichiers) {
  const pieces = []
  for (const f of fichiers) {
    const id = crypto.randomUUID?.() || String(Date.now())
    const path = `${ticketId}/${id}.jpg`
    const { error } = await supabase.storage.from(BUCKET).upload(path, f.blob, {
      contentType: 'image/jpeg',
      upsert: false,
    })
    if (error) throw new Error(error.message || 'Upload impossible.')
    pieces.push({
      path,
      nom: f.nom || 'capture.jpg',
      mime: 'image/jpeg',
      taille: f.blob?.size || 0,
    })
  }
  if (!pieces.length) return []
  const { data, error } = await supabase.rpc('lier_pieces_helpdesk', {
    p_ticket: ticketId,
    p_pieces: pieces,
  })
  if (error || data?.ok === false) throw new Error(error?.message || data?.error || 'Pièces impossibles à lier.')
  return pieces
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
  const [fichiers, setFichiers] = useState([])
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
  useEffect(() => {
    charger()
    const ch = supabase
      .channel('ha-helpdesk-moi')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'helpdesk_tickets' }, () => { charger() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'helpdesk_suivi' }, () => { charger() })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  async function envoyer(e) {
    e.preventDefault()
    if (!titre.trim() || !description.trim()) { setErr('Indiquez un titre et une description.'); return }
    setBusy(true)
    setErr(null)
    setMsg('')
    const { data, error } = await supabase.rpc('deposer_ticket', { p_type: type, p_titre: titre, p_description: description })
    if (error || data?.ok === false) {
      setBusy(false)
      setErr(error?.message || data?.error || 'Envoi impossible.')
      return
    }
    const ticketId = data.id
    try {
      if (fichiers.length) await uploaderCaptures(ticketId, fichiers)
    } catch (upErr) {
      setBusy(false)
      setErr(upErr.message || 'Captures non envoyées.')
      await charger()
      return
    }
    if (type === 'bug') {
      const mail = await envoyerMailBugHelpdesk(ticketId)
      if (!mail.ok) {
        setBusy(false)
        setErr(`Bug enregistré, mais le mail prioritaire n’est pas parti : ${mail.error}`)
        setTitre('')
        setDescription('')
        fichiers.forEach(f => f.preview && URL.revokeObjectURL(f.preview))
        setFichiers([])
        await charger()
        return
      }
    }
    setBusy(false)
    setTitre('')
    setDescription('')
    fichiers.forEach(f => f.preview && URL.revokeObjectURL(f.preview))
    setFichiers([])
    setMsg(type === 'suggestion' ? 'Suggestion envoyée.' : 'Bug signalé. Un mail prioritaire a été envoyé à l’informatique.')
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
          <ChampCaptures fichiers={fichiers} setFichiers={setFichiers} disabled={busy} />
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
          <CapturesListe pieces={courant.pieces} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            {(courant.messages || []).map((m, i) => (
              <div key={i} style={{ background: 'var(--bg-alt)', borderRadius: 8, padding: '8px 10px' }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{m.qui === 'moi' ? 'Vous' : 'Équipe informatique'} · {quand(m.created_at)}</div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{m.message}</div>
              </div>
            ))}
          </div>
          {dossierFerme(courant) ? (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>Dossier fermé — plus de message possible.</p>
          ) : (
            <form onSubmit={repondre}>
              <TA label="Ajouter un message" value={reponse} set={setReponse} rows={3} />
              <Btn type="submit" disabled={busy}>Envoyer</Btn>
            </form>
          )}
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
  useEffect(() => {
    charger()
    const ch = supabase
      .channel('ha-helpdesk-it')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'helpdesk_tickets' }, () => { charger() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'helpdesk_suivi' }, () => { charger() })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  const tickets = (file?.tickets || []).filter(t => t.type === type)
  const courant = tickets.find(t => t.id === ouvert) || (file?.tickets || []).find(t => t.id === ouvert) || null
  const ferme = dossierFerme(courant)

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
    if (ferme) { alert('Dossier fermé — plus de note possible.'); return }
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
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{t.auteur_nom || 'Volontaire'} · {quand(t.created_at)}{t.n_lies > 0 ? ` · ${t.n_lies} signalement${t.n_lies > 1 ? 's' : ''} lié${t.n_lies > 1 ? 's' : ''}` : ''}{(t.pieces || []).length ? ` · ${(t.pieces || []).length} capture${(t.pieces || []).length > 1 ? 's' : ''}` : ''}</div>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{refTicket(courant)} · {courant.titre}</h2>
            {ferme ? (
              <Pastille statut="ferme" />
            ) : (
              <select value={courant.statut === 'ferme' ? 'resolu' : courant.statut} onChange={e => statut(e.target.value)} disabled={busy}>
                {STATUTS_IT.map(v => <option key={v} value={v}>{STATUTS[v].l}</option>)}
              </select>
            )}
          </div>
          {courant.statut === 'resolu' && courant.resolu_le && (
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '4px 0 0' }}>
              Passera en fermé automatiquement 48 h après le passage en résolu ({quand(courant.resolu_le)}).
            </p>
          )}
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{courant.auteur_nom}{courant.auteur_email ? ` · ${courant.auteur_email}` : ''}</p>
          <p style={{ whiteSpace: 'pre-wrap' }}>{courant.description}</p>
          <CapturesListe pieces={courant.pieces} />
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
          {ferme ? (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>Dossier fermé — plus de note possible.</p>
          ) : (
            <>
              <form onSubmit={e => noter(e, false)} style={{ marginBottom: 10 }}>
                <TA label="Réponse visible par l’auteur" value={notePublique} set={setNotePublique} rows={3} />
                <Btn type="submit" disabled={busy}>Publier la réponse</Btn>
              </form>
              <form onSubmit={e => noter(e, true)}>
                <TA label="Note interne, invisible pour les auteurs" value={noteInterne} set={setNoteInterne} rows={2} />
                <Btn kind="soft" type="submit" disabled={busy}>Enregistrer la note</Btn>
              </form>
            </>
          )}
        </Card>
      )}
    </div>
  )
}
