import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, Loading, Flash, inp } from '@/components/ui'
import { htmlDocumentA4, telechargerHtml } from './documentA4'
import { htmlRapportMedical, texteRapportMedical, SUJET_RAPPORT_MEDICAL } from './rapportMedicalExport.js'
import { envoyerRapportMedical } from '@/lib/envoyerInvitation'
import { injectionsDetresse } from './missionSchema'

const LETTRES = [
  { k: 'donnee', l: 'D', mot: 'Données' },
  { k: 'action', l: 'A', mot: 'Actions' },
  { k: 'resultat', l: 'R', mot: 'Résultats' },
]

function heure(v) {
  return v ? new Date(v).toLocaleString('fr-BE', { dateStyle: 'short', timeStyle: 'short' }) : ''
}

function champs(l) {
  return {
    probleme: l?.probleme || '',
    donnee: l?.donnee || '',
    action: l?.action || '',
    resultat: l?.resultat || '',
  }
}

function TableauProbleme({ ligne, peutEcrire, onSave, onDelete }) {
  const [f, setF] = useState(() => champs(ligne))
  const sale = useRef(false)
  const [confirm, setConfirm] = useState(false)
  const qui = [ligne.profiles?.prenom, ligne.profiles?.nom].filter(Boolean).join(' ') || 'Compte'

  useEffect(() => {
    if (!sale.current) setF(champs(ligne))
  }, [ligne.id, ligne.updated_at, ligne.probleme, ligne.donnee, ligne.action, ligne.resultat])

  function maj(k, v) {
    sale.current = true
    setF(cur => ({ ...cur, [k]: v }))
  }

  async function sauver() {
    if (!peutEcrire || !sale.current) return
    await onSave(ligne.id, f)
    sale.current = false
  }

  return (
    <section className="ha-dar-probleme">
      <div className="ha-dar-entete">
        {peutEcrire ? (
          <input
            value={f.probleme}
            onChange={e => maj('probleme', e.target.value)}
            onBlur={sauver}
            style={{ ...inp, fontWeight: 700, margin: 0 }}
            aria-label="Problème ou plainte"
          />
        ) : (
          <h2>{f.probleme || 'Problème'}</h2>
        )}
        <div className="ha-dar-meta">{heure(ligne.created_at)} · {qui}</div>
      </div>
      <table className="ha-dar-table">
        <tbody>
          {LETTRES.map(L => (
            <tr key={L.k}>
              <th scope="row">
                <span className="ha-dar-lettre">{L.l}</span>
                <span className="ha-dar-mot">{L.mot}</span>
              </th>
              <td>
                {peutEcrire ? (
                  <textarea
                    value={f[L.k]}
                    onChange={e => maj(L.k, e.target.value)}
                    onBlur={sauver}
                    rows={3}
                    aria-label={L.mot}
                  />
                ) : (
                  <div className="ha-dar-lecture">{f[L.k] || '—'}</div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {peutEcrire && (
        <div style={{ marginTop: 8 }}>
          {confirm ? (
            <Btn kind="soft" onClick={() => onDelete(ligne.id)}>Confirmer le retrait</Btn>
          ) : (
            <Btn kind="soft" onClick={() => setConfirm(true)}>Retirer ce problème</Btn>
          )}
        </div>
      )}
    </section>
  )
}

export default function DossierDar({
  souhaitId,
  individuel,
  peutEcrire,
  peutNoter,
  peutExporter,
  souhait,
  meds,
  onBack,
}) {
  const [cibles, setCibles] = useState(null)
  const [notes, setNotes] = useState([])
  const [traces, setTraces] = useState([])
  const [probleme, setProbleme] = useState('')
  const [note, setNote] = useState('')
  const [email, setEmail] = useState('')
  const [err, setErr] = useState(null)
  const [info, setInfo] = useState(null)
  const [busy, setBusy] = useState(false)

  async function charger() {
    const { data, error } = await supabase
      .from('souhait_dar_cibles')
      .select('id, probleme, donnee, action, resultat, created_at, updated_at, auteur_id, profiles:auteur_id(prenom, nom)')
      .eq('souhait_id', souhaitId)
      .order('created_at', { ascending: true })
    if (error) setErr(error.message)
    else setCibles(data || [])
    const { data: lignes, error: errNotes } = await supabase
      .from('souhait_dar')
      .select('id, genre, texte, created_at, auteur_id, profiles:auteur_id(prenom, nom)')
      .eq('souhait_id', souhaitId)
      .eq('genre', 'note')
      .order('created_at', { ascending: true })
    if (errNotes) setErr(errNotes.message)
    else setNotes(lignes || [])
    if (peutExporter) {
      const { data: tr } = await supabase
        .from('envois_rapport_medical')
        .select('id, email, envoye_le, profiles:expediteur_id(prenom, nom)')
        .eq('souhait_id', souhaitId)
        .order('envoye_le', { ascending: false })
      setTraces(tr || [])
    }
  }

  useEffect(() => {
    charger()
    const ch = supabase.channel('dar-' + souhaitId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'souhait_dar_cibles', filter: `souhait_id=eq.${souhaitId}` }, () => charger())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'souhait_dar', filter: `souhait_id=eq.${souhaitId}` }, () => charger())
      .subscribe()
    const timer = setInterval(charger, 8000)
    return () => { supabase.removeChannel(ch); clearInterval(timer) }
  }, [souhaitId])

  async function ajouter(e) {
    e.preventDefault()
    const titre = probleme.trim()
    if (!titre) return
    const user = (await supabase.auth.getUser()).data.user
    const { error } = await supabase.from('souhait_dar_cibles').insert({
      souhait_id: souhaitId,
      auteur_id: user?.id,
      probleme: titre,
      donnee: '',
      action: '',
      resultat: '',
      individuel: !!individuel,
    })
    if (error) { setErr(error.message); return }
    setProbleme('')
    setErr(null)
    charger()
  }

  async function sauver(id, f) {
    const { error } = await supabase.from('souhait_dar_cibles').update({
      probleme: f.probleme.trim() || 'Problème',
      donnee: f.donnee,
      action: f.action,
      resultat: f.resultat,
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    if (error) setErr(error.message)
    else setErr(null)
  }

  async function retirer(id) {
    const { error } = await supabase.from('souhait_dar_cibles').delete().eq('id', id)
    if (error) setErr(error.message)
    else charger()
  }

  async function publierNote(e) {
    e.preventDefault()
    const t = note.trim()
    if (!t) return
    const user = (await supabase.auth.getUser()).data.user
    const { error } = await supabase.from('souhait_dar').insert({
      souhait_id: souhaitId,
      auteur_id: user?.id,
      genre: 'note',
      texte: t,
      individuel: !!individuel,
    })
    if (error) { setErr(error.message); return }
    setNote('')
    setErr(null)
    charger()
  }

  async function htmlComplet() {
    const dar = (notes || []).map(r => ({
      ...r,
      auteur_prenom: r.profiles?.prenom,
      auteur_nom: r.profiles?.nom,
    }))
    const inner = htmlRapportMedical({
      souhait,
      dar,
      cibles: cibles || [],
      meds,
      injections: injectionsDetresse(souhait?.mission),
    })
    return htmlDocumentA4('Rapport médical', inner, 'h1{font-size:18px;color:#0E4A5A} h2,h3{font-size:13px;color:#0E4A5A} .secret{color:#A32D2D;font-weight:800} table{width:100%;border-collapse:collapse} td,th{border:1px solid #e5e5e5;text-align:left;padding:4px;font-size:12px;vertical-align:top} th{width:2rem;text-align:center}')
  }

  async function telecharger() {
    const nom = 'Rapport-medical-' + (souhait?.beneficiaire_prenom || 'mission') + '.html'
    telechargerHtml(nom.replace(/[^\p{L}\p{N}.-]+/gu, '-'), await htmlComplet())
  }

  async function envoyer(e) {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    setInfo(null)
    const html = await htmlComplet()
    const res = await envoyerRapportMedical({
      souhaitId,
      email,
      html,
      texte: texteRapportMedical(html),
    })
    setBusy(false)
    if (!res.ok) { setErr(res.error); return }
    setInfo(`Rapport envoyé à ${email.trim()}.`)
    setEmail('')
    charger()
  }

  return (
    <div style={{ padding: '12px 14px 40px' }}>
      {onBack && <Btn kind="soft" onClick={onBack}>← Menu de la mission</Btn>}
      <h1 style={{ fontSize: '1.45rem', color: 'var(--heading)', margin: '12px 0 4px' }}>Rapport médical</h1>
      <p style={{ color: 'var(--text-muted)', marginTop: 0 }}>
        Un tableau par problème ou plainte du patient : D pour les données, A pour les actions, R pour les résultats. Visible en direct par l’équipage, le partenaire et la coordination médicale.
      </p>
      {err && <Flash kind="err">{err}</Flash>}
      {info && <Flash>{info}</Flash>}
      {cibles == null ? <Loading /> : (
        <>
          {cibles.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: 13.5 }}>Aucun problème noté pour le moment.</p>}
          {cibles.map(c => (
            <TableauProbleme key={c.id} ligne={c} peutEcrire={peutEcrire} onSave={sauver} onDelete={retirer} />
          ))}
          {peutEcrire && (
            <form onSubmit={ajouter} style={{ marginTop: 16 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)' }}>Nouveau problème ou plainte</label>
              <input value={probleme} onChange={e => setProbleme(e.target.value)} style={{ ...inp, margin: '6px 0 10px' }} placeholder="Par exemple : douleur, nausée, agitation…" />
              <Btn type="submit">Ajouter le tableau</Btn>
            </form>
          )}
          <section style={{ marginTop: 22 }}>
            <h2 style={{ fontSize: '1rem', color: 'var(--heading)' }}>Notes pour l’équipage</h2>
            {notes.length === 0
              ? <p style={{ color: 'var(--text-muted)', fontSize: 13.5 }}>Rien pour le moment.</p>
              : notes.map(l => (
                <article key={l.id} style={{ borderLeft: '3px solid var(--accent)', padding: '4px 0 8px 10px', marginBottom: 8 }}>
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                    {heure(l.created_at)} · {[l.profiles?.prenom, l.profiles?.nom].filter(Boolean).join(' ') || 'Compte'}
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{l.texte}</div>
                </article>
              ))}
            {peutNoter && (
              <form onSubmit={publierNote} style={{ marginTop: 8 }}>
                <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} style={{ ...inp, resize: 'vertical' }} placeholder="Note pour l’équipage…" />
                <div style={{ marginTop: 8 }}><Btn type="submit">Publier la note</Btn></div>
              </form>
            )}
          </section>
        </>
      )}
      {peutExporter && (
        <section style={{ marginTop: 22, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 16 }}>
          <h2 style={{ marginTop: 0, fontSize: '1.05rem' }}>Exporter le rapport médical</h2>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>Le fichier ne reprend pas les véhicules. L’objet du message est fixé.</p>
          <p style={{ color: '#A32D2D', fontWeight: 800 }}>{SUJET_RAPPORT_MEDICAL}</p>
          <Btn kind="soft" onClick={telecharger}>Télécharger</Btn>
          <form onSubmit={envoyer} style={{ marginTop: 12 }}>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)' }}>Adresse du destinataire</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} style={{ ...inp, margin: '6px 0 10px' }} />
            <Btn type="submit" disabled={busy}>{busy ? 'Envoi…' : 'Envoyer le rapport'}</Btn>
          </form>
          {traces.length > 0 && (
            <ul style={{ paddingLeft: 18, fontSize: 13.5 }}>
              {traces.map(t => (
                <li key={t.id}>
                  {[t.profiles?.prenom, t.profiles?.nom].filter(Boolean).join(' ') || 'Compte'} → {t.email} · {heure(t.envoye_le)}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}
