import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useI18n } from '../i18n/index.jsx'
import { SepAuto } from '../components/Decor.jsx'
import { notifFormulaire } from '@/lib/notifications'
import { supabase as _sb } from '@/lib/supabase'
import { configEffective } from '@/lib/formulaires'

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
  souhait_description:'', souhait_date:'', souhait_lieu:'', souhait_dates:[''],
  mobilite:'', equipement_medical:'', allergies:'', urgence:false,
  consent_patient:false, consent_rgpd:false,
}

export default function DemandeSouhait() {
  const { raw } = useI18n()
  const lang = raw?.lang || 'fr'
  const L = LABELS[lang] || LABELS.fr
  const STEPS = { fr:STEPS_FR, nl:STEPS_NL, en:STEPS_EN, de:STEPS_DE }[lang] || STEPS_FR

  const [form, setForm]   = useState(INITIAL)
  const [libres, setLibres] = useState({})
  const [cfg, setCfg]     = useState(null)
  const [sending, setSending] = useState(false)
  const [sent, setSent]   = useState(false)
  const [error, setError] = useState('')
  const set = (k,v) => setForm(f=>({...f,[k]:v}))
  const setL = (id,v) => setLibres(l=>({...l,[id]:v}))

  useEffect(() => {
    supabase.from('formulaires_config').select('*').eq('cle','souhait').maybeSingle()
      .then(({ data }) => setCfg(configEffective('souhait', data || {})))
  }, [])

  // Un champ prédéfini est-il actif / requis ?
  const champ = (nom) => cfg?.champs.find(c=>c.nom===nom)
  const actif = (nom) => champ(nom)?.actif ?? true
  const requis = (nom) => champ(nom)?.requis ?? false
  const lbl = (nom, fallback) => (champ(nom)?.label || fallback) + (requis(nom)?' *':'')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!cfg) return
    // Validation des champs prédéfinis requis
    for (const ch of cfg.champs.filter(c=>c.actif && c.requis)) {
      if (!form[ch.nom] || !String(form[ch.nom]).trim()) { setError(L.errorRequired); return }
    }
    // Validation des questions libres requises
    for (const q of cfg.champsLibres.filter(q=>q.requis)) {
      if (!libres[q.id]) { setError(L.errorRequired); return }
    }
    // Consentement obligatoire
    if (!form.consent_patient || !form.consent_rgpd) { setError(L.errorConsent); return }
    setSending(true); setError('')
    const datesValides = (form.souhait_dates || []).filter(Boolean)
    const champs_libres = {}
    cfg.champsLibres.forEach(q => { if (libres[q.id] !== undefined) champs_libres[q.label] = libres[q.id] })
    const { souhait_dates, ...resteForm } = form
    // Les champs vides ('') cassent les colonnes DATE → null
    const reste = Object.fromEntries(Object.entries(resteForm).map(([k,v]) => [k, v === '' ? null : v]))
    const { error:err } = await supabase.from('demandes_souhaits').insert({
      ...reste,
      souhait_date: datesValides[0] || null,
      dates_souhaitees: datesValides,
      champs_libres,
      langue:lang,
    })
    if (!err) {
      notifFormulaire('souhait', cfg.titre || 'Demande de souhait', cfg.destinataires, form.patient_nom || 'Nouvelle demande')
    }
    if (err) { setError(L.errorSend + ' (' + err.message + ')'); setSending(false); return }
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

      {/* Formulaire — page unique */}
      <section style={{ padding:'56px 20px', background:'#FDFAF6' }}>
        <div style={{ maxWidth:720, margin:'0 auto' }}>
          <div style={{ background:'white', border:'1px solid rgba(27,176,206,.12)', borderRadius:18, padding:'2rem', boxShadow:'0 4px 24px rgba(27,176,206,.08)' }}>
            {!cfg ? <p style={{ color:'#7A7470' }}>Chargement…</p> : (
            <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:26 }}>

              {/* Bénéficiaire */}
              <Bloc titre={L.title ? 'Bénéficiaire' : 'Bénéficiaire'}>
                <G2>
                  {actif('patient_prenom') && <F label={lbl('patient_prenom', L.prenom)} val={form.patient_prenom} set={v=>set('patient_prenom',v)}/>}
                  {actif('patient_nom') && <F label={lbl('patient_nom', L.nom)} val={form.patient_nom} set={v=>set('patient_nom',v)}/>}
                </G2>
                {actif('patient_ddn') && <F label={lbl('patient_ddn', L.ddn)} val={form.patient_ddn} set={v=>set('patient_ddn',v)} type="date"/>}
                {actif('etablissement') && <F label={lbl('etablissement', L.etablissement)} val={form.etablissement} set={v=>set('etablissement',v)} placeholder="CHC, GHDC, maison de repos…"/>}
                {actif('medecin_referent') && <F label={lbl('medecin_referent', L.medecin)} val={form.medecin_referent} set={v=>set('medecin_referent',v)} placeholder="Dr. Nom Prénom"/>}
                <CheckF label={L.urgence} val={form.urgence} set={v=>set('urgence',v)} accent />
              </Bloc>

              {/* Contact */}
              <Bloc titre="Contact">
                <G2>
                  {actif('contact_prenom') && <F label={lbl('contact_prenom', L.cPrenom)} val={form.contact_prenom} set={v=>set('contact_prenom',v)}/>}
                  {actif('contact_nom') && <F label={lbl('contact_nom', L.cNom)} val={form.contact_nom} set={v=>set('contact_nom',v)}/>}
                </G2>
                {actif('contact_relation') && <Sel label={lbl('contact_relation', L.relation)} val={form.contact_relation} set={v=>set('contact_relation',v)} options={L.relOptions}/>}
                {actif('contact_email') && <F label={lbl('contact_email', L.email)} val={form.contact_email} set={v=>set('contact_email',v)} type="email"/>}
                {actif('contact_telephone') && <F label={lbl('contact_telephone', L.tel)} val={form.contact_telephone} set={v=>set('contact_telephone',v)} type="tel"/>}
              </Bloc>

              {/* Souhait */}
              <Bloc titre={L.souhait}>
                {actif('souhait_description') && <div>
                  <label style={LBL}>{lbl('souhait_description', L.souhait)}</label>
                  <textarea value={form.souhait_description} onChange={e=>set('souhait_description',e.target.value)} rows={5} placeholder="Décrivez le souhait avec le plus de détails possible…" style={{ width:'100%', padding:'9px 12px', border:'1px solid rgba(0,0,0,.1)', borderRadius:8, fontSize:13.5, fontFamily:"'DM Sans',sans-serif", resize:'vertical' }}/>
                </div>}
                <div>
                  <label style={LBL}>{L.date} <span style={{ color:'#A8A39D', fontWeight:400 }}>(vous pouvez proposer plusieurs dates)</span></label>
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {(form.souhait_dates || ['']).map((d, i) => (
                      <div key={i} style={{ display:'flex', gap:8, alignItems:'center' }}>
                        <input type="date" value={d}
                          onChange={e=>{ const arr=[...(form.souhait_dates||[''])]; arr[i]=e.target.value; set('souhait_dates',arr) }}
                          style={{ flex:1, padding:'9px 12px', border:'1px solid rgba(0,0,0,.1)', borderRadius:8, fontSize:13.5, fontFamily:"'DM Sans',sans-serif" }}/>
                        {(form.souhait_dates||['']).length > 1 && (
                          <button type="button" onClick={()=>{ const arr=(form.souhait_dates||['']).filter((_,j)=>j!==i); set('souhait_dates',arr.length?arr:['']) }}
                            style={{ padding:'8px 11px', background:'#FCEBEB', color:'#C8435A', border:'none', borderRadius:8, fontSize:13, cursor:'pointer' }}>✕</button>
                        )}
                      </div>
                    ))}
                    <button type="button" onClick={()=>set('souhait_dates',[...(form.souhait_dates||['']),''])}
                      style={{ alignSelf:'flex-start', padding:'7px 13px', background:'#E6F7FA', color:'#0E7A93', border:'none', borderRadius:8, fontSize:12.5, fontWeight:600, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
                      + Ajouter une date
                    </button>
                  </div>
                </div>
                {actif('souhait_lieu') && <F label={lbl('souhait_lieu', L.lieu)} val={form.souhait_lieu} set={v=>set('souhait_lieu',v)} placeholder="Mer, Pairi Daiza…"/>}
              </Bloc>

              {/* Médical */}
              {(actif('mobilite') || actif('equipement_medical') || actif('allergies')) && (
                <Bloc titre={L.equipement}>
                  {actif('mobilite') && <Sel label={lbl('mobilite', L.mobilite)} val={form.mobilite} set={v=>set('mobilite',v)} options={L.mobOptions}/>}
                  {actif('equipement_medical') && <div>
                    <label style={LBL}>{lbl('equipement_medical', L.equipement)}</label>
                    <textarea value={form.equipement_medical} onChange={e=>set('equipement_medical',e.target.value)} rows={3} placeholder="Oxygène, chaise roulante, pompe à morphine…" style={{ width:'100%', padding:'9px 12px', border:'1px solid rgba(0,0,0,.1)', borderRadius:8, fontSize:13.5, fontFamily:"'DM Sans',sans-serif", resize:'vertical' }}/>
                  </div>}
                  {actif('allergies') && <F label={lbl('allergies', L.allergies)} val={form.allergies} set={v=>set('allergies',v)} placeholder="Aucune / Pénicilline…"/>}
                </Bloc>
              )}

              {/* Questions personnalisées (config interne) */}
              {cfg.champsLibres.length > 0 && (
                <Bloc titre="Informations complémentaires">
                  {cfg.champsLibres.map(q => (
                    <ChampLibre key={q.id} q={q} val={libres[q.id]||''} set={v=>setL(q.id,v)} />
                  ))}
                </Bloc>
              )}

              {/* Consentement */}
              <Bloc titre={L.recap}>
                <CheckF label={L.consentPatient} val={form.consent_patient} set={v=>set('consent_patient',v)}/>
                <CheckF label={L.consentRgpd} val={form.consent_rgpd} set={v=>set('consent_rgpd',v)}/>
                <div style={{ background:'#E6F7FA', border:'1px solid rgba(27,176,206,.2)', borderRadius:10, padding:'12px 14px', fontSize:12.5, color:'#0E4A5A' }}>
                  🔒 Données traitées de façon confidentielle — RGPD
                </div>
              </Bloc>

              {error && <div style={{ background:'#FEF2F2', border:'1px solid #FCD5D5', borderRadius:8, padding:'9px 12px', fontSize:13, color:'#991B1B' }}>{error}</div>}

              <button type="submit" disabled={sending||!form.consent_patient||!form.consent_rgpd}
                style={{ ...BTN_PRIMARY, padding:'13px', fontSize:14.5, opacity:(!form.consent_patient||!form.consent_rgpd)?.6:1, cursor:sending?'wait':'pointer' }}>
                {sending ? '⏳ Envoi…' : L.envoyer}
              </button>
            </form>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

function Bloc({ titre, children }) {
  return (
    <div>
      <h3 style={{ fontSize:15, fontWeight:600, color:'#0E4A5A', marginBottom:14, paddingBottom:8, borderBottom:'1px solid rgba(27,176,206,.1)' }}>{titre}</h3>
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>{children}</div>
    </div>
  )
}

function ChampLibre({ q, val, set }) {
  const label = q.label + (q.requis?' *':'')
  if (q.type === 'textarea') return <div><label style={LBL}>{label}</label><textarea value={val} onChange={e=>set(e.target.value)} rows={4} style={{ width:'100%', padding:'9px 12px', border:'1px solid rgba(0,0,0,.1)', borderRadius:8, fontSize:13.5, fontFamily:"'DM Sans',sans-serif", resize:'vertical' }}/></div>
  if (q.type === 'select') return <Sel label={label} val={val} set={set} options={q.options||[]}/>
  if (q.type === 'checkbox') return <CheckF label={label} val={!!val} set={set}/>
  return <F label={label} val={val} set={set} type={q.type}/>
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