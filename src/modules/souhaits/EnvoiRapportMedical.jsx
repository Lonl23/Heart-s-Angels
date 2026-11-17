import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, Loading, Flash, inp, F } from '@/components/ui'
import {
  htmlEmailRapportMedical, texteEmailRapportMedical,
  SUJET_RAPPORT_MEDICAL, ALERTE_CONFIDENTIALITE_MAIL,
} from './rapportMedicalExport.js'
import { envoyerRapportMedical } from '@/lib/envoyerInvitation'
import { injectionsDetresse } from './missionSchema'

const ALERTE_CONFIDENTIALITE = ALERTE_CONFIDENTIALITE_MAIL

function heure(v) {
  return v ? new Date(v).toLocaleString('fr-BE', { dateStyle: 'short', timeStyle: 'short' }) : ''
}

function libelleDestinataire(t) {
  const nom = [t?.destinataire_prenom, t?.destinataire_nom].filter(Boolean).join(' ')
  return nom || 'Destinataire'
}

function libelleExpediteur(t) {
  return [t?.profiles?.prenom, t?.profiles?.nom].filter(Boolean).join(' ') || 'Compte'
}

export default function EnvoiRapportMedical({ souhaitId, souhait, meds = [], peutExporter, onBack }) {
  const [cibles, setCibles] = useState(null)
  const [notes, setNotes] = useState([])
  const [traces, setTraces] = useState([])
  const [form, setForm] = useState({ prenom: '', nom: '', email: '' })
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
        .select('id, email, destinataire_prenom, destinataire_nom, envoye_le, profiles:expediteur_id(prenom, nom)')
        .eq('souhait_id', souhaitId)
        .order('envoye_le', { ascending: false })
      setTraces(tr || [])
    }
  }

  useEffect(() => { charger() }, [souhaitId, peutExporter])

  function payloadMail() {
    const dar = (notes || []).map(r => ({
      ...r,
      auteur_prenom: r.profiles?.prenom,
      auteur_nom: r.profiles?.nom,
    }))
    const opts = {
      souhait,
      dar,
      cibles: cibles || [],
      meds,
      injections: injectionsDetresse(souhait?.mission),
      destinatairePrenom: form.prenom,
      destinataireNom: form.nom,
    }
    return {
      html: htmlEmailRapportMedical(opts),
      texte: texteEmailRapportMedical(opts),
    }
  }

  async function envoyer(e) {
    e.preventDefault()
    if (!peutExporter) { setErr('Envoi non autorisé.'); return }
    setBusy(true)
    setErr(null)
    setInfo(null)
    const { html, texte } = payloadMail()
    const res = await envoyerRapportMedical({
      souhaitId,
      email: form.email,
      destinatairePrenom: form.prenom,
      destinataireNom: form.nom,
      html,
      texte,
    })
    setBusy(false)
    if (!res.ok) { setErr(res.error); return }
    const qui = [form.prenom, form.nom].filter(Boolean).join(' ')
    setInfo(`Rapport envoyé à ${qui} <${form.email.trim()}> depuis app@heartsangels.be.`)
    setForm({ prenom: '', nom: '', email: '' })
    charger()
  }

  if (cibles == null) return <div style={{ padding: 16 }}><Loading /></div>

  return (
    <div style={{ padding: '12px 14px 40px' }}>
      {onBack && <Btn kind="soft" onClick={onBack}>← Menu de la mission</Btn>}
      <h1 style={{ fontSize: '1.45rem', color: 'var(--heading)', margin: '12px 0 4px' }}>Envoyer le rapport médical</h1>
      <p style={{ color: 'var(--text-muted)', marginTop: 0 }}>
        L’e-mail part de <strong>app@heartsangels.be</strong>. Chaque envoi est tracé (qui a envoyé, destinataire, adresse).
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
        <Flash kind="warn">Réservé aux volontaires médicaux du souhait (ou à la coordination médicale). Sur un souhait de test, tout volontaire médical peut s’entraîner à l’envoi.</Flash>
      ) : (
        <form onSubmit={envoyer} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
            <F label="Prénom du destinataire" value={form.prenom} set={v => setForm(s => ({ ...s, prenom: v }))} required />
            <F label="Nom du destinataire" value={form.nom} set={v => setForm(s => ({ ...s, nom: v }))} required />
          </div>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)' }}>Adresse e-mail</label>
          <input
            type="email"
            required
            value={form.email}
            onChange={e => setForm(s => ({ ...s, email: e.target.value }))}
            placeholder="ex. medecin@hopital.be"
            style={{ ...inp, margin: '6px 0 10px' }}
          />
          <Btn type="submit" disabled={busy}>{busy ? 'Envoi…' : 'Envoyer le rapport'}</Btn>
        </form>
      )}
      {traces.length > 0 && (
        <section style={{ marginTop: 18 }}>
          <h2 style={{ fontSize: '1.02rem', color: 'var(--heading)', margin: '0 0 8px' }}>Traçabilité des envois</h2>
          <ul style={{ paddingLeft: 18, fontSize: 13.5, margin: 0 }}>
            {traces.map(t => (
              <li key={t.id} style={{ marginBottom: 6 }}>
                {heure(t.envoye_le)} — envoyé par <strong>{libelleExpediteur(t)}</strong>
                {' '}à <strong>{libelleDestinataire(t)}</strong> ({t.email})
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

export { ALERTE_CONFIDENTIALITE }
