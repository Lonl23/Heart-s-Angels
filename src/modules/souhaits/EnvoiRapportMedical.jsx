import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, Loading, Flash, inp } from '@/components/ui'
import { htmlDocumentA4 } from './documentA4'
import { htmlRapportMedical, texteRapportMedical, SUJET_RAPPORT_MEDICAL } from './rapportMedicalExport.js'
import { envoyerRapportMedical } from '@/lib/envoyerInvitation'
import { injectionsDetresse } from './missionSchema'

const ALERTE_CONFIDENTIALITE = `DOCUMENT MÉDICAL STRICTEMENT CONFIDENTIEL.
Ce message est destiné uniquement au destinataire indiqué. S’il vous a été adressé par erreur, vous devez immédiatement le supprimer (y compris toute copie ou pièce jointe), n’en conserver aucune trace, et reprendre contact sans délai avec Heart’s Angels en répondant à cet e-mail (app@heartsangels.be).`

function heure(v) {
  return v ? new Date(v).toLocaleString('fr-BE', { dateStyle: 'short', timeStyle: 'short' }) : ''
}

export default function EnvoiRapportMedical({ souhaitId, souhait, meds = [], peutExporter, onBack }) {
  const [cibles, setCibles] = useState(null)
  const [notes, setNotes] = useState([])
  const [traces, setTraces] = useState([])
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
    const { data: lignes } = await supabase
      .from('souhait_dar')
      .select('id, genre, texte, created_at, auteur_id, profiles:auteur_id(prenom, nom)')
      .eq('souhait_id', souhaitId)
      .eq('genre', 'note')
      .order('created_at', { ascending: true })
    setNotes(lignes || [])
    if (peutExporter) {
      const { data: tr } = await supabase
        .from('envois_rapport_medical')
        .select('id, email, envoye_le, profiles:expediteur_id(prenom, nom)')
        .eq('souhait_id', souhaitId)
        .order('envoye_le', { ascending: false })
      setTraces(tr || [])
    }
  }

  useEffect(() => { charger() }, [souhaitId, peutExporter])

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
    return htmlDocumentA4(
      'Rapport médical',
      inner,
      'h1{font-size:18px;color:#0E4A5A} h2,h3{font-size:13px;color:#0E4A5A} .secret{color:#A32D2D;font-weight:800} table{width:100%;border-collapse:collapse} td,th{border:1px solid #e5e5e5;text-align:left;padding:4px;font-size:12px;vertical-align:top} th{width:2rem;text-align:center}',
    )
  }

  async function envoyer(e) {
    e.preventDefault()
    if (!peutExporter) { setErr('Envoi non autorisé.'); return }
    setBusy(true)
    setErr(null)
    setInfo(null)
    const html = await htmlComplet()
    const res = await envoyerRapportMedical({
      souhaitId,
      email,
      html,
      texte: `${ALERTE_CONFIDENTIALITE}\n\n${texteRapportMedical(html)}`,
    })
    setBusy(false)
    if (!res.ok) { setErr(res.error); return }
    setInfo(`Rapport envoyé à ${email.trim()} depuis app@heartsangels.be.`)
    setEmail('')
    charger()
  }

  if (cibles == null) return <div style={{ padding: 16 }}><Loading /></div>

  return (
    <div style={{ padding: '12px 14px 40px' }}>
      {onBack && <Btn kind="soft" onClick={onBack}>← Menu de la mission</Btn>}
      <h1 style={{ fontSize: '1.45rem', color: 'var(--heading)', margin: '12px 0 4px' }}>Envoyer le rapport médical</h1>
      <p style={{ color: 'var(--text-muted)', marginTop: 0 }}>
        L’e-mail part de <strong>app@heartsangels.be</strong> vers toute adresse (hôpital, famille, médecin…).
      </p>
      <div style={{
        background: '#FCEBEB', border: '1.5px solid #A32D2D', borderRadius: 14,
        padding: '12px 14px', color: '#7A1F1F', fontSize: 13.5, marginBottom: 14, whiteSpace: 'pre-wrap',
      }}>
        {ALERTE_CONFIDENTIALITE}
      </div>
      <p style={{ color: '#A32D2D', fontWeight: 800, marginTop: 0 }}>{SUJET_RAPPORT_MEDICAL}</p>
      {err && <Flash kind="err">{err}</Flash>}
      {info && <Flash>{info}</Flash>}
      {!peutExporter ? (
        <Flash kind="warn">Seul le personnel médical autorisé ou la coordination médicale peut envoyer ce rapport.</Flash>
      ) : (
        <form onSubmit={envoyer} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 16 }}>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)' }}>Adresse du destinataire</label>
          <input
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="ex. medecin@hopital.be"
            style={{ ...inp, margin: '6px 0 10px' }}
          />
          <Btn type="submit" disabled={busy}>{busy ? 'Envoi…' : 'Envoyer le rapport'}</Btn>
        </form>
      )}
      {traces.length > 0 && (
        <ul style={{ paddingLeft: 18, fontSize: 13.5, marginTop: 16 }}>
          {traces.map(t => (
            <li key={t.id}>
              {[t.profiles?.prenom, t.profiles?.nom].filter(Boolean).join(' ') || 'Compte'} → {t.email} · {heure(t.envoye_le)}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export { ALERTE_CONFIDENTIALITE }
