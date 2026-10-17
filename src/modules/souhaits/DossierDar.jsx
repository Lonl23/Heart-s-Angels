import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, Loading, Flash, inp } from '@/components/ui'
import { htmlDocumentA4, telechargerHtml } from './documentA4'
import { htmlRapportMedical, texteRapportMedical, SUJET_RAPPORT_MEDICAL } from './rapportMedicalExport.js'
import { envoyerRapportMedical } from '@/lib/envoyerInvitation'
import { injectionsDetresse } from './missionSchema'

const GENRES = [
  { v: 'donnee', l: 'Données' },
  { v: 'action', l: 'Actions' },
  { v: 'resultat', l: 'Résultats' },
  { v: 'note', l: 'Note pour l’équipage' },
]

function heure(v) {
  return v ? new Date(v).toLocaleString('fr-BE', { dateStyle: 'short', timeStyle: 'short' }) : ''
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
  const [lignes, setLignes] = useState(null)
  const [traces, setTraces] = useState([])
  const [genre, setGenre] = useState(peutEcrire ? 'donnee' : 'note')
  const [texte, setTexte] = useState('')
  const [email, setEmail] = useState('')
  const [err, setErr] = useState(null)
  const [info, setInfo] = useState(null)
  const [busy, setBusy] = useState(false)

  async function charger() {
    const { data, error } = await supabase
      .from('souhait_dar')
      .select('id, genre, texte, created_at, auteur_id, individuel, profiles:auteur_id(prenom, nom)')
      .eq('souhait_id', souhaitId)
      .order('created_at', { ascending: true })
    if (error) setErr(error.message)
    else setLignes(data || [])
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
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'souhait_dar', filter: `souhait_id=eq.${souhaitId}` }, () => charger())
      .subscribe()
    const timer = setInterval(charger, 8000)
    return () => { supabase.removeChannel(ch); clearInterval(timer) }
  }, [souhaitId])

  async function publier(e) {
    e.preventDefault()
    const t = texte.trim()
    if (!t) return
    const user = (await supabase.auth.getUser()).data.user
    const { error } = await supabase.from('souhait_dar').insert({
      souhait_id: souhaitId,
      auteur_id: user?.id,
      genre: peutEcrire ? genre : 'note',
      texte: t,
      individuel: !!individuel,
    })
    if (error) { setErr(error.message); return }
    setTexte('')
    setErr(null)
    charger()
  }

  async function htmlComplet() {
    const dar = (lignes || []).map(r => ({
      ...r,
      auteur_prenom: r.profiles?.prenom,
      auteur_nom: r.profiles?.nom,
    }))
    const inner = htmlRapportMedical({
      souhait,
      dar,
      meds,
      injections: injectionsDetresse(souhait?.mission),
    })
    return htmlDocumentA4('Rapport médical', inner, 'h1{font-size:18px;color:#0E4A5A} h2{font-size:13px;color:#0E4A5A} .secret{color:#A32D2D;font-weight:800} table{width:100%;border-collapse:collapse} td,th{border-bottom:1px solid #e5e5e5;text-align:left;padding:4px;font-size:12px}')
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
        Données, actions et résultats, visibles en direct par les partenaires et la coordination médicale. Ils peuvent ajouter une note pour l’équipage.
      </p>
      {err && <Flash kind="err">{err}</Flash>}
      {info && <Flash>{info}</Flash>}
      {lignes == null ? <Loading /> : (
        GENRES.map(g => (
          <section key={g.v} style={{ marginTop: 14 }}>
            <h2 style={{ fontSize: '1rem', color: 'var(--heading)' }}>{g.l}</h2>
            {(lignes.filter(l => l.genre === g.v)).length === 0
              ? <p style={{ color: 'var(--text-muted)', fontSize: 13.5 }}>Rien pour le moment.</p>
              : lignes.filter(l => l.genre === g.v).map(l => (
                <article key={l.id} style={{ borderLeft: '3px solid var(--accent)', padding: '4px 0 8px 10px', marginBottom: 8 }}>
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                    {heure(l.created_at)} · {[l.profiles?.prenom, l.profiles?.nom].filter(Boolean).join(' ') || 'Compte'}
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{l.texte}</div>
                </article>
              ))}
          </section>
        ))
      )}
      {(peutEcrire || peutNoter) && (
        <form onSubmit={publier} style={{ marginTop: 16 }}>
          {peutEcrire && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              {GENRES.map(g => (
                <button key={g.v} type="button" className={'ha-tab' + (genre === g.v ? ' is-on' : '')} onClick={() => setGenre(g.v)}>{g.l}</button>
              ))}
            </div>
          )}
          <textarea value={texte} onChange={e => setTexte(e.target.value)} rows={4} style={{ ...inp, resize: 'vertical' }} placeholder={peutEcrire ? 'Donnée, action ou résultat…' : 'Note pour l’équipage…'} />
          <div style={{ marginTop: 8 }}><Btn type="submit">Publier</Btn></div>
        </form>
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
