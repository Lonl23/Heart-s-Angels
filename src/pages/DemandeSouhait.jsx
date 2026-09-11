import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Logo, PhoneF, AddressFields } from '@/components/ui'
import { GenrePicker } from '@/modules/annuaire/genre'

export default function DemandeSouhait() {
  const [f, setF] = useState({
    patient_prenom:'', patient_nom:'', patient_ddn:'', etablissement:'', medecin_referent:'',
    patient_genre:'', patient_tel_gsm:'', patient_tel_fixe:'', patient_adresse:null,
    contact_prenom:'', contact_nom:'', contact_relation:'', contact_email:'', contact_telephone:'',
    contact_tel_fixe:'', contact_ddn:'', contact_adresse:null,
    souhait_description:'', souhait_date:'', souhait_lieu:'',
    mobilite:'', equipement_medical:'', allergies:'', urgence:false,
    consent_patient:false, consent_rgpd:false,
  })
  const set = (k,v) => setF(s => ({ ...s, [k]:v }))
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState(null)

  async function submit(e) {
    e.preventDefault()
    if (!f.consent_patient || !f.consent_rgpd) { setErr('Merci de cocher les deux consentements.'); return }
    setBusy(true); setErr(null)
    const payload = {
      ...f, source:'externe',
      patient_ddn: f.patient_ddn || null, souhait_date: f.souhait_date || null,
      patient_genre: f.patient_genre || null,
      patient_tel_gsm: f.patient_tel_gsm || null,
      patient_tel_fixe: f.patient_tel_fixe || null,
      patient_adresse: f.patient_adresse || null,
      contact_tel_fixe: f.contact_tel_fixe || null,
      contact_ddn: f.contact_ddn || null,
      contact_adresse: f.contact_adresse || null,
    }
    const { error } = await supabase.from('demandes_souhaits').insert(payload)
    setBusy(false)
    if (error) setErr("Une erreur est survenue. Réessayez plus tard.")
    else setDone(true)
  }

  if (done) return (
    <Wrap>
      <div style={{ textAlign:'center', padding:'20px 0' }}>
        <Logo size={64} style={{ margin:'0 auto 12px' }} />
        <h1 style={{ fontSize:'1.6rem', color:'var(--heading)' }}>Merci pour votre demande</h1>
        <p style={{ color:'var(--text-2)', marginTop:8 }}>Notre équipe la prendra en charge et reviendra vers vous.</p>
      </div>
    </Wrap>
  )

  return (
    <Wrap>
      <Logo size={56} style={{ margin:'0 auto 12px' }} />
      <h1 style={{ fontSize:'1.7rem', color:'var(--heading)', marginBottom:4, textAlign:'center' }}>Demande de souhait</h1>
      <p style={{ color:'var(--text-muted)', fontSize:13.5, marginBottom:20 }}>Formulaire confidentiel — les informations médicales sont réservées à notre équipe.</p>
      <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:14 }}>
        <Section t="Le patient">
          <Row><I l="Prénom *" v={f.patient_prenom} s={v=>set('patient_prenom',v)} req /><I l="Nom *" v={f.patient_nom} s={v=>set('patient_nom',v)} req /></Row>
          <GenrePicker value={f.patient_genre} set={v=>set('patient_genre',v)} />
          <Row><I l="Date de naissance" type="date" v={f.patient_ddn} s={v=>set('patient_ddn',v)} /><I l="Établissement / lieu" v={f.etablissement} s={v=>set('etablissement',v)} /></Row>
          <Row><PhoneF label="GSM" value={f.patient_tel_gsm} set={v=>set('patient_tel_gsm',v)} /><PhoneF label="Fixe" value={f.patient_tel_fixe} set={v=>set('patient_tel_fixe',v)} /></Row>
          <div>
            <label style={lbl}>Adresse légale</label>
            <AddressFields value={f.patient_adresse} set={v=>set('patient_adresse',v)} />
          </div>
          <I l="Médecin référent" v={f.medecin_referent} s={v=>set('medecin_referent',v)} />
        </Section>
        <Section t="Vous (personne de contact)">
          <Row><I l="Prénom *" v={f.contact_prenom} s={v=>set('contact_prenom',v)} req /><I l="Nom *" v={f.contact_nom} s={v=>set('contact_nom',v)} req /></Row>
          <Row><I l="Lien d'affiliation" v={f.contact_relation} s={v=>set('contact_relation',v)} /><I l="Date de naissance" type="date" v={f.contact_ddn} s={v=>set('contact_ddn',v)} /></Row>
          <Row><PhoneF label="GSM" value={f.contact_telephone} set={v=>set('contact_telephone',v)} /><PhoneF label="Fixe" value={f.contact_tel_fixe} set={v=>set('contact_tel_fixe',v)} /></Row>
          <I l="E-mail *" type="email" v={f.contact_email} s={v=>set('contact_email',v)} req />
          <div>
            <label style={lbl}>Adresse légale</label>
            <AddressFields value={f.contact_adresse} set={v=>set('contact_adresse',v)} />
          </div>
        </Section>
        <Section t="Le souhait">
          <T l="Décrivez le souhait *" v={f.souhait_description} s={v=>set('souhait_description',v)} req />
          <Row><I l="Date envisagée" type="date" v={f.souhait_date} s={v=>set('souhait_date',v)} /><I l="Lieu" v={f.souhait_lieu} s={v=>set('souhait_lieu',v)} /></Row>
        </Section>
        <Section t="Informations médicales">
          <I l="Mobilité (autonome, fauteuil, alité…)" v={f.mobilite} s={v=>set('mobilite',v)} />
          <I l="Équipement médical nécessaire" v={f.equipement_medical} s={v=>set('equipement_medical',v)} />
          <I l="Allergies" v={f.allergies} s={v=>set('allergies',v)} />
          <label style={chk}><input type="checkbox" checked={f.urgence} onChange={e=>set('urgence',e.target.checked)} /> Demande urgente</label>
        </Section>
        <label style={chk}><input type="checkbox" checked={f.consent_patient} onChange={e=>set('consent_patient',e.target.checked)} /> Le patient (ou son représentant) consent à cette demande.</label>
        <label style={chk}><input type="checkbox" checked={f.consent_rgpd} onChange={e=>set('consent_rgpd',e.target.checked)} /> J'accepte le traitement de ces données conformément au RGPD.</label>
        {err && <div style={{ color:'#C8435A', fontSize:13 }}>{err}</div>}
        <button type="submit" disabled={busy} style={{ padding:13, background:'var(--accent)', color:'#fff', border:'none', borderRadius:10, fontSize:14, fontWeight:600, cursor:busy?'wait':'pointer' }}>{busy?'Envoi…':'Envoyer la demande'}</button>
      </form>
    </Wrap>
  )
}

function Wrap({ children }) {
  return <div style={{ minHeight:'100vh', background:'var(--bg)', padding:'24px 16px' }}><div style={{ maxWidth:640, margin:'0 auto', background:'var(--card)', border:'1px solid var(--border)', borderRadius:18, padding:'26px 24px' }}>{children}</div></div>
}
function Section({ t, children }) {
  return <div><div style={{ fontSize:13, fontWeight:600, color:'var(--heading)', margin:'6px 0 10px' }}>{t}</div><div style={{ display:'flex', flexDirection:'column', gap:10 }}>{children}</div></div>
}
function Row({ children }) { return <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>{children}</div> }
function I({ l, v, s, type='text', req }) {
  return <div><label style={lbl}>{l}</label><input type={type} value={v} onChange={e=>s(e.target.value)} required={req} style={inp} /></div>
}
function T({ l, v, s, req }) {
  return <div><label style={lbl}>{l}</label><textarea value={v} onChange={e=>s(e.target.value)} required={req} rows={3} style={{ ...inp, resize:'vertical' }} /></div>
}
const lbl = { fontSize:12.5, color:'var(--text-muted)', display:'block', marginBottom:5 }
const inp = { width:'100%', padding:'10px 12px', border:'1px solid var(--border)', borderRadius:9, fontSize:13.5, background:'var(--surface)', color:'var(--text)', boxSizing:'border-box' }
const chk = { display:'flex', gap:8, alignItems:'flex-start', fontSize:13, color:'var(--text-2)', cursor:'pointer' }
