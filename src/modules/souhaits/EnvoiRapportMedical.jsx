import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, Loading, Flash } from '@/components/ui'
import {
  htmlEmailRapportMedical, texteEmailRapportMedical,
  sujetRapportMedical, ALERTE_CONFIDENTIALITE_MAIL,
} from './rapportMedicalExport.js'
import { envoyerRapportMedical } from '@/lib/envoyerInvitation'
import { injectionsDetresse } from './missionSchema'
import { stupefiantsMission } from './stupefiantsSchema'
import { genererPdfStupefiantsInstitutions, NOM_PDF_STUPS_INSTITUTIONS } from './stupefiantsInstitutionsPdf'
import DestinataireRapportMedical, { preparerDestinataireAvantEnvoi } from './DestinataireRapportMedical'

function bytesToBase64(bytes) {
  let bin = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(bin)
}

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
  const [form, setForm] = useState({ prenom: '', nom: '', email: '', sauverAnnuaire: true })
  const [err, setErr] = useState(null)
  const [info, setInfo] = useState(null)
  const [busy, setBusy] = useState(false)

  const sujet = sujetRapportMedical(souhait)

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

  function payloadMail(dest) {
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
      destinatairePrenom: dest.prenom,
      destinataireNom: dest.nom,
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
    const prep = await preparerDestinataireAvantEnvoi(form)
    if (!prep.ok) { setBusy(false); setErr(prep.error); return }
    const dest = prep.form
    const { html, texte } = payloadMail(dest)
    const pieces = []
    const stups = stupefiantsMission(souhait?.mission)
    if (stups.lignes.length) {
      try {
        const bytes = await genererPdfStupefiantsInstitutions({ souhait, stups })
        pieces.push({ nom_fichier: NOM_PDF_STUPS_INSTITUTIONS, pdf_base64: bytesToBase64(bytes) })
      } catch (e) {
        setBusy(false)
        setErr(`Registre stupéfiants : ${e.message || e}`)
        return
      }
    }
    const res = await envoyerRapportMedical({
      souhaitId,
      email: dest.email,
      destinatairePrenom: dest.prenom,
      destinataireNom: dest.nom,
      sujet,
      html,
      texte,
      pieces,
    })
    setBusy(false)
    if (!res.ok) { setErr(res.error); return }
    const qui = [dest.prenom, dest.nom].filter(Boolean).join(' ')
    setInfo(`Rapport envoyé à ${qui} <${dest.email.trim()}> depuis app@heartsangels.be.`)
    setForm({ prenom: '', nom: '', email: '', sauverAnnuaire: true })
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
      <p style={{ color: '#A32D2D', fontWeight: 800, marginTop: 0 }}>{sujet}</p>
      {err && <Flash kind="err">{err}</Flash>}
      {info && <Flash>{info}</Flash>}
      {!peutExporter ? (
        <Flash kind="warn">Réservé aux volontaires médicaux du souhait (ou à la coordination médicale). Sur un souhait de test, tout volontaire médical peut s’entraîner à l’envoi.</Flash>
      ) : (
        <form onSubmit={envoyer} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 16 }}>
          <DestinataireRapportMedical
            souhaitId={souhaitId}
            souhait={souhait}
            value={form}
            onChange={setForm}
            disabled={busy}
          />
          <Btn type="submit" disabled={busy || !form.email}>{busy ? 'Envoi…' : 'Envoyer le rapport'}</Btn>
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
