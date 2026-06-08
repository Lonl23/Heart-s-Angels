import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../i18n/index.jsx'
import { supabase } from '@/lib/supabase'
import { SepAuto } from '../components/Decor.jsx'
import { useSiteImage } from '@/lib/siteConfig'
import { notifFormulaire } from '@/lib/notifications'
import { supabase as _sb } from '@/lib/supabase'

const L = {
  fr: {
    title: "Devenir bénévole", tag: "🙋 Bénévolat",
    intro: "Rejoindre notre ASBL, c'est accepter de vivre des moments d'une intensité rare. En tant que bénévole, vous n'offrez pas seulement de votre temps — vous offrez de l'humanité, de l'écoute et l'espoir d'un dernier souvenir heureux.",
    formTitle: "Formulaire de candidature",
    prenom:'Prénom *', nom:'Nom *', email:'Email *', tel:'Téléphone',
    type:'Type de bénévolat *', qual:'Qualification / Diplôme', motiv:'Motivation',
    motivHint:'Pourquoi souhaitez-vous rejoindre Heart\'s Angels ?',
    consent:'J\'accepte que mes données soient utilisées dans le cadre de ma candidature (RGPD)',
    submit:'Envoyer ma candidature', sending:'Envoi…',
    successTitle:'Candidature envoyée !', successDesc:'Nous vous recontacterons prochainement.',
    errRequired:'Veuillez remplir tous les champs obligatoires (*).', errConsent:'Veuillez accepter la politique RGPD.', errSend:'Erreur. Veuillez réessayer.',
    types: [
      { icon:'🏥', title:'Bénévole médical', desc:'Médecin, infirmier, ambulancier, kinésithérapeute, psychologue — accompagnement médical lors des souhaits.', reqs:['Diplôme médical ou paramédical','Formation soins palliatifs (ou volonté de se former)','Disponibilité lors des sorties'] },
      { icon:'🤝', title:'Bénévole non-médical', desc:'Logistique, communication, événements, administration — tous les profils sont bienvenus !', reqs:['Motivation et bienveillance','Disponibilité variable','Aucune formation médicale requise'] },
    ],
    typeOptions:['Bénévole médical','Bénévole non-médical','Les deux / Je ne sais pas encore'],
  },
  nl: {
    title: "Word vrijwilliger", tag: "🙋 Vrijwilligerswerk",
    intro: "Bij onze VZW aansluiten betekent instemmen met intense momenten. Als vrijwilliger biedt u niet alleen uw tijd aan — u biedt menselijkheid, aandacht en de hoop op een laatste gelukkige herinnering.",
    formTitle: "Kandidatuurformulier",
    prenom:'Voornaam *', nom:'Naam *', email:'E-mail *', tel:'Telefoon',
    type:'Type vrijwilligerswerk *', qual:'Kwalificatie / Diploma', motiv:'Motivatie',
    motivHint:'Waarom wil je Heart\'s Angels vervoegen?',
    consent:'Ik ga akkoord met het gebruik van mijn gegevens (AVG)',
    submit:'Mijn kandidatuur indienen', sending:'Bezig…',
    successTitle:'Kandidatuur ontvangen!', successDesc:'We nemen binnenkort contact met u op.',
    errRequired:'Vul alle verplichte velden in (*).', errConsent:'Gelieve de privacyverklaring te aanvaarden.', errSend:'Fout. Probeer opnieuw.',
    types:[
      { icon:'🏥', title:'Medische vrijwilliger', desc:'Arts, verpleegkundige, ambulancier, kinesitherapeut, psycholoog.', reqs:['Medisch of paramedisch diploma','Opleiding palliatieve zorg (of bereidheid)','Beschikbaarheid bij uitstappen'] },
      { icon:'🤝', title:'Niet-medische vrijwilliger', desc:'Logistiek, communicatie, evenementen, administratie.', reqs:['Motivatie en vriendelijkheid','Variabele beschikbaarheid','Geen medische opleiding vereist'] },
    ],
    typeOptions:['Medische vrijwilliger','Niet-medische vrijwilliger','Beide / Weet nog niet'],
  },
  en: {
    title: "Become a volunteer", tag: "🙋 Volunteering",
    intro: "Joining our NGO means accepting to experience moments of rare intensity. As a volunteer, you don't just give your time — you offer humanity, listening and the hope of a final happy memory.",
    formTitle: "Application form",
    prenom:'First name *', nom:'Last name *', email:'Email *', tel:'Phone',
    type:'Type of volunteering *', qual:'Qualification / Diploma', motiv:'Motivation',
    motivHint:'Why do you want to join Heart\'s Angels?',
    consent:'I agree to my data being used for my application (GDPR)',
    submit:'Submit my application', sending:'Sending…',
    successTitle:'Application sent!', successDesc:'We will contact you soon.',
    errRequired:'Please fill in all required fields (*).', errConsent:'Please accept the GDPR policy.', errSend:'Error. Please try again.',
    types:[
      { icon:'🏥', title:'Medical volunteer', desc:'Doctor, nurse, paramedic, physiotherapist, psychologist.', reqs:['Medical or paramedical degree','Palliative care training (or willingness)','Availability for outings'] },
      { icon:'🤝', title:'Non-medical volunteer', desc:'Logistics, communication, events, administration.', reqs:['Motivation and kindness','Variable availability','No medical training required'] },
    ],
    typeOptions:['Medical volunteer','Non-medical volunteer','Both / Not sure yet'],
  },
  de: {
    title: "Freiwilliger werden", tag: "🙋 Ehrenamt",
    intro: "Unserer VZW beizutreten bedeutet, intensive Momente zu erleben. Als Freiwilliger bieten Sie nicht nur Ihre Zeit an — Sie bieten Menschlichkeit, Zuhören und die Hoffnung auf eine letzte glückliche Erinnerung.",
    formTitle: "Bewerbungsformular",
    prenom:'Vorname *', nom:'Nachname *', email:'E-Mail *', tel:'Telefon',
    type:'Art des Ehrenamts *', qual:'Qualifikation / Diplom', motiv:'Motivation',
    motivHint:'Warum möchten Sie Heart\'s Angels beitreten?',
    consent:'Ich stimme der Nutzung meiner Daten zu (DSGVO)',
    submit:'Bewerbung einreichen', sending:'Wird gesendet…',
    successTitle:'Bewerbung gesendet!', successDesc:'Wir melden uns bald bei Ihnen.',
    errRequired:'Bitte alle Pflichtfelder ausfüllen (*).', errConsent:'Bitte die Datenschutzerklärung akzeptieren.', errSend:'Fehler. Bitte erneut versuchen.',
    types:[
      { icon:'🏥', title:'Medizinischer Freiwilliger', desc:'Arzt, Krankenpfleger, Sanitäter, Physiotherapeut, Psychologe.', reqs:['Medizinisches oder paramedizinisches Diplom','Palliativpflegeausbildung (oder Bereitschaft)','Verfügbarkeit bei Ausflügen'] },
      { icon:'🤝', title:'Nicht-medizinischer Freiwilliger', desc:'Logistik, Kommunikation, Veranstaltungen, Verwaltung.', reqs:['Motivation und Freundlichkeit','Variable Verfügbarkeit','Keine medizinische Ausbildung erforderlich'] },
    ],
    typeOptions:['Medizinischer Freiwilliger','Nicht-medizinischer Freiwilliger','Beide / Noch nicht sicher'],
  },
}

const IMG = {
  equipe: 'https://www.heartsangels.be/wp-content/uploads/2024/06/448340450_848408590653269_3974634456659016404_n.jpg',
  ludovic:'https://www.heartsangels.be/wp-content/uploads/2023/06/ludovic_whenham-1.jpg',
  carine: 'https://www.heartsangels.be/wp-content/uploads/2023/06/carine_carlier-1.jpg',
}

export default function DevenirBenevole() {
  const { raw } = useI18n()
  const heroImg = useSiteImage('hero_benevole', null)
  const lang = raw?.lang || 'fr'
  const t = L[lang] || L.fr

  const [form, setForm] = useState({ prenom:'', nom:'', email:'', telephone:'', type:'', qualification:'', motivation:'', consent_rgpd:false })
  const [sending, setSending] = useState(false)
  const [sent, setSent]       = useState(false)
  const [error, setError]     = useState('')
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.prenom||!form.nom||!form.email||!form.type) { setError(t.errRequired); return }
    if (!form.consent_rgpd) { setError(t.errConsent); return }
    setSending(true); setError('')
    const { error:err } = await supabase.from('candidatures_benevoles').insert({ ...form, langue:lang })
    if (!err) {
      const { data:_cfg } = await _sb.from('formulaires_config').select('titre,destinataires').eq('cle','benevole').maybeSingle()
      notifFormulaire('benevole', _cfg?.titre || 'Candidature bénévole', _cfg?.destinataires || ['coord_benevoles'], `${form.prenom||''} ${form.nom||''}`.trim())
    }
    if (err) { setError(t.errSend); setSending(false); return }
    setSent(true); setSending(false)
  }

  if (sent) return (
    <div style={{ minHeight:'60vh', display:'flex', alignItems:'center', justifyContent:'center', padding:40, fontFamily:"'DM Sans',sans-serif", background:'#FDFAF6' }}>
      <div style={{ maxWidth:480, textAlign:'center' }}>
        <div style={{ fontSize:'4rem', marginBottom:18 }}>🎉</div>
        <h2 style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:'2rem', fontWeight:500, color:'#1A1514', marginBottom:12 }}>{t.successTitle}</h2>
        <p style={{ fontSize:15, color:'#4A4340', lineHeight:1.75, marginBottom:28 }}>{t.successDesc}</p>
        <Link to="/" style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'11px 22px', background:'#1BB0CE', color:'white', textDecoration:'none', borderRadius:10, fontSize:14, fontWeight:600 }}>← Retour à l'accueil</Link>
      </div>
    </div>
  )

  return (
    <div style={{ fontFamily:"'DM Sans',sans-serif" }}>
      <style>{CSS}</style>

      {/* Hero */}
      <section className="db-hero" style={{ '--hero-bg': heroImg ? `url(${heroImg})` : 'none' }}>
        <div className="db-hero-bg" />
        <div className="db-hero-inner">
          <div className="db-tag">{t.tag}</div>
          <h1 className="db-h1">{t.title}</h1>
          <p className="db-p-hero">{t.intro}</p>
        </div>
      </section>

      {/* vague hero → contenu */}
      <SepAuto haut="#0E4A5A" bas="#FDFAF6" />

      {/* 2 types de bénévolat */}
      <section style={{ padding:'64px 20px', background:'#FDFAF6' }}>
        <div style={{ maxWidth:1280, margin:'0 auto' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:48 }}>
            {t.types.map((tp,i) => (
              <div key={i} style={{ background: i===0 ? '#E6F7FA' : '#EAF3DE', borderRadius:16, padding:'24px', border:`1px solid ${i===0?'rgba(27,176,206,.2)':'rgba(59,109,17,.15)'}` }}>
                <div style={{ fontSize:'2.5rem', marginBottom:12 }}>{tp.icon}</div>
                <div style={{ fontSize:16, fontWeight:600, color:i===0?'#0E4A5A':'#2D5211', marginBottom:8 }}>{tp.title}</div>
                <p style={{ fontSize:13.5, color:'#4A4340', lineHeight:1.65, marginBottom:14 }}>{tp.desc}</p>
                <ul style={{ margin:0, padding:0, listStyle:'none', display:'flex', flexDirection:'column', gap:6 }}>
                  {tp.reqs.map((r,j)=>(
                    <li key={j} style={{ display:'flex', alignItems:'flex-start', gap:8, fontSize:13, color:i===0?'#0E7A93':'#3B6D11' }}>
                      <span style={{ flexShrink:0, marginTop:1 }}>✓</span>{r}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Formulaire + Citation */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1.2fr', gap:52, alignItems:'start' }}>
            {/* Info */}
            <div>
              <div style={{ display:'inline-flex', background:'#E6F7FA', color:'#1BB0CE', borderRadius:99, padding:'4px 12px', fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:14 }}>Témoignage</div>
              <blockquote style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:'1.2rem', fontStyle:'italic', color:'#0E4A5A', lineHeight:1.7, marginBottom:24, borderLeft:'3px solid #1BB0CE', paddingLeft:18 }}>
                « Rejoindre Heart's Angels, c'est accepter de vivre des moments d'une intensité rare. »
              </blockquote>
              <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:24 }}>
                <img src={IMG.ludovic} alt="Ludovic Whenham" style={{ width:52, height:52, borderRadius:'50%', objectFit:'cover', border:'2px solid #E6F7FA' }} />
                <div>
                  <div style={{ fontSize:14, fontWeight:600, color:'#1A1514' }}>Ludovic Whenham</div>
                  <div style={{ fontSize:12.5, color:'#7A7470' }}>Président, Infirmier en soins palliatifs</div>
                </div>
              </div>
              <img src={IMG.equipe} alt="Équipe Heart's Angels" style={{ width:'100%', borderRadius:14, objectFit:'cover', maxHeight:220 }} loading="lazy" />
            </div>

            {/* Formulaire */}
            <div style={{ background:'white', border:'1px solid rgba(27,176,206,.12)', borderRadius:18, padding:'2rem', boxShadow:'0 4px 24px rgba(27,176,206,.08)' }}>
              <h3 style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:'1.4rem', fontWeight:500, color:'#1A1514', marginBottom:20 }}>{t.formTitle}</h3>
              <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <G2><F label={t.prenom} val={form.prenom} set={v=>set('prenom',v)}/><F label={t.nom} val={form.nom} set={v=>set('nom',v)}/></G2>
                <F label={t.email} val={form.email} set={v=>set('email',v)} type="email"/>
                <F label={t.tel} val={form.telephone} set={v=>set('telephone',v)} type="tel"/>
                <div>
                  <label style={LBL}>{t.type}</label>
                  <select value={form.type} onChange={e=>set('type',e.target.value)} style={{ width:'100%', padding:'9px 12px', border:'1px solid rgba(0,0,0,.1)', borderRadius:8, fontSize:13.5, fontFamily:"'DM Sans',sans-serif" }}>
                    <option value="">— Sélectionner</option>
                    {t.typeOptions.map((o,i)=><option key={i} value={o}>{o}</option>)}
                  </select>
                </div>
                <F label={t.qual} val={form.qualification} set={v=>set('qualification',v)}/>
                <div>
                  <label style={LBL}>{t.motiv}</label>
                  <textarea value={form.motivation} onChange={e=>set('motivation',e.target.value)} rows={4} placeholder={t.motivHint} style={{ width:'100%', padding:'9px 12px', border:'1px solid rgba(0,0,0,.1)', borderRadius:8, fontSize:13.5, fontFamily:"'DM Sans',sans-serif", resize:'vertical' }}/>
                </div>
                <label style={{ display:'flex', alignItems:'flex-start', gap:10, cursor:'pointer', padding:'10px 12px', borderRadius:9, background:'#F0F9FB', border:'1px solid rgba(27,176,206,.15)' }}>
                  <input type="checkbox" checked={form.consent_rgpd} onChange={e=>set('consent_rgpd',e.target.checked)} style={{ width:16, height:16, marginTop:2, accentColor:'#1BB0CE', flexShrink:0 }}/>
                  <span style={{ fontSize:13, color:'#4A4340', lineHeight:1.55 }}>{t.consent}</span>
                </label>
                {error && <div style={{ background:'#FEF2F2', border:'1px solid #FCD5D5', borderRadius:8, padding:'9px 12px', fontSize:13, color:'#991B1B' }}>{error}</div>}
                <button type="submit" disabled={sending} style={{ padding:13, background:sending?'rgba(27,176,206,.4)':'#1BB0CE', color:'white', border:'none', borderRadius:10, fontSize:14, fontWeight:600, cursor:sending?'wait':'pointer', fontFamily:"'DM Sans',sans-serif", boxShadow:'0 3px 14px rgba(27,176,206,.3)' }}>
                  {sending ? `⏳ ${t.sending}` : t.submit}
                </button>
                <p style={{ fontSize:11.5, color:'#A8A39D', textAlign:'center' }}>L'envoi de ce formulaire ne vous engage pas envers l'ASBL.</p>
              </form>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

const LBL = { fontSize:'12.5px', fontWeight:500, color:'#7A7470', display:'block', marginBottom:5 }
function G2({ children }) { return <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>{children}</div> }
function F({ label, val, set, type='text' }) {
  return <div><label style={LBL}>{label}</label><input type={type} value={val} onChange={e=>set(e.target.value)} style={{ width:'100%', padding:'9px 12px', border:'1px solid rgba(0,0,0,.1)', borderRadius:8, fontSize:13.5, fontFamily:"'DM Sans',sans-serif", transition:'border-color .12s' }} onFocus={e=>e.target.style.borderColor='#1BB0CE'} onBlur={e=>e.target.style.borderColor='rgba(0,0,0,.1)'}/></div>
}

const CSS = `
.db-hero{background:linear-gradient(135deg,#0A1E2D,#0E4A5A);padding:72px 20px;position:relative;overflow:hidden;}
.db-hero-bg{position:absolute;inset:0;background:var(--hero-bg) center/cover;opacity:.15;transition:opacity .5s ease;}
.db-hero-bg::after{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(10,30,45,.9),rgba(14,74,90,.7));}
.db-hero-inner{position:relative;z-index:1;max-width:1280px;margin:0 auto;}
.db-tag{display:inline-flex;background:rgba(27,176,206,.25);border:1px solid rgba(27,176,206,.4);border-radius:99px;padding:5px 14px;font-size:11.5px;font-weight:500;color:#7DE4F5;letter-spacing:.04em;text-transform:uppercase;margin-bottom:18px;}
.db-h1{font-family:'Cormorant Garamond',Georgia,serif;font-size:clamp(2.4rem,5vw,3.8rem);font-weight:500;color:white;line-height:1.15;margin-bottom:14px;}
.db-p-hero{font-size:15px;color:rgba(255,255,255,.75);max-width:600px;line-height:1.75;}
@media(max-width:900px){[style*='grid-template-columns: 1fr 1fr']{grid-template-columns:1fr !important;}[style*='grid-template-columns: 1fr 1.2fr']{grid-template-columns:1fr !important;}}
@media(max-width:600px){.db-hero{padding:56px 14px;}}
`