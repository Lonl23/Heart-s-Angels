import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useI18n } from '../i18n/index.jsx'
import { SepAuto } from '../components/Decor.jsx'

const STEPS_FR = ['Patient', 'Contact', 'Souhait', 'Médical', 'Consentement']
const STEPS_NL = ['Patiënt', 'Contact', 'Wens', 'Medisch', 'Toestemming']
const STEPS_EN = ['Patient', 'Contact', 'Wish', 'Medical', 'Consent']
const STEPS_DE = ['Patient', 'Kontakt', 'Wunsch', 'Medizinisch', 'Einwilligung']

const LABELS = {
  fr: {
    title: 'Formulaire de demande de souhait',
    intro: 'Pour réaliser votre souhait, veuillez remplir ce formulaire. Nous vous recontacterons dans les meilleurs délais.',
    prenom: 'Prénom', nom: 'Nom', ddn: 'Date de naissance', etablissement: 'Établissement',
    medecin: 'Médecin référent', cPrenom: 'Prénom du contact', cNom: 'Nom du contact',
    relation: 'Relation avec le patient', email: 'Email', tel: 'Téléphone',
    souhait: 'Description du souhait', date: 'Date souhaitée', lieu: 'Lieu / Destination',
    mobilite: 'Mobilité', equipement: 'Équipement médical', allergies: 'Allergies',
    urgence: '⚠️ Demande urgente', consentPatient: 'Je confirme avoir l\'accord du patient ou de son représentant légal pour soumettre cette demande.',
    consentRgpd: 'J\'accepte que mes données soient traitées conformément à la politique de confidentialité de Heart\'s Angels ASBL (RGPD).',
    suivant: 'Suivant →', precedent: '← Précédent', envoyer: '❤️ Envoyer la demande',
    successTitle: 'Demande envoyée !', successDesc: 'Nous avons bien reçu votre demande et vous contacterons prochainement.',
    errorConsent: 'Veuillez accepter les deux cases de consentement.', errorRequired: 'Veuillez remplir les champs obligatoires (*).', errorSend: 'Erreur lors de l\'envoi. Réessayez.',
    recap: 'Récapitulatif',
    mobOptions: ['Autonome', 'Fauteuil roulant', 'Brancard', 'Lit médicalisé'],
    relOptions: ['Conjoint(e)', 'Enfant', 'Parent', 'Frère/Sœur', 'Ami(e)', 'Soignant(e)', 'Autre'],
  },
  nl: {
    title: 'Wensaanvraagformulier',
    intro: 'Vul dit formulier in om uw wens te realiseren. We nemen snel contact met u op.',
    prenom: 'Voornaam', nom: 'Naam', ddn: 'Geboortedatum', etablissement: 'Instelling',
    medecin: 'Behandelend arts', cPrenom: 'Voornaam contact', cNom: 'Naam contact',
    relation: 'Relatie met de patiënt', email: 'E-mail', tel: 'Telefoon',
    souhait: 'Beschrijving van de wens', date: 'Gewenste datum', lieu: 'Locatie / Bestemming',
    mobilite: 'Mobiliteit', equipement: 'Medische uitrusting', allergies: 'Allergieën',
    urgence: '⚠️ Dringende aanvraag', consentPatient: 'Ik bevestig de toestemming van de patiënt of zijn wettelijk vertegenwoordiger.',
    consentRgpd: 'Ik ga akkoord met de verwerking van mijn gegevens (AVG).',
    suivant: 'Volgende →', precedent: '← Vorige', envoyer: '❤️ Aanvraag verzenden',
    successTitle: 'Aanvraag verzonden!', successDesc: 'We hebben uw aanvraag ontvangen en nemen binnenkort contact op.',
    errorConsent: 'Gelieve beide toestemmingen aan te vinken.', errorRequired: 'Vul alle verplichte velden in (*).', errorSend: 'Fout bij verzenden. Probeer opnieuw.',
    recap: 'Samenvatting',
    mobOptions: ['Zelfstandig', 'Rolstoel', 'Brancard', 'Medisch bed'],
    relOptions: ['Partner', 'Kind', 'Ouder', 'Broer/Zus', 'Vriend(in)', 'Zorgverlener', 'Andere'],
  },
  en: {
    title: 'Wish request form',
    intro: 'To fulfil your wish, please fill in this form. We will contact you shortly.',
    prenom: 'First name', nom: 'Last name', ddn: 'Date of birth', etablissement: 'Medical facility',
    medecin: 'Referring doctor', cPrenom: 'Contact first name', cNom: 'Contact last name',
    relation: 'Relationship with patient', email: 'Email', tel: 'Phone',
    souhait: 'Wish description', date: 'Desired date', lieu: 'Location / Destination',
    mobilite: 'Mobility', equipement: 'Medical equipment', allergies: 'Allergies',
    urgence: '⚠️ Urgent request', consentPatient: 'I confirm I have the patient\'s or legal representative\'s consent for this request.',
    consentRgpd: 'I agree to my data being processed in accordance with Heart\'s Angels ASBL\'s privacy policy (GDPR).',
    suivant: 'Next →', precedent: '← Previous', envoyer: '❤️ Send request',
    successTitle: 'Request sent!', successDesc: 'We have received your request and will contact you shortly.',
    errorConsent: 'Please accept both consent boxes.', errorRequired: 'Please fill in all required fields (*).', errorSend: 'Send error. Please try again.',
    recap: 'Summary',
    mobOptions: ['Autonomous', 'Wheelchair', 'Stretcher', 'Medical bed'],
    relOptions: ['Spouse', 'Child', 'Parent', 'Sibling', 'Friend', 'Caregiver', 'Other'],
  },
  de: {
    title: 'Wunschantragsformular',
    intro: 'Füllen Sie dieses Formular aus, um Ihren Wunsch zu erfüllen. Wir melden uns bald bei Ihnen.',
    prenom: 'Vorname', nom: 'Nachname', ddn: 'Geburtsdatum', etablissement: 'Einrichtung',
    medecin: 'Behandelnder Arzt', cPrenom: 'Vorname Kontakt', cNom: 'Nachname Kontakt',
    relation: 'Beziehung zum Patienten', email: 'E-Mail', tel: 'Telefon',
    souhait: 'Beschreibung des Wunsches', date: 'Gewünschtes Datum', lieu: 'Ort / Ziel',
    mobilite: 'Mobilität', equipement: 'Medizinische Ausrüstung', allergies: 'Allergien',
    urgence: '⚠️ Dringender Antrag', consentPatient: 'Ich bestätige die Zustimmung des Patienten oder seines gesetzlichen Vertreters.',
    consentRgpd: 'Ich stimme der Verarbeitung meiner Daten zu (DSGVO).',
    suivant: 'Weiter →', precedent: '← Zurück', envoyer: '❤️ Antrag senden',
    successTitle: 'Antrag gesendet!', successDesc: 'Wir haben Ihren Antrag erhalten und melden uns bald.',
    errorConsent: 'Bitte beide Einwilligungen bestätigen.', errorRequired: 'Bitte alle Pflichtfelder ausfüllen (*).', errorSend: 'Fehler beim Senden. Bitte erneut versuchen.',
    recap: 'Zusammenfassung',
    mobOptions: ['Selbstständig', 'Rollstuhl', 'Trage', 'Krankenbett'],
    relOptions: ['Partner(in)', 'Kind', 'Elternteil', 'Geschwister', 'Freund(in)', 'Pflegeperson', 'Andere'],
  },
}

const INITIAL = {
  patient_prenom:'', patient_nom:'', patient_ddn:'', etablissement:'', medecin_referent:'',
  contact_prenom:'', contact_nom:'', contact_relation:'', contact_email:'', contact_telephone:'',
  souhait_description:'', souhait_date:'', souhait_lieu:'',
  mobilite:'', equipement_medical:'', allergies:'', urgence:false,
  consent_patient:false, consent_rgpd:false,
}

export default function DemandeSouhait() {
  const { raw } = useI18n()
  const lang = raw?.lang || 'fr'
  const L = LABELS[lang] || LABELS.fr
  const STEPS = { fr:STEPS_FR, nl:STEPS_NL, en:STEPS_EN, de:STEPS_DE }[lang] || STEPS_FR

  const [form, setForm]   = useState(INITIAL)
  const [step, setStep]   = useState(1)
  const [sending, setSending] = useState(false)
  const [sent, setSent]   = useState(false)
  const [error, setError] = useState('')
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  function validateStep(s) {
    if (s===1) return form.patient_prenom.trim() && form.patient_nom.trim()
    if (s===2) return form.contact_prenom.trim() && form.contact_nom.trim() && form.contact_email.trim()
    if (s===3) return form.souhait_description.trim().length > 10
    return true
  }

  function next() {
    if (!validateStep(step)) { setError(L.errorRequired); return }
    setError(''); setStep(s=>s+1)
    window.scrollTo({ top:0, behavior:'smooth' })
  }
  function prev() { setStep(s=>s-1); setError('') }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.consent_patient || !form.consent_rgpd) { setError(L.errorConsent); return }
    setSending(true); setError('')
    const { error:err } = await supabase.from('demandes_souhaits').insert({ ...form, langue:lang })
    if (err) { setError(L.errorSend); setSending(false); return }
    setSent(true); setSending(false)
  }

  if (sent) return (
    <div style={{ minHeight:'70vh', display:'flex', alignItems:'center', justifyContent:'center', padding:40, fontFamily:"'DM Sans',sans-serif", background:'#FDFAF6' }}>
      <div style={{ maxWidth:520, textAlign:'center' }}>
        <div style={{ fontSize:'4rem', marginBottom:18 }}>💌</div>
        <h2 style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:'2rem', fontWeight:500, color:'#1A1514', marginBottom:12 }}>{L.successTitle}</h2>
        <p style={{ fontSize:15, color:'#4A4340', lineHeight:1.75, marginBottom:28 }}>{L.successDesc}</p>
        <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap' }}>
          <Link to="/" style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'11px 22px', background:'#1BB0CE', color:'white', textDecoration:'none', borderRadius:10, fontSize:14, fontWeight:600 }}>← Retour à l'accueil</Link>
          <Link to="/nous-soutenir" style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'11px 20px', background:'#E6F7FA', color:'#1BB0CE', textDecoration:'none', borderRadius:10, fontSize:14, fontWeight:500 }}>💝 Nous soutenir</Link>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ fontFamily:"'DM Sans',sans-serif" }}>
      <style>{CSS}</style>

      {/* Hero */}
      <section className="ds-hero">
        <div className="ds-hero-inner">
          <div className="ds-tag">❤️ Demande de souhait</div>
          <h1 className="ds-h1">{L.title}</h1>
          <p style={{ fontSize:15, color:'rgba(255,255,255,.75)', maxWidth:580, lineHeight:1.75 }}>{L.intro}</p>
        </div>
      </section>

      {/* vague hero → contenu */}
      <SepAuto haut="#0E4A5A" bas="#FDFAF6" />

      {/* Formulaire */}
      <section style={{ padding:'56px 20px', background:'#FDFAF6' }}>
        <div style={{ maxWidth:720, margin:'0 auto' }}>

          {/* Stepper */}
          <div style={{ display:'flex', gap:0, marginBottom:36, position:'relative' }}>
            <div style={{ position:'absolute', top:18, left:'10%', right:'10%', height:2, background:'#E6F7FA', zIndex:0 }} />
            <div style={{ position:'absolute', top:18, left:'10%', height:2, background:'#1BB0CE', zIndex:0, width:`${((step-1)/4)*80}%`, transition:'width .3s' }} />
            {STEPS.map((label,i)=>(
              <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:7, position:'relative', zIndex:1 }}>
                <div style={{ width:36, height:36, borderRadius:'50%', background: step>i+1 ? '#1BB0CE' : step===i+1 ? '#1BB0CE' : 'white', border:`2px solid ${step>=i+1 ? '#1BB0CE' : '#E6F7FA'}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize: step>i+1 ? 16 : 13, fontWeight:600, color: step>=i+1 ? 'white' : '#A8A39D', transition:'all .25s' }}>
                  {step>i+1 ? '✓' : i+1}
                </div>
                <span style={{ fontSize:10.5, color: step===i+1 ? '#1BB0CE' : '#A8A39D', fontWeight: step===i+1 ? 600 : 400, textAlign:'center', lineHeight:1.3 }}>{label}</span>
              </div>
            ))}
          </div>

          {/* Carte */}
          <div style={{ background:'white', border:'1px solid rgba(27,176,206,.12)', borderRadius:18, padding:'2rem', boxShadow:'0 4px 24px rgba(27,176,206,.08)' }}>
            <h3 style={{ fontSize:16, fontWeight:600, color:'#1A1514', marginBottom:22 }}>{STEPS[step-1]}</h3>
            <form onSubmit={handleSubmit}>
              {/* Étape 1 — Patient */}
              {step===1 && <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <G2><F label={`${L.prenom} *`} val={form.patient_prenom} set={v=>set('patient_prenom',v)}/><F label={`${L.nom} *`} val={form.patient_nom} set={v=>set('patient_nom',v)}/></G2>
                <F label={L.ddn} val={form.patient_ddn} set={v=>set('patient_ddn',v)} type="date"/>
                <F label={L.etablissement} val={form.etablissement} set={v=>set('etablissement',v)} placeholder="CHC, GHDC, maison de repos…"/>
                <F label={L.medecin} val={form.medecin_referent} set={v=>set('medecin_referent',v)} placeholder="Dr. Nom Prénom"/>
                <CheckF label={L.urgence} val={form.urgence} set={v=>set('urgence',v)} accent />
              </div>}

              {/* Étape 2 — Contact */}
              {step===2 && <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <G2><F label={`${L.cPrenom} *`} val={form.contact_prenom} set={v=>set('contact_prenom',v)}/><F label={`${L.cNom} *`} val={form.contact_nom} set={v=>set('contact_nom',v)}/></G2>
                <Sel label={L.relation} val={form.contact_relation} set={v=>set('contact_relation',v)} options={L.relOptions}/>
                <F label={`${L.email} *`} val={form.contact_email} set={v=>set('contact_email',v)} type="email"/>
                <F label={L.tel} val={form.contact_telephone} set={v=>set('contact_telephone',v)} type="tel"/>
              </div>}

              {/* Étape 3 — Souhait */}
              {step===3 && <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <div>
                  <label style={LBL}>{L.souhait} *</label>
                  <textarea value={form.souhait_description} onChange={e=>set('souhait_description',e.target.value)} rows={5} placeholder="Décrivez le souhait avec le plus de détails possible…" style={{ width:'100%', padding:'9px 12px', border:'1px solid rgba(0,0,0,.1)', borderRadius:8, fontSize:13.5, fontFamily:"'DM Sans',sans-serif", resize:'vertical' }}/>
                </div>
                <G2>
                  <F label={L.date} val={form.souhait_date} set={v=>set('souhait_date',v)} type="date"/>
                  <F label={L.lieu} val={form.souhait_lieu} set={v=>set('souhait_lieu',v)} placeholder="Mer, Pairi Daiza…"/>
                </G2>
              </div>}

              {/* Étape 4 — Médical */}
              {step===4 && <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <Sel label={L.mobilite} val={form.mobilite} set={v=>set('mobilite',v)} options={L.mobOptions}/>
                <div>
                  <label style={LBL}>{L.equipement}</label>
                  <textarea value={form.equipement_medical} onChange={e=>set('equipement_medical',e.target.value)} rows={3} placeholder="Oxygène, chaise roulante, pompe à morphine…" style={{ width:'100%', padding:'9px 12px', border:'1px solid rgba(0,0,0,.1)', borderRadius:8, fontSize:13.5, fontFamily:"'DM Sans',sans-serif", resize:'vertical' }}/>
                </div>
                <F label={L.allergies} val={form.allergies} set={v=>set('allergies',v)} placeholder="Aucune / Pénicilline…"/>
              </div>}

              {/* Étape 5 — Consentement */}
              {step===5 && <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                <div style={{ background:'#F0F9FB', borderRadius:12, padding:'14px 16px', fontSize:13.5, color:'#0E4A5A', lineHeight:1.7 }}>
                  <strong>{L.recap} :</strong><br/>
                  Patient : <strong>{form.patient_prenom} {form.patient_nom}</strong><br/>
                  Contact : <strong>{form.contact_email}</strong><br/>
                  Souhait : <strong>{form.souhait_description.slice(0,80)}{form.souhait_description.length>80?'…':''}</strong>
                  {form.urgence && <><br/><span style={{ color:'#C8435A', fontWeight:600 }}>⚠️ Demande urgente</span></>}
                </div>
                <CheckF label={L.consentPatient} val={form.consent_patient} set={v=>set('consent_patient',v)}/>
                <CheckF label={L.consentRgpd} val={form.consent_rgpd} set={v=>set('consent_rgpd',v)}/>
                <div style={{ background:'#E6F7FA', border:'1px solid rgba(27,176,206,.2)', borderRadius:10, padding:'12px 14px', fontSize:12.5, color:'#0E4A5A' }}>
                  🔒 Données traitées de façon confidentielle — RGPD — Hébergement EU (Frankfurt)
                </div>
              </div>}

              {/* Erreur */}
              {error && <div style={{ background:'#FEF2F2', border:'1px solid #FCD5D5', borderRadius:8, padding:'9px 12px', fontSize:13, color:'#991B1B', marginTop:14 }}>{error}</div>}

              {/* Navigation */}
              <div style={{ display:'flex', gap:10, justifyContent:'space-between', marginTop:24, paddingTop:18, borderTop:'1px solid rgba(27,176,206,.08)' }}>
                <div>
                  {step>1 && <button type="button" onClick={prev} style={BTN_GHOST}>{L.precedent}</button>}
                </div>
                <div>
                  {step<5
                    ? <button type="button" onClick={next} style={BTN_PRIMARY}>{L.suivant}</button>
                    : <button type="submit" disabled={sending||!form.consent_patient||!form.consent_rgpd} style={{ ...BTN_PRIMARY, opacity:(!form.consent_patient||!form.consent_rgpd)?.6:1, cursor:sending?'wait':'pointer' }}>
                        {sending ? '⏳ Envoi…' : L.envoyer}
                      </button>
                  }
                </div>
              </div>
            </form>
          </div>
        </div>
      </section>
    </div>
  )
}

const LBL = { fontSize:'12.5px', fontWeight:500, color:'#7A7470', display:'block', marginBottom:5 }
const BTN_PRIMARY = { padding:'10px 24px', background:'#1BB0CE', color:'white', border:'none', borderRadius:9, fontSize:13.5, fontWeight:600, cursor:'pointer', fontFamily:"'DM Sans',sans-serif", boxShadow:'0 2px 10px rgba(27,176,206,.3)' }
const BTN_GHOST   = { padding:'10px 20px', background:'none', border:'1px solid rgba(27,176,206,.2)', borderRadius:9, fontSize:13.5, color:'#7A7470', cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }

function G2({ children }) { return <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>{children}</div> }
function F({ label, val, set, type='text', placeholder }) {
  return <div><label style={LBL}>{label}</label><input type={type} value={val} onChange={e=>set(e.target.value)} placeholder={placeholder} style={{ width:'100%', padding:'9px 12px', border:'1px solid rgba(0,0,0,.1)', borderRadius:8, fontSize:13.5, fontFamily:"'DM Sans',sans-serif", transition:'border-color .12s' }} onFocus={e=>e.target.style.borderColor='#1BB0CE'} onBlur={e=>e.target.style.borderColor='rgba(0,0,0,.1)'}/></div>
}
function Sel({ label, val, set, options }) {
  return <div><label style={LBL}>{label}</label><select value={val} onChange={e=>set(e.target.value)} style={{ width:'100%', padding:'9px 12px', border:'1px solid rgba(0,0,0,.1)', borderRadius:8, fontSize:13.5, fontFamily:"'DM Sans',sans-serif" }}><option value="">— Sélectionner</option>{options.map((o,i)=><option key={i} value={o}>{o}</option>)}</select></div>
}
function CheckF({ label, val, set, accent }) {
  return <label style={{ display:'flex', alignItems:'flex-start', gap:10, cursor:'pointer', padding:'10px 12px', borderRadius:9, background: accent&&val ? '#E6F7FA' : 'transparent', border:`1px solid ${accent ? 'rgba(27,176,206,.2)' : 'transparent'}`, transition:'all .12s' }}>
    <input type="checkbox" checked={val} onChange={e=>set(e.target.checked)} style={{ width:16, height:16, marginTop:2, accentColor:'#1BB0CE', flexShrink:0 }}/>
    <span style={{ fontSize:13.5, color:'#4A4340', lineHeight:1.55 }}>{label}</span>
  </label>
}

const CSS = `
.ds-hero{background:linear-gradient(135deg,#0A1E2D,#0E4A5A);padding:72px 20px;position:relative;overflow:hidden;}
.ds-hero::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 60% 60% at 80% 50%,rgba(27,176,206,.15),transparent);pointer-events:none;}
.ds-hero-inner{position:relative;z-index:1;max-width:1280px;margin:0 auto;}
.ds-tag{display:inline-flex;background:rgba(27,176,206,.25);border:1px solid rgba(27,176,206,.4);border-radius:99px;padding:5px 14px;font-size:11.5px;font-weight:500;color:#7DE4F5;letter-spacing:.04em;text-transform:uppercase;margin-bottom:18px;}
.ds-h1{font-family:'Cormorant Garamond',Georgia,serif;font-size:clamp(2rem,4vw,3.2rem);font-weight:500;color:white;line-height:1.15;margin-bottom:14px;}
@media(max-width:600px){[style*='grid-template-columns: 1fr 1fr']{grid-template-columns:1fr !important;}}
`